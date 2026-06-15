import type { AppState, Settings, SpotifyTokens } from '../types';
import { DEFAULT_CLIENT_ID } from '../data/spotifyConfig';

export const STORAGE_KEY = 'spotify-radio-dj:v1';
export const TOKENS_KEY = 'spotify-radio-dj:tokens';
export const STATE_VERSION = 1;
export const DEFAULT_STATION_ID = 'night-owl';

export function defaultSettings(): Settings {
  return { selectedStationId: DEFAULT_STATION_ID, enabledSources: {}, voiceByLang: {}, cadence: 3 };
}

export function defaultState(): AppState {
  return { version: STATE_VERSION, settings: defaultSettings() };
}

/** Load persisted settings, tolerating absence or corruption. */
export function loadState(): AppState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full / blocked — non-fatal
  }
}

/** Coerce arbitrary parsed JSON into a valid AppState. */
export function normalizeState(input: unknown): AppState {
  const obj = (input ?? {}) as Partial<AppState>;
  const s = (obj.settings ?? {}) as Partial<Settings>;
  const settings: Settings = {
    spotifyClientId:
      typeof s.spotifyClientId === 'string' && s.spotifyClientId.trim()
        ? s.spotifyClientId.trim()
        : undefined,
    selectedStationId:
      typeof s.selectedStationId === 'string' ? s.selectedStationId : DEFAULT_STATION_ID,
    enabledSources: isStringBoolMap(s.enabledSources) ? s.enabledSources : {},
    voiceByLang: isStringMap(s.voiceByLang) ? s.voiceByLang : {},
    cadence: typeof s.cadence === 'number' && s.cadence >= 1 ? Math.floor(s.cadence) : 3,
    place: isPlace(s.place) ? s.place : undefined,
  };
  return { version: STATE_VERSION, settings };
}

function isStringMap(v: unknown): v is Record<string, string> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v as Record<string, unknown>).every((x) => typeof x === 'string')
  );
}

function isStringBoolMap(v: unknown): v is Record<string, boolean> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v as Record<string, unknown>).every((x) => typeof x === 'boolean')
  );
}

function isPlace(v: unknown): v is { name: string; lat: number; lon: number } {
  const p = v as { name?: unknown; lat?: unknown; lon?: unknown } | null | undefined;
  return (
    !!p &&
    typeof p === 'object' &&
    typeof p.name === 'string' &&
    typeof p.lat === 'number' &&
    typeof p.lon === 'number'
  );
}

/** Effective Spotify Client ID: user override from Settings, else the baked-in default. */
export function getClientId(): string {
  return loadState().settings.spotifyClientId?.trim() || DEFAULT_CLIENT_ID;
}

export function setClientId(id: string): void {
  const st = loadState();
  saveState({
    ...st,
    settings: { ...st.settings, spotifyClientId: id.trim() || undefined },
  });
}

/**
 * Effective enabled-source ids: a source is on unless explicitly turned off, so
 * new users get every available source by default. `available` ids are passed in
 * to avoid a circular import with the source registry.
 */
export function getEnabledSourceIds(availableIds: string[]): string[] {
  const { enabledSources } = loadState().settings;
  return availableIds.filter((id) => enabledSources[id] !== false);
}

export function setSourceEnabled(id: string, on: boolean): void {
  const st = loadState();
  saveState({
    ...st,
    settings: {
      ...st.settings,
      enabledSources: { ...st.settings.enabledSources, [id]: on },
    },
  });
}

export function setSelectedStation(stationId: string): void {
  const st = loadState();
  saveState({ ...st, settings: { ...st.settings, selectedStationId: stationId } });
}

/** Chosen voice name for a language, if the user picked one. */
export function getVoiceForLang(lang: string): string | undefined {
  return loadState().settings.voiceByLang[lang];
}

export function setVoiceForLang(lang: string, voiceName: string): void {
  const st = loadState();
  saveState({
    ...st,
    settings: { ...st.settings, voiceByLang: { ...st.settings.voiceByLang, [lang]: voiceName } },
  });
}

export function getCadence(): number {
  return loadState().settings.cadence;
}

export function setCadence(n: number): void {
  const st = loadState();
  const cadence = Math.max(1, Math.min(20, Math.floor(n)));
  saveState({ ...st, settings: { ...st.settings, cadence } });
}

// Tokens live under a separate key so they're never part of an exported
// settings file.
export function loadTokens(): SpotifyTokens | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as SpotifyTokens;
    if (typeof t?.accessToken !== 'string' || typeof t?.expiresAt !== 'number') return null;
    return t;
  } catch {
    return null;
  }
}

export function saveTokens(t: SpotifyTokens | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    // non-fatal
  }
}
