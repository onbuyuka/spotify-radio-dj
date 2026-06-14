import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SpotifyProfile, SpotifyPlaylist, SpotifyTokens } from '../types';
import {
  beginLogin,
  completeLoginIfRedirected,
  ensureFreshToken,
} from '../utils/spotifyAuth';
import { getProfile, getPlaylists } from '../utils/spotifyApi';
import { getClientId, saveTokens } from '../utils/storage';

export type SpotifyStatus =
  | 'loading'
  | 'anonymous'
  | 'connecting'
  | 'connected'
  | 'error';

interface SpotifyStore {
  status: SpotifyStatus;
  profile: SpotifyProfile | null;
  playlists: SpotifyPlaylist[];
  error: string | null;
  /** Start the PKCE login (redirects away to Spotify). */
  login: () => void;
  /** Forget the stored session. */
  logout: () => void;
  /** A valid access token, refreshed if needed (null if not connected). */
  getToken: () => Promise<SpotifyTokens | null>;
}

const Ctx = createContext<SpotifyStore | null>(null);

export const SpotifyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SpotifyStatus>('loading');
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const didInit = useRef(false);

  const loadConnected = useCallback(async (tokens: SpotifyTokens) => {
    const prof = await getProfile(tokens);
    setProfile(prof);
    setPlaylists(await getPlaylists(tokens));
    setStatus('connected');
  }, []);

  // Bootstrap once: complete a redirect exchange if present, else resume a
  // stored session. The ref guard keeps the one-time auth code from being
  // consumed twice under React StrictMode's double-invoked effects.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      const clientId = getClientId();
      try {
        let tokens = await completeLoginIfRedirected(clientId);
        if (!tokens) tokens = await ensureFreshToken(clientId);
        if (tokens) await loadConnected(tokens);
        else setStatus('anonymous');
      } catch (e) {
        setError((e as Error).message);
        setStatus('error');
      }
    })();
  }, [loadConnected]);

  const login = useCallback(() => {
    const clientId = getClientId();
    if (!clientId) {
      setError('Add your Spotify Client ID in Settings first.');
      setStatus('error');
      return;
    }
    setError(null);
    setStatus('connecting');
    beginLogin(clientId).catch((e) => {
      setError((e as Error).message);
      setStatus('error');
    });
  }, []);

  const logout = useCallback(() => {
    saveTokens(null);
    setProfile(null);
    setPlaylists([]);
    setError(null);
    setStatus('anonymous');
  }, []);

  const getToken = useCallback(() => ensureFreshToken(getClientId()), []);

  const value = useMemo<SpotifyStore>(
    () => ({ status, profile, playlists, error, login, logout, getToken }),
    [status, profile, playlists, error, login, logout, getToken],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useSpotify(): SpotifyStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSpotify must be used within <SpotifyProvider>');
  return ctx;
}
