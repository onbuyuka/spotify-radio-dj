// Thin wrapper around a Spotify.Player instance: connects the browser as a
// Spotify Connect device and exposes the few controls the Director needs.
//
// Songs are DRM-protected, so we never touch the audio — we only tell Spotify
// which single track to play, then pause/resume around the DJ segments.

import type { SpotifyTokens } from '../types';
import { loadSpotifySdk } from '../utils/sdkLoader';
import { playUris, getDevices } from '../utils/spotifyApi';

export type TokenGetter = () => Promise<SpotifyTokens | null>;

export interface PlayerEvents {
  onState?: (state: Spotify.PlaybackState | null) => void;
  onError?: (message: string) => void;
}

const PLAYER_NAME = 'RadioDJ';

export class RadioPlayer {
  private player: Spotify.Player | null = null;
  private deviceId: string | null = null;
  private readonly getToken: TokenGetter;
  private readonly events: PlayerEvents;

  constructor(getToken: TokenGetter, events: PlayerEvents = {}) {
    this.getToken = getToken;
    this.events = events;
  }

  /** Load the SDK, create the player, connect, and resolve with the device id. */
  async connect(): Promise<string> {
    if (this.deviceId) return this.deviceId;
    await loadSpotifySdk();

    const player = new window.Spotify.Player({
      name: PLAYER_NAME,
      volume: 0.8,
      getOAuthToken: (cb) => {
        this.getToken()
          .then((t) => {
            if (t) cb(t.accessToken);
          })
          .catch(() => {});
      },
    });
    this.player = player;

    const ready = new Promise<string>((resolve, reject) => {
      player.addListener('ready', ({ device_id }) => {
        this.deviceId = device_id;
        resolve(device_id);
      });
      player.addListener('initialization_error', ({ message }) => {
        // The most common cause is a browser with no Widevine/PlayReady DRM —
        // e.g. an embedded/in-app browser. Spotify audio is DRM-protected and
        // can't decode there. Surface an actionable hint.
        const drm =
          'Spotify could not start in this browser. It needs DRM (Widevine/PlayReady) ' +
          'to play protected audio — please use Google Chrome or Microsoft Edge, not an ' +
          'in-app/embedded browser.';
        const friendly = /init|keysystem|eme|drm/i.test(message) ? drm : message;
        this.events.onError?.(friendly);
        reject(new Error(friendly));
      });
      player.addListener('authentication_error', ({ message }) => {
        this.events.onError?.(message);
        reject(new Error(message));
      });
      player.addListener('account_error', ({ message }) => {
        this.events.onError?.(message);
        reject(new Error(message));
      });
    });

    player.addListener('not_ready', () => {
      this.deviceId = null;
    });
    player.addListener('playback_error', ({ message }) => this.events.onError?.(message));
    player.addListener('player_state_changed', (state) => this.events.onState?.(state));

    const ok = await player.connect();
    if (!ok) throw new Error('Spotify player failed to connect.');
    const id = await ready;
    // The 'ready' event can fire before Spotify's backend lists the device for
    // playback (causing 404 "Device not found"), and the id it reports can differ
    // from the one in /me/player/devices. Wait for our device to appear and adopt
    // whichever id Spotify actually lists for it.
    this.deviceId = await this.waitForDevice(id);
    return this.deviceId;
  }

  /**
   * Poll /me/player/devices until our device is registered, and return the id
   * Spotify lists for it. Matches our exact device id first, then falls back to
   * adopting any device named PLAYER_NAME (the SDK names ours). Throws a clear,
   * actionable error only if nothing of ours ever appears.
   */
  private async waitForDevice(deviceId: string, timeoutMs = 12_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let lastSeen: string[] = [];
    while (Date.now() < deadline) {
      const t = await this.getToken();
      if (t) {
        try {
          const devices = await getDevices(t);
          lastSeen = devices.map((d) => d.name);
          const exact = devices.find((d) => d.id === deviceId);
          if (exact?.id) return exact.id;
          // Adopt our SDK device by name when the reported id differs.
          const byName = devices.find((d) => d.name === PLAYER_NAME && d.id);
          if (byName?.id) return byName.id;
        } catch {
          // transient — keep polling
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(
      `The "${PLAYER_NAME}" player never registered with Spotify. This usually means ` +
        `a firewall or browser extension is blocking Spotify's device service ` +
        `(devices seen: ${lastSeen.join(', ') || 'none'}).`,
    );
  }

  /** Play a single track URI on this device. */
  async playTrack(uri: string): Promise<void> {
    const t = await this.getToken();
    if (!t) throw new Error('Not connected to Spotify.');
    if (!this.deviceId) throw new Error('The player is not ready yet.');
    await playUris(t, this.deviceId, [uri]);
  }

  async pause(): Promise<void> {
    await this.player?.pause();
  }

  async resume(): Promise<void> {
    await this.player?.resume();
  }

  async getState(): Promise<Spotify.PlaybackState | null> {
    return (await this.player?.getCurrentState()) ?? null;
  }

  /** Unlock audio in browsers that require a user gesture (call from a click). */
  async activate(): Promise<void> {
    await this.player?.activateElement();
  }

  disconnect(): void {
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
  }
}
