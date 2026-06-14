import React, { useState } from 'react';
import { getClientId, setClientId } from '../utils/storage';
import { getRedirectUri, DEFAULT_CLIENT_ID } from '../data/spotifyConfig';

export const SettingsPage: React.FC = () => {
  const [clientId, setClientIdState] = useState(() => {
    const stored = getClientId();
    return stored === DEFAULT_CLIENT_ID ? '' : stored;
  });
  const [saved, setSaved] = useState(false);
  const redirectUri = getRedirectUri();

  const save = () => {
    setClientId(clientId);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <h1 className="font-pixel text-amber-400 text-base mb-5 [text-shadow:0_0_8px_rgba(255,178,46,.4)]">
        ⚙ SETUP
      </h1>

      <section className="panel p-5">
        <h2 className="font-pixel text-[11px] text-silver-300 flex items-center gap-2">
          <span className="led led-blue" /> SPOTIFY CONNECTION
        </h2>
        <p className="mt-3 font-lcd text-lg text-silver-300 leading-snug">
          Create an app in the{' '}
          <a
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 underline"
          >
            Spotify Developer Dashboard
          </a>
          , add the redirect URI below, then paste the Client ID here.
        </p>

        <label className="block mt-5 font-pixel text-[9px] text-silver-400">CLIENT ID</label>
        <div className="mt-2 flex gap-2">
          <div className="bezel flex-1">
            <input
              value={clientId}
              onChange={(e) => setClientIdState(e.target.value)}
              placeholder="e.g. 4f0c…"
              spellCheck={false}
              className="w-full lcd px-3 py-2 font-lcd text-xl text-amber-400 placeholder:text-amber-600/50 focus:outline-none bg-transparent"
            />
          </div>
          <button onClick={save} className="btn3d btn3d-amber">
            {saved ? '✓ SAVED' : 'SAVE'}
          </button>
        </div>

        <label className="block mt-5 font-pixel text-[9px] text-silver-400">
          REDIRECT URI TO REGISTER
        </label>
        <button
          onClick={() => copy(redirectUri)}
          title="Click to copy"
          className="mt-2 w-full text-left bezel"
        >
          <span className="block lcd lcd-green px-3 py-2 font-lcd text-lg break-all">
            {redirectUri}
          </span>
        </button>
        <p className="mt-3 font-lcd text-base text-silver-400 leading-snug">
          Add this exact URI in your Spotify app settings. Also add your deployed URL
          (e.g. <span className="text-lime-400">https://&lt;you&gt;.github.io/spotify-radio-dj/</span>)
          so login works both locally and live.
        </p>
      </section>

      <p className="mt-5 font-lcd text-base text-silver-500 text-center">
        Stations, voices and data sources tune in as they come online.
      </p>
    </div>
  );
};
