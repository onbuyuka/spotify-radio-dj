// Core domain model for the Radio DJ app.
//
// The app is a "conductor": Spotify plays full songs (DRM — we never touch the
// audio bytes), and between tracks the app speaks a short DJ segment built from
// data sources (news, sports, weather, facts, song trivia). A "station" bundles
// a language, a voice and a persona; switching station changes the DJ's voice.

// ===========================================================================
// Language & voice
// ===========================================================================

export type Lang = 'en' | 'tr';
export const LANGS: Lang[] = ['en', 'tr'];

export interface VoiceConfig {
  /** Preferred SpeechSynthesisVoice.name; falls back to first voice for `lang`. */
  voiceName?: string;
  /** BCP-47-ish language the utterance is spoken in. */
  lang: Lang;
  /** Speech rate, 0.1–10 (1 = normal). */
  rate: number;
  /** Voice pitch, 0–2 (1 = normal). */
  pitch: number;
}

// ===========================================================================
// Data sources
// ===========================================================================

export type SourceKind = 'news' | 'sports' | 'weather' | 'fact' | 'song';

/** Static description of a source the user can toggle on a station. */
export interface SourceMeta {
  id: string;
  label: string;
  kind: SourceKind;
  /** Language of the content, or 'any' for language-agnostic data. */
  lang: Lang | 'any';
}

export interface NewsItem {
  title: string;
  summary?: string;
  /** Outlet name, e.g. "BBC", "NTV". */
  source: string;
  lang: Lang;
  link?: string;
  publishedAt?: string;
}

export interface ScoreItem {
  league: string;
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  /** "FT", "live", or a scheduled kickoff label. */
  status: string;
}

export interface WeatherItem {
  place: string;
  tempC: number;
  description: string;
  high?: number;
  low?: number;
}

export interface FactItem {
  text: string;
  category?: string;
}

/** Built live in the browser from Spotify metadata for the current track. */
export interface SongTrivia {
  track: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  genres?: string[];
  popularity?: number;
}

/** Built server-side by scripts/buildFeed.mjs, read at runtime as a snapshot. */
export interface FeedSnapshot {
  updated: string;
  news: NewsItem[];
  sports: ScoreItem[];
  weather: WeatherItem[];
  facts: FactItem[];
}

// ===========================================================================
// Stations
// ===========================================================================

export interface Persona {
  /** Spoken when the show first starts. */
  intros: string[];
  /** Spoken when handing back to the music. */
  outros: string[];
  /** Connective lines woven between data bits. */
  transitions: string[];
}

export interface Station {
  id: string;
  name: string;
  tagline: string;
  lang: Lang;
  voice: VoiceConfig;
  persona: Persona;
  /** Source ids this station draws from. */
  sources: string[];
  /** Speak a DJ segment every N tracks. */
  cadence: number;
}

/** A built, ready-to-speak DJ segment. */
export interface DjSegment {
  id: string;
  stationId: string;
  sourceId: string;
  text: string;
  lang: Lang;
  createdAt: string;
}

// ===========================================================================
// Spotify
// ===========================================================================

export interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when `accessToken` expires. */
  expiresAt: number;
  scope?: string;
}

export interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

export interface SpotifyArtistRef {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  durationMs: number;
  artists: SpotifyArtistRef[];
  album?: { name: string; releaseDate?: string; images?: SpotifyImage[] };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  trackCount: number;
  image?: string;
}

export interface SpotifyProfile {
  id: string;
  displayName?: string;
  /** "premium" is required for Web Playback SDK control. */
  product?: string;
  image?: string;
}

// ===========================================================================
// Director (playback state machine)
// ===========================================================================

export type DirectorPhase =
  | 'idle'
  | 'loading'
  | 'playingTrack'
  | 'gap'
  | 'speaking'
  | 'paused'
  | 'error';

/** Repeat behaviour, cycled like Spotify: off → whole queue → single track. */
export type RepeatMode = 'off' | 'all' | 'one';

// ===========================================================================
// Settings / persisted app state
// ===========================================================================

export interface Settings {
  /** Optional override for the shared Spotify app's client id. */
  spotifyClientId?: string;
  selectedStationId: string;
  /** Per-source on/off, keyed by source id. */
  enabledSources: Record<string, boolean>;
  /** Chosen TTS voice name per language (e.g. { tr: 'Microsoft Tolga' }). */
  voiceByLang: Record<string, string>;
  /** Speak a DJ segment every N tracks. */
  cadence: number;
  /** Location used for the weather source. */
  place?: { name: string; lat: number; lon: number };
}

export interface AppState {
  version: number;
  settings: Settings;
}
