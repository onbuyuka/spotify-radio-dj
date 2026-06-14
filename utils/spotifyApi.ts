import type { SpotifyTokens, SpotifyProfile, SpotifyPlaylist, SpotifyTrack } from '../types';
import { API_BASE } from '../data/spotifyConfig';

/** Carries the HTTP status so callers can react to specific errors (e.g. 404). */
export class SpotifyApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

/** Minimal typed wrapper over the Spotify Web API. Throws on non-2xx. */
export async function spotifyFetch<T>(
  tokens: SpotifyTokens,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new SpotifyApiError(res.status, `Spotify API ${res.status}: ${text.slice(0, 200)}`);
  }
  // Player endpoints (play/pause) return 204 No Content.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Right after the Web Playback SDK fires `ready`, Spotify's Connect backend can
 * still return 404 "Device not found" for a few hundred ms while it finishes
 * registering the new device. Retry play calls through that window (plus the
 * transient 202/5xx) with a short backoff.
 */
async function withDeviceRetry(fn: () => Promise<void>, attempts = 6): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await fn();
      return;
    } catch (e) {
      lastErr = e;
      const status = e instanceof SpotifyApiError ? e.status : 0;
      const transient = status === 404 || status === 202 || status >= 500;
      if (!transient || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 350 + i * 350));
    }
  }
  throw lastErr;
}

interface RawProfile {
  id: string;
  display_name?: string;
  product?: string;
  images?: Array<{ url: string }>;
}

export async function getProfile(tokens: SpotifyTokens): Promise<SpotifyProfile> {
  const j = await spotifyFetch<RawProfile>(tokens, '/me');
  return {
    id: j.id,
    displayName: j.display_name ?? undefined,
    product: j.product ?? undefined,
    image: j.images?.[0]?.url,
  };
}

interface RawPlaylistPage {
  items: Array<{
    id: string;
    name: string;
    uri: string;
    // Spotify's standard shape uses `tracks: { total }`; the newer shape this
    // app receives uses `items: { total }` for the same count.
    tracks?: { total?: number };
    items?: { total?: number };
    images?: Array<{ url: string }>;
  } | null>;
  next: string | null;
}

/** Fetch all of the user's playlists, following pagination. */
export async function getPlaylists(tokens: SpotifyTokens): Promise<SpotifyPlaylist[]> {
  const out: SpotifyPlaylist[] = [];
  let path: string | null = '/me/playlists?limit=50';
  while (path) {
    const page: RawPlaylistPage = await spotifyFetch<RawPlaylistPage>(tokens, path);
    for (const p of page.items ?? []) {
      if (!p) continue;
      out.push({
        id: p.id,
        name: p.name,
        uri: p.uri,
        trackCount: p.items?.total ?? p.tracks?.total ?? 0,
        image: p.images?.[0]?.url,
      });
    }
    // `next` is an absolute URL; strip the base so we can reuse spotifyFetch.
    path = page.next ? page.next.replace(API_BASE, '') : null;
  }
  return out;
}

// ===========================================================================
// Player control + track listing
// ===========================================================================

export interface SpotifyDevice {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
}

/** List the Spotify Connect devices currently visible to this account. */
export async function getDevices(tokens: SpotifyTokens): Promise<SpotifyDevice[]> {
  const j = await spotifyFetch<{ devices?: SpotifyDevice[] }>(tokens, '/me/player/devices');
  return j.devices ?? [];
}

/** Start playback of explicit track URIs on a device. */
export async function playUris(
  tokens: SpotifyTokens,
  deviceId: string,
  uris: string[],
  positionMs?: number,
): Promise<void> {
  await withDeviceRetry(() =>
    spotifyFetch<void>(
      tokens,
      `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uris,
          ...(positionMs != null ? { position_ms: positionMs } : {}),
        }),
      },
    ),
  );
}

interface RawTrack {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  type?: string;
  is_playable?: boolean;
  episode?: boolean;
  artists: Array<{ id: string; name: string }>;
  album?: {
    name: string;
    release_date?: string;
    images?: Array<{ url: string; width?: number; height?: number }>;
  };
}

function mapTrack(tr: RawTrack): SpotifyTrack {
  return {
    id: tr.id ?? tr.uri,
    uri: tr.uri,
    name: tr.name,
    durationMs: tr.duration_ms,
    artists: (tr.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
    album: tr.album
      ? { name: tr.album.name, releaseDate: tr.album.release_date, images: tr.album.images }
      : undefined,
  };
}

// A playlist "row" wraps a track. Spotify's standard shape nests it under
// `track`; the newer shape this app receives nests it under `item` (which also
// covers podcast episodes via `episode: true`).
interface PlaylistRow {
  track?: RawTrack | null;
  item?: RawTrack | null;
}

// The page of rows lives under `tracks` (standard) or `items` (newer shape).
interface RawPlaylistObject {
  tracks?: { items?: PlaylistRow[]; next?: string | null };
  items?: { items?: PlaylistRow[]; next?: string | null };
}

/** Read the rows + next-page URL from whichever shape the response uses. */
function readTrackPage(obj: RawPlaylistObject): { rows: PlaylistRow[]; next: string | null } {
  const paging = obj.items ?? obj.tracks ?? {};
  return { rows: paging.items ?? [], next: paging.next ?? null };
}

/** Max tracks to pull (×100 per page). 2000 covers very large playlists. */
const MAX_TRACKS = 2000;
const MAX_TRACK_PAGES = Math.ceil(MAX_TRACKS / 100);

/**
 * Fetch a playlist's playable tracks. The dedicated `/playlists/{id}/tracks`
 * endpoint returns 403 for apps in Spotify's development mode, so we read the
 * full playlist object instead (which embeds the first page of tracks) and then
 * follow pagination best-effort. `onProgress` reports the running count so the
 * UI can show a loading indicator on big playlists.
 */
export async function getPlaylistTracks(
  tokens: SpotifyTokens,
  playlistId: string,
  onProgress?: (count: number) => void,
): Promise<SpotifyTrack[]> {
  const out: SpotifyTrack[] = [];

  const collect = (rows: PlaylistRow[]): void => {
    for (const row of rows) {
      const tr = row?.item ?? row?.track;
      if (!tr || !tr.uri) continue;
      if (tr.episode || (tr.type && tr.type !== 'track')) continue;
      if (tr.is_playable === false) continue;
      out.push(mapTrack(tr));
    }
    onProgress?.(out.length);
  };

  let firstObj: RawPlaylistObject;
  try {
    firstObj = await spotifyFetch<RawPlaylistObject>(tokens, `/playlists/${playlistId}`);
  } catch (e) {
    if (e instanceof SpotifyApiError && (e.status === 401 || e.status === 403)) {
      throw new Error(
        "Spotify refused to read this playlist (403). Try Disconnect and reconnect, " +
          'or pick a different playlist.',
      );
    }
    throw e;
  }

  const first = readTrackPage(firstObj);
  collect(first.rows);

  // Follow pagination best-effort. The `next` URL targets the newer `/items`
  // endpoint; if it ever 403s like `/tracks`, stop and use what we have.
  let next = first.next;
  let pages = 1;
  while (next && pages < MAX_TRACK_PAGES && out.length < MAX_TRACKS) {
    try {
      const page = await spotifyFetch<{ items?: PlaylistRow[]; next?: string | null }>(
        tokens,
        next.replace(API_BASE, ''),
      );
      collect(page.items ?? []);
      next = page.next ?? null;
    } catch {
      break;
    }
    pages++;
  }

  return out;
}
