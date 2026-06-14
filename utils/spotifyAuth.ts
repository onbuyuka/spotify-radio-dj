import type { SpotifyTokens } from '../types';
import { AUTH_ENDPOINT, TOKEN_ENDPOINT, SCOPES, getRedirectUri } from '../data/spotifyConfig';
import { generateCodeVerifier, codeChallenge, randomState } from './pkce';
import { loadTokens, saveTokens } from './storage';

const VERIFIER_KEY = 'spotify_pkce_verifier';
const STATE_KEY = 'spotify_pkce_state';
const RETURN_KEY = 'spotify_return';
/** Refresh this many ms before actual expiry to avoid mid-request 401s. */
const REFRESH_MARGIN_MS = 60_000;

/** Kick off the PKCE login: stash a verifier, then redirect to Spotify. */
export async function beginLogin(clientId: string): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await codeChallenge(verifier);
  const state = randomState();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, window.location.hash || '#/play');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES.join(' '),
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  window.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);
}

function tokensFromResponse(json: TokenResponse, prevRefresh?: string): SpotifyTokens {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? prevRefresh,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scope: json.scope,
  };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * If the current URL is a Spotify redirect (carries ?code=...), exchange the
 * code for tokens, clean the URL, and return the tokens. Returns null on a
 * normal (non-redirect) load.
 */
export async function completeLoginIfRedirected(clientId: string): Promise<SpotifyTokens | null> {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error) {
    cleanUrl();
    throw new Error(`Spotify denied the request: ${error}`);
  }
  const code = params.get('code');
  if (!code) return null;

  const returnedState = params.get('state');
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier || !expectedState || returnedState !== expectedState) {
    cleanUrl();
    throw new Error('Login state mismatch — please try connecting again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: clientId,
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    cleanUrl();
    throw new Error(`Token exchange failed (${res.status}). Check the redirect URI and Client ID.`);
  }
  const tokens = tokensFromResponse((await res.json()) as TokenResponse);
  saveTokens(tokens);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  cleanUrl();
  return tokens;
}

/** Strip the ?code/?error query and restore the saved hash route. */
function cleanUrl(): void {
  const ret = sessionStorage.getItem(RETURN_KEY) || '#/play';
  sessionStorage.removeItem(RETURN_KEY);
  window.history.replaceState({}, '', `${import.meta.env.BASE_URL}${ret}`);
}

/** Exchange a refresh token for a fresh access token. Returns null on failure. */
export async function refreshTokens(
  clientId: string,
  refreshToken: string,
): Promise<SpotifyTokens | null> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return null;
    const tokens = tokensFromResponse((await res.json()) as TokenResponse, refreshToken);
    saveTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

/**
 * Return a valid access token, refreshing if it is expired (or close to it).
 * Returns null if there is no stored session or the refresh fails.
 */
export async function ensureFreshToken(clientId: string): Promise<SpotifyTokens | null> {
  const t = loadTokens();
  if (!t) return null;
  if (Date.now() < t.expiresAt - REFRESH_MARGIN_MS) return t;
  if (!t.refreshToken) return null;
  return refreshTokens(clientId, t.refreshToken);
}
