import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SpotifyPlaylist, SpotifyTrack, Station } from '../types';
import { useSpotify } from './SpotifyStore';
import { getPlaylistTracks } from '../utils/spotifyApi';
import { RadioPlayer } from './RadioPlayer';
import { Director, type DirectorState } from './Director';
import { WebSpeechTts } from '../utils/tts';
import { createSegmentBuilder } from '../utils/segments';
import { loadFeed, EMPTY_FEED } from '../utils/feed';
import { SOURCES, AVAILABLE_SOURCES } from '../data/sources';
import { getEnabledSourceIds, setSourceEnabled } from '../utils/storage';
import type { FeedSnapshot } from '../types';

interface BoothProps {
  playlist: SpotifyPlaylist;
  station: Station;
  cadence: number;
  onExit: () => void;
}

function fmt(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const PHASE_LABEL: Record<DirectorState['phase'], string> = {
  idle: 'Stopped',
  loading: 'Tuning in…',
  playingTrack: 'On air',
  gap: 'Cueing the DJ…',
  speaking: 'DJ talking',
  paused: 'Paused',
  error: 'Error',
};

export const Booth: React.FC<BoothProps> = ({ playlist, station, cadence, onExit }) => {
  const { getToken } = useSpotify();
  const [tracks, setTracks] = useState<SpotifyTrack[] | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<DirectorState | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const on = new Set(getEnabledSourceIds(AVAILABLE_SOURCES.map((s) => s.id)));
    return Object.fromEntries(AVAILABLE_SOURCES.map((s) => [s.id, on.has(s.id)]));
  });
  const directorRef = useRef<Director | null>(null);
  // The data feed (news/sports/weather), loaded once when the booth opens.
  const feedRef = useRef<FeedSnapshot>(EMPTY_FEED);
  // The active segment builder lives in a ref so toggling sources updates the DJ
  // live without tearing down the player/Director.
  const builderRef = useRef(createSegmentBuilder([]));

  const sourceIds = useMemo(
    () => AVAILABLE_SOURCES.filter((s) => enabled[s.id]).map((s) => s.id),
    [enabled],
  );
  useEffect(() => {
    builderRef.current = createSegmentBuilder(sourceIds, feedRef.current);
  }, [sourceIds]);

  // Fetch the feed snapshot once; rebuild the segment builder when it arrives.
  useEffect(() => {
    let cancelled = false;
    loadFeed().then((feed) => {
      if (cancelled) return;
      feedRef.current = feed;
      builderRef.current = createSegmentBuilder(sourceIds, feed);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSource = (id: string) => {
    const next = !enabled[id];
    setEnabled((e) => ({ ...e, [id]: next }));
    setSourceEnabled(id, next);
  };

  useEffect(() => {
    const tts = new WebSpeechTts();
    const player = new RadioPlayer(getToken, {
      onError: (m) => setState((s) => (s ? { ...s, error: m } : s)),
    });
    const director = new Director({
      player,
      station,
      cadence,
      speak: (text, lang) =>
        tts.speak(text, {
          lang,
          rate: station.voice.rate,
          pitch: station.voice.pitch,
          voiceName: station.voice.voiceName,
        }),
      buildSegment: (ctx) => builderRef.current(ctx),
      onState: setState,
    });
    directorRef.current = director;

    let cancelled = false;
    director
      .prepare()
      .then(() => !cancelled && setReady(true))
      .catch((e) => !cancelled && setLoadError((e as Error).message));
    (async () => {
      try {
        const t = await getToken();
        if (!t) throw new Error('Not connected to Spotify.');
        const list = await getPlaylistTracks(t, playlist.id, (n) => {
          if (!cancelled) setLoadCount(n);
        });
        if (!cancelled) setTracks(list);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      director.stop();
      player.disconnect();
      tts.cancel();
      directorRef.current = null;
    };
  }, [getToken, playlist.id, station, cadence]);

  const goOnAir = async () => {
    if (!tracks || !directorRef.current) return;
    setStarted(true);
    await directorRef.current.start(tracks);
  };

  const toggleShuffle = () => directorRef.current?.setShuffle(!(state?.shuffle ?? false));

  const phase = state?.phase ?? (ready ? 'idle' : 'loading');
  const live = phase === 'playingTrack' || phase === 'gap' || phase === 'speaking';
  const progress =
    state && state.durationMs > 0 ? Math.min(100, (state.positionMs / state.durationMs) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-4">
      {/* Top deck: ON AIR sign + leave */}
      <div className="panel p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`led ${live ? 'led-red animate-blink' : ''}`} />
          <span className={`font-pixel text-xs ${live ? 'text-onair-400' : 'text-silver-500'}`}>
            {live ? 'ON AIR' : 'OFF AIR'}
          </span>
          <span className="hidden sm:inline font-lcd text-base text-silver-300">
            · {PHASE_LABEL[phase]}
          </span>
        </div>
        <button onClick={onExit} className="btn3d">
          ⏏ Leave
        </button>
      </div>

      {/* DJ console — station, playlist, sources, and the DJ's mic, all together */}
      <div className="panel p-4 space-y-3">
        <div className="bezel">
          <div className="lcd lcd-green px-3 py-1.5 font-lcd text-lg flex items-center gap-2">
            <span className="text-amber-400">{station.name}</span>
            <span className="text-silver-500">·</span>
            <span className="truncate">{playlist.name}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-pixel text-[9px] text-silver-400 mr-1">DJ SRC</span>
          {SOURCES.map((s) => {
            const on = !!enabled[s.id] && s.available;
            return (
              <button
                key={s.id}
                onClick={() => s.available && toggleSource(s.id)}
                disabled={!s.available}
                title={s.blurb}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-lcd text-base transition-colors ${
                  !s.available
                    ? 'border-metal-600 text-silver-600 cursor-not-allowed'
                    : on
                      ? 'border-lime-500 text-lime-400 bg-lime-500/10'
                      : 'border-metal-400 text-silver-300 hover:text-amber-400 hover:border-silver-400'
                }`}
              >
                <span className={`led !w-2 !h-2 ${on ? 'led-green' : ''}`} />
                {s.label}
                {!s.available && <span className="text-silver-600"> ·SOON</span>}
              </button>
            );
          })}
        </div>

        {state?.lastSegment && (
          <div className="bezel">
            {/* TV-style ticker: scrolls right→left; key restarts it on each new line. */}
            <div className="lcd lcd-green px-3 py-2 font-lcd text-lg overflow-hidden whitespace-nowrap">
              <span
                key={state.lastSegment}
                className="inline-block"
                style={{
                  animation: `marquee ${Math.max(10, state.lastSegment.length * 0.22)}s linear infinite`,
                }}
              >
                {state.lastSegment}
              </span>
            </div>
          </div>
        )}
      </div>

      {loadError && (
        <div className="bezel">
          <div className="lcd px-4 py-3 font-lcd text-lg text-onair-400">⚠ {loadError}</div>
        </div>
      )}

      {/* Deck — now playing + transport in one unit, single time readout */}
      <div className="panel p-4 space-y-3">
        <div className="bezel">
          <div className="lcd p-4">
            {state?.track ? (
              <>
                <div className="flex items-center gap-3">
                  {state.track.album?.images?.[0]?.url ? (
                    <span className="bezel shrink-0">
                      <img
                        src={state.track.album.images[0].url}
                        alt=""
                        className="w-16 h-16 object-cover rounded block"
                      />
                    </span>
                  ) : (
                    <span className="w-16 h-16 shrink-0 grid place-items-center bg-chassis-900 rounded text-2xl">
                      💿
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-lcd text-2xl text-amber-400 truncate leading-tight">
                      {state.track.name}
                    </div>
                    <div className="font-lcd text-lg text-lime-400 truncate">
                      {state.track.artists.map((a) => a.name).join(', ')}
                    </div>
                  </div>
                  <VuMeter active={live} />
                </div>
                <div className="mt-3 panel-inset h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-lime-500 to-amber-400 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-6 font-lcd text-xl text-amber-400">
                {started
                  ? '▸ Starting the show…'
                  : tracks
                    ? `${tracks.length} TRACKS READY`
                    : `LOADING… ${loadCount || ''}`}
              </div>
            )}
          </div>
        </div>

        {/* Transport row: elapsed · buttons · total (one time indicator) */}
        {!started ? (
          <div className="flex items-center justify-center">
            <button
              onClick={goOnAir}
              disabled={!ready || !tracks}
              className="btn3d btn3d-amber text-sm"
            >
              {ready && tracks ? '● GO ON AIR' : '▚ Tuning in…'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-lcd text-base text-amber-400 num w-12 shrink-0">
              {fmt(state?.positionMs ?? 0)}
            </span>
            <div className="flex items-center justify-center gap-3 flex-1">
              <button
                onClick={toggleShuffle}
                title="Shuffle"
                aria-pressed={state?.shuffle ?? false}
                className={`xport ${state?.shuffle ? 'xport-on' : ''}`}
              >
                ⇄
              </button>
              <button
                onClick={() => directorRef.current?.previous()}
                title="Previous"
                className="xport"
              >
                |◄◄
              </button>
              {phase === 'paused' ? (
                <button
                  onClick={() => directorRef.current?.resume()}
                  title="Play"
                  className="xport xport-lg xport-amber"
                >
                  ►
                </button>
              ) : (
                <button
                  onClick={() => directorRef.current?.pause()}
                  disabled={phase !== 'playingTrack'}
                  title="Pause"
                  className="xport xport-lg xport-amber"
                >
                  ❚❚
                </button>
              )}
              <button
                onClick={() => directorRef.current?.skip()}
                title="Skip"
                className="xport"
              >
                ►►|
              </button>
              <button
                onClick={() => directorRef.current?.cycleRepeat()}
                title={`Repeat: ${state?.repeat ?? 'off'}`}
                aria-pressed={(state?.repeat ?? 'off') !== 'off'}
                className={`xport relative ${(state?.repeat ?? 'off') !== 'off' ? 'xport-on' : ''}`}
              >
                ↻
                {state?.repeat === 'one' && (
                  <span className="absolute bottom-1 right-1 grid place-items-center w-3.5 h-3.5 rounded-full bg-chassis-900 font-pixel text-[7px] text-lime-400 leading-none">
                    1
                  </span>
                )}
              </button>
            </div>
            <span className="font-lcd text-base text-amber-400 num w-12 shrink-0 text-right">
              {fmt(state?.durationMs ?? 0)}
            </span>
          </div>
        )}
      </div>

      {/* Song list (own scroll area) */}
      {state && state.queue.length > 0 && <SongList state={state} />}
    </div>
  );
};

const VuMeter: React.FC<{ active: boolean }> = ({ active }) => {
  const BARS = 6;
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.15));
  useEffect(() => {
    if (!active) {
      setLevels(Array(BARS).fill(0.12));
      return;
    }
    const id = window.setInterval(() => {
      setLevels((prev) => prev.map(() => 0.25 + Math.random() * 0.75));
    }, 140);
    return () => window.clearInterval(id);
  }, [active]);
  return (
    <div className="vu h-12 shrink-0" aria-hidden>
      {levels.map((l, i) => (
        <i key={i} style={{ height: '100%', transform: `scaleY(${l})` }} />
      ))}
    </div>
  );
};

const SongList: React.FC<{ state: DirectorState }> = ({ state }) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state.index]);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-pixel text-[10px] text-silver-400">▤ TRACKLIST</h2>
        <span className="font-lcd text-base text-amber-400 num">
          {state.index + 1} / {state.total}
        </span>
      </div>
      <div ref={listRef} className="max-h-72 overflow-y-auto panel-inset divide-y divide-black/40">
        {state.queue.map((t, i) => {
          const current = i === state.index;
          const past = i < state.index;
          return (
            <button
              key={`${t.uri}-${i}`}
              ref={current ? activeRef : undefined}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 ${
                current ? 'bg-amber-400/10' : 'hover:bg-white/5'
              } ${past ? 'opacity-40' : ''}`}
            >
              <span
                className={`w-7 text-center font-lcd text-base num shrink-0 ${
                  current ? 'text-onair-400' : 'text-silver-500'
                }`}
              >
                {current ? '►' : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-lcd text-lg truncate ${
                    current ? 'text-amber-400' : 'text-silver-300'
                  }`}
                >
                  {t.name}
                </span>
                <span className="block font-lcd text-sm text-silver-500 truncate">
                  {t.artists.map((a) => a.name).join(', ')}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
