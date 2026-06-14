import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpotify } from '../components/SpotifyStore';
import { Booth } from '../components/Booth';
import { STATIONS, getStation } from '../data/stations';
import { loadState, setSelectedStation } from '../utils/storage';

const PLAYLIST_PAGE = 6;

const OnAir: React.FC<{ live?: boolean }> = ({ live }) => (
  <div className="inline-flex items-center gap-2 panel px-3 py-1.5">
    <span className={`led ${live ? 'led-red animate-blink' : ''}`} />
    <span className={`font-pixel text-[10px] ${live ? 'text-onair-400' : 'text-silver-500'}`}>
      {live ? 'ON AIR' : 'OFF AIR'}
    </span>
  </div>
);

export const PlayPage: React.FC = () => {
  const { status, profile, playlists, error, login, logout } = useSpotify();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stationId, setStationId] = useState(() => loadState().settings.selectedStationId);
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const cadence = useMemo(() => loadState().settings.cadence, []);
  const station = useMemo(() => getStation(stationId), [stationId]);
  const selectedPlaylist = playlists.find((p) => p.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? playlists.filter((p) => p.name.toLowerCase().includes(q)) : playlists;
  }, [playlists, query]);
  const visible = showAll ? filtered : filtered.slice(0, PLAYLIST_PAGE);

  const chooseStation = (id: string) => {
    setStationId(id);
    setSelectedStation(id);
  };

  if (status === 'loading') {
    return (
      <div className="max-w-xl mx-auto panel p-6 text-center animate-fade-in">
        <OnAir />
        <p className="mt-5 font-lcd text-xl text-amber-400">▚ Checking your Spotify session…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-xl mx-auto panel p-6 text-center animate-fade-in">
        <OnAir />
        <div className="mt-5 bezel">
          <div className="lcd px-4 py-3 font-lcd text-lg text-onair-400">
            ⚠ {error ?? 'Something went wrong.'}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button onClick={login} className="btn3d btn3d-amber">
            ↻ Try again
          </button>
          <Link to="/settings" className="btn3d">
            ⚙ Setup
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'anonymous' || status === 'connecting') {
    return (
      <div className="max-w-xl mx-auto panel p-6 sm:p-8 text-center animate-fade-in">
        <div className="flex justify-center">
          <OnAir />
        </div>
        <div className="mt-5 bezel">
          <div className="lcd px-4 py-5">
            <div className="font-pixel text-amber-400 text-xs">NO SIGNAL</div>
            <div className="mt-2 font-lcd text-lime-400 text-xl">
              Connect Spotify Premium to run the show
            </div>
          </div>
        </div>
        <button
          onClick={login}
          disabled={status === 'connecting'}
          className="btn3d btn3d-amber text-sm mt-6"
        >
          {status === 'connecting' ? '▸ Redirecting…' : '⏻ Connect Spotify'}
        </button>
        <p className="mt-5 font-lcd text-base text-silver-400">
          First time?{' '}
          <Link to="/settings" className="text-amber-400 underline">
            Set your Client ID in Setup
          </Link>
        </p>
      </div>
    );
  }

  // connected
  const isPremium = profile?.product === 'premium';

  if (live && selectedPlaylist) {
    return (
      <Booth
        playlist={selectedPlaylist}
        station={station}
        cadence={cadence}
        onExit={() => setLive(false)}
      />
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Receiver strip: who's tuned in */}
      <div className="panel p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {profile?.image ? (
            <span className="bezel">
              <img src={profile.image} alt="" className="w-9 h-9 rounded object-cover block" />
            </span>
          ) : (
            <span className="bezel">
              <span className="w-9 h-9 grid place-items-center bg-chassis-900 rounded text-lg">
                🎧
              </span>
            </span>
          )}
          <div className="min-w-0">
            <div className="font-pixel text-[11px] text-amber-400 truncate">
              {(profile?.displayName ?? 'CONNECTED').toUpperCase()}
            </div>
            <div className="font-lcd text-base text-lime-400 flex items-center gap-1.5">
              <span className={`led ${isPremium ? 'led-green' : 'led-amber'}`} />
              {isPremium ? 'PREMIUM' : `PLAN: ${profile?.product ?? 'unknown'}`}
            </div>
          </div>
        </div>
        <button onClick={logout} className="btn3d">
          ⏏ Disconnect
        </button>
      </div>

      {!isPremium && (
        <div className="bezel">
          <div className="lcd px-4 py-3 font-lcd text-lg text-amber-400">
            ⚠ Playback needs Spotify PREMIUM. You can browse, but the show can't drive the
            music without it.
          </div>
        </div>
      )}

      {/* Station presets */}
      <div className="panel p-4">
        <h2 className="font-pixel text-[10px] text-silver-400 mb-3">▣ STATION PRESET</h2>
        <div className="flex flex-wrap gap-3">
          {STATIONS.map((s, i) => {
            const active = s.id === stationId;
            return (
              <button
                key={s.id}
                onClick={() => chooseStation(s.id)}
                className={`btn3d ${active ? 'btn3d-on' : ''} flex-col !items-start text-left`}
              >
                <span className="flex items-center gap-2">
                  <span className={`led ${active ? 'led-green' : ''}`} />
                  P{i + 1} · {s.name}
                </span>
                <span className="font-lcd text-sm normal-case tracking-normal text-silver-300 mt-1">
                  {s.tagline}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Playlist deck */}
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
          <h2 className="font-pixel text-[10px] text-silver-400">▤ SELECT TAPE</h2>
          <div className="bezel">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowAll(false);
              }}
              placeholder="SEARCH…"
              className="lcd lcd-green px-3 py-1.5 w-56 font-lcd text-lg text-lime-400 placeholder:text-lime-600/50 focus:outline-none bg-transparent"
            />
          </div>
        </div>
        <p className="font-lcd text-base text-silver-400 mb-3">
          {filtered.length} of {playlists.length} tapes{query ? ` matching “${query}”` : ''}.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visible.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(active ? null : p.id)}
                className="relative text-left panel-inset p-2.5 transition-transform hover:-translate-y-0.5"
              >
                {active && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10 rounded border-2 border-amber-400 bg-amber-400/20"
                  />
                )}
                <span className="bezel block mb-2">
                  {p.image ? (
                    <img src={p.image} alt="" className="w-full aspect-square object-cover rounded block" />
                  ) : (
                    <span className="w-full aspect-square grid place-items-center bg-chassis-900 rounded text-2xl">
                      📼
                    </span>
                  )}
                </span>
                <span className="block font-lcd text-lg text-amber-400 truncate leading-tight">
                  {p.name}
                </span>
                <span className="block font-pixel text-[8px] text-silver-500 mt-1">
                  {p.trackCount} TRK
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length > PLAYLIST_PAGE && (
          <div className="mt-4 text-center">
            <button onClick={() => setShowAll((v) => !v)} className="btn3d">
              {showAll ? '▲ Show less' : `▼ Show more (${filtered.length - PLAYLIST_PAGE})`}
            </button>
          </div>
        )}
      </div>

      {/* Transport bar */}
      <div className="panel p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="bezel flex-1 min-w-[14rem]">
          <div className="lcd px-3 py-2 font-lcd text-lg">
            {selectedPlaylist ? (
              <span className="text-amber-400">
                ▶ READY: {selectedPlaylist.name} · {station.name}
              </span>
            ) : (
              <span className="text-silver-400">⏏ Insert a tape to begin…</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setLive(true)}
          disabled={!selectedPlaylist || !isPremium}
          className="btn3d btn3d-amber text-sm"
        >
          ► START SHOW
        </button>
      </div>
    </div>
  );
};
