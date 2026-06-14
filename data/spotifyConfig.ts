// Spotify app configuration and OAuth (PKCE) constants.
//
// This is a PUBLIC client: we use Authorization Code with PKCE, so there is no
// client secret anywhere in the app. Register an app at
// https://developer.spotify.com/dashboard, add the redirect URIs printed on the
// Settings page, and paste the Client ID into Settings (or bake it in below).

export const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
export const API_BASE = 'https://api.spotify.com/v1';

/** Shared app Client ID. Leave empty to require each user to paste their own. */
export const DEFAULT_CLIENT_ID = '';

/** Scopes: play control + read playlists/profile. */
export const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
];

/**
 * Redirect URI = current origin + Vite base. Resolves to
 * http://127.0.0.1:3000/spotify-radio-dj/ in dev and
 * https://<user>.github.io/spotify-radio-dj/ in production. Both must be
 * registered on the Spotify app. (Spotify rejects "localhost" — use 127.0.0.1.)
 */
export function getRedirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
