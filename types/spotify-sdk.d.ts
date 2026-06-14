// Minimal ambient declarations for the Spotify Web Playback SDK — only the
// surface this app uses. (Avoids pulling in @types/spotify-web-playback-sdk.)

interface Window {
  onSpotifyWebPlaybackSDKReady: () => void;
  Spotify: typeof Spotify;
}

declare namespace Spotify {
  interface PlayerInit {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  interface Artist {
    uri: string;
    name: string;
  }

  interface Album {
    uri: string;
    name: string;
    images: Array<{ url: string }>;
  }

  interface Track {
    uri: string;
    id: string | null;
    name: string;
    duration_ms: number;
    artists: Artist[];
    album: Album;
  }

  interface PlaybackTrackWindow {
    current_track: Track;
    previous_tracks: Track[];
    next_tracks: Track[];
  }

  interface PlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    track_window: PlaybackTrackWindow;
  }

  type ErrorType =
    | 'account_error'
    | 'authentication_error'
    | 'initialization_error'
    | 'playback_error';

  interface Error {
    message: string;
  }

  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: 'ready' | 'not_ready', cb: (d: { device_id: string }) => void): boolean;
    addListener(event: 'player_state_changed', cb: (state: PlaybackState | null) => void): boolean;
    addListener(event: ErrorType, cb: (err: Error) => void): boolean;
    removeListener(event: string): boolean;
    getCurrentState(): Promise<PlaybackState | null>;
    setName(name: string): Promise<void>;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
    activateElement(): Promise<void>;
  }

  const Player: {
    new (init: PlayerInit): Player;
  };
}
