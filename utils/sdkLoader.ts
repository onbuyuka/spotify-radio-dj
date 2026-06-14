// Loads the Spotify Web Playback SDK script once and resolves when it's ready.
// The SDK calls window.onSpotifyWebPlaybackSDKReady when loaded, so that hook is
// installed before the <script> is injected.

let sdkPromise: Promise<void> | null = null;

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

export function loadSpotifySdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Spotify SDK requires a browser environment.'));
      return;
    }
    if (window.Spotify) {
      resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load the Spotify player SDK.'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}
