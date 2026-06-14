import React from 'react';
import { NavLink } from 'react-router-dom';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'btn3d btn3d-amber' : 'btn3d';
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col">
    <header className="sticky top-0 z-30 panel rounded-none border-x-0 border-t-0">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <NavLink to="/" className="flex items-center gap-3">
          <span className="font-pixel text-amber-400 text-sm sm:text-base [text-shadow:0_0_8px_rgba(255,178,46,.5)]">
            RADIO<span className="text-silver-300">·</span>DJ
          </span>
          <span className="hidden sm:inline font-lcd text-lime-400 text-lg leading-none">
            ▸ STEREO FM
          </span>
        </NavLink>
        <nav className="flex items-center gap-2">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <NavLink to="/play" className={navClass}>
            Play
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            Setup
          </NavLink>
        </nav>
      </div>
    </header>

    <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 animate-fade-in">{children}</main>

    <footer className="panel rounded-none border-x-0 border-b-0">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between text-silver-400 font-lcd text-base">
        <span className="text-amber-400">◄◄ ❚❚ ►►</span>
        <span className="hidden sm:inline">MODEL RDJ-2000 · 2-CH STEREO · ⒸYOU</span>
        <span>♪ playlist + voice</span>
      </div>
    </footer>
  </div>
);
