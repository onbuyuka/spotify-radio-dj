import React from 'react';
import { Link } from 'react-router-dom';

export const HomePage: React.FC = () => (
  <div className="max-w-3xl mx-auto animate-fade-in">
    {/* Boombox faceplate */}
    <div className="panel p-5 sm:p-7">
      <div className="flex items-center justify-between mb-4">
        <span className="font-pixel text-[10px] text-silver-400">PORTABLE STEREO</span>
        <span className="flex items-center gap-2 font-pixel text-[10px] text-silver-400">
          PWR <span className="led led-green animate-blink" />
        </span>
      </div>

      <div className="flex items-stretch gap-4">
        {/* left speaker */}
        <div className="hidden sm:block w-20 bezel">
          <div className="grille h-full rounded-md bg-chassis-900" />
        </div>

        {/* center console */}
        <div className="flex-1 min-w-0">
          <div className="bezel">
            <div className="lcd px-4 py-5 text-center">
              <div className="font-pixel text-amber-400 text-base sm:text-xl leading-relaxed">
                RADIO·DJ
              </div>
              <div className="marquee-wrap mt-2">
                <span className="font-lcd text-lime-400 text-xl">
                  ★ YOUR PLAYLIST — WITH A VOICE ★ NEWS · SCORES · WEATHER · SONG FACTS BETWEEN TRACKS ★
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link to="/play" className="btn3d btn3d-amber text-sm">
              ► START
            </Link>
            <Link to="/settings" className="btn3d">
              ⚙ SETUP
            </Link>
          </div>
        </div>

        {/* right speaker */}
        <div className="hidden sm:block w-20 bezel">
          <div className="grille h-full rounded-md bg-chassis-900" />
        </div>
      </div>

      <p className="mt-5 text-center font-lcd text-silver-300 text-lg">
        Spotify plays the songs · the DJ talks between them. Pick a station, pick a
        playlist, hit play.
      </p>
      <p className="mt-2 text-center font-pixel text-[9px] text-silver-500 leading-relaxed">
        REQUIRES SPOTIFY PREMIUM · DESKTOP BROWSER
      </p>
    </div>
  </div>
);
