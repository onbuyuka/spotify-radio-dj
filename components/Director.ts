import type { DirectorPhase, DjSegment, Lang, RepeatMode, SpotifyTrack, Station } from '../types';
import type { RadioPlayer } from './RadioPlayer';
import { pick, shuffled } from '../utils/random';

// The Director is the conductor. It plays one track at a time through the
// RadioPlayer, watches for the track to (near-)end, and every `cadence` tracks
// pauses to speak a DJ segment before starting the next one.

/** How often to poll playback position while a track plays. */
const TICK_MS = 1000;
/** Treat the track as finished this close to the end (smooths the handoff). */
const END_THRESHOLD_MS = 1500;
/** Hard cap on a DJ segment so a hung TTS/build can never freeze the show. */
const SEGMENT_TIMEOUT_MS = 35000;

/** Resolve when `p` settles or after `ms`, whichever comes first. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    p,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

/**
 * Decide whether a playback state means the expected track has ended. Pure and
 * unit-tested so the (untestable-live) state machine has a verified core.
 *
 * A single-track URI can signal its end several ways depending on the SDK
 * build: paused at position 0, paused at full duration, or the just-played
 * track appearing in `previous_tracks`. We also treat "within END_THRESHOLD of
 * the end while still playing" as ended to smooth the handoff.
 */
export function isTrackEnd(
  s: Spotify.PlaybackState | null,
  expectedUri: string | undefined,
  wasPlaying: boolean,
): boolean {
  if (!s) return false;
  const current = s.track_window?.current_track;
  if (!current || current.uri !== expectedUri) return false;
  const nearEnd = s.duration > 0 && s.duration - s.position <= END_THRESHOLD_MS;
  if (!s.paused) return nearEnd;
  if (!wasPlaying) return false;
  const inPrev =
    s.track_window?.previous_tracks?.some(
      (t) => t.uri === current.uri || (t.id != null && t.id === current.id),
    ) ?? false;
  return s.position === 0 || inPrev || nearEnd;
}

export interface DirectorState {
  phase: DirectorPhase;
  track: SpotifyTrack | null;
  index: number;
  total: number;
  positionMs: number;
  durationMs: number;
  /** Tracks remaining before the next DJ segment. */
  tracksUntilDj: number;
  /** Text of the most recent DJ segment (for the on-screen log). */
  lastSegment: string | null;
  /** Whether shuffle is currently on. */
  shuffle: boolean;
  /** Repeat mode: off / whole queue / single track. */
  repeat: RepeatMode;
  /** The current play order (so the booth can show the song list). */
  queue: SpotifyTrack[];
  error: string | null;
}

export interface SegmentContext {
  station: Station;
  justPlayed: SpotifyTrack | null;
  upNext: SpotifyTrack | null;
  index: number;
}

export interface DirectorDeps {
  player: RadioPlayer;
  station: Station;
  cadence: number;
  /** Speak a line; resolves when finished (or on a TTS error). */
  speak: (text: string, lang: Lang) => Promise<void>;
  /** Build the next DJ segment, or null to skip talking this time. */
  buildSegment: (ctx: SegmentContext) => Promise<DjSegment | null>;
  onState: (state: DirectorState) => void;
}

export class Director {
  private readonly deps: DirectorDeps;
  private queue: SpotifyTrack[] = [];
  /** Immutable original order, used to restore order when shuffle is turned off. */
  private original: SpotifyTrack[] = [];
  private shuffleOn = false;
  private repeatMode: RepeatMode = 'off';
  private index = -1;
  private phase: DirectorPhase = 'idle';
  private tracksSinceDj = 0;
  private positionMs = 0;
  private durationMs = 0;
  private lastSegment: string | null = null;
  private error: string | null = null;

  private ticker: number | null = null;
  private wasPlaying = false;
  private advancing = false;
  private userPaused = false;
  private stopped = true;
  private failures = 0;
  /** End-detection watchdog state (see tick / handleState). */
  private lastPos = -1;
  private stalledTicks = 0;
  private nullTicks = 0;

  constructor(deps: DirectorDeps) {
    this.deps = deps;
  }

  getState(): DirectorState {
    return {
      phase: this.phase,
      track: this.queue[this.index] ?? null,
      index: this.index,
      total: this.queue.length,
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      tracksUntilDj: Math.max(0, this.deps.cadence - this.tracksSinceDj),
      lastSegment: this.lastSegment,
      shuffle: this.shuffleOn,
      repeat: this.repeatMode,
      queue: this.queue,
      error: this.error,
    };
  }

  /** Connect the player as a Spotify device (no audio yet). */
  async prepare(): Promise<void> {
    this.setPhase('loading');
    // connect() also waits for the device to register. We deliberately do NOT
    // call a separate transfer here: Spotify often 403s a transfer to a brand-new
    // device, and playTrack() targets ?device_id= which activates it anyway.
    await this.deps.player.connect();
  }

  /** Begin the show. Call from a user gesture so audio is allowed to start. */
  async start(tracks: SpotifyTrack[], opts: { shuffle?: boolean } = {}): Promise<void> {
    if (!tracks.length) {
      this.fail('This playlist has no playable tracks.');
      return;
    }
    this.original = tracks.slice();
    this.shuffleOn = opts.shuffle ?? false;
    this.queue = this.shuffleOn ? shuffled(tracks) : tracks.slice();
    this.index = -1;
    this.tracksSinceDj = 0;
    this.failures = 0;
    this.stopped = false;
    this.userPaused = false;
    this.error = null;

    try {
      await this.deps.player.activate();
    } catch {
      // Non-fatal: desktop browsers generally allow audio after interaction.
    }
    await this.runIntro();
    if (this.stopped) return;
    await this.playIndex(0);
    this.startTicker();
  }

  /**
   * Turn shuffle on/off live, like any music player. Turning it on shuffles the
   * upcoming tracks (the current one keeps playing); turning it off restores the
   * original order from the current track onward.
   */
  setShuffle(on: boolean): void {
    if (on === this.shuffleOn) return;
    this.shuffleOn = on;
    const played = this.queue.slice(0, this.index + 1);
    if (on) {
      const upcoming = shuffled(this.queue.slice(this.index + 1));
      this.queue = [...played, ...upcoming];
    } else {
      // Rebuild upcoming from the original order, dropping anything already played.
      const playedUris = new Set(played.map((t) => t.uri));
      const upcoming = this.original.filter((t) => !playedUris.has(t.uri));
      this.queue = [...played, ...upcoming];
    }
    this.emit();
  }

  /** Cycle repeat like Spotify: off → all → one → off. Returns the new mode. */
  cycleRepeat(): RepeatMode {
    this.repeatMode =
      this.repeatMode === 'off' ? 'all' : this.repeatMode === 'all' ? 'one' : 'off';
    this.emit();
    return this.repeatMode;
  }

  /**
   * The index to play after the current track, or null to end the show.
   * `natural` = reached by a track finishing (honours repeat-one and stops at
   * the end when repeat is off); a manual skip always advances.
   */
  private computeNext(natural: boolean): number | null {
    if (natural && this.repeatMode === 'one') return this.index;
    const atEnd = this.index >= this.queue.length - 1;
    if (!atEnd) return this.index + 1;
    if (natural && this.repeatMode === 'off') return null; // stop at the end
    return 0; // repeat all, or a manual skip past the end → wrap
  }

  stop(): void {
    this.stopped = true;
    this.clearTicker();
    this.setPhase('idle');
    this.deps.player.pause().catch(() => {});
  }

  async pause(): Promise<void> {
    if (this.stopped) return;
    this.userPaused = true;
    this.clearTicker();
    this.setPhase('paused');
    await this.deps.player.pause().catch(() => {});
  }

  async resume(): Promise<void> {
    if (this.stopped || !this.userPaused) return;
    this.userPaused = false;
    this.setPhase('playingTrack');
    await this.deps.player.resume().catch(() => {});
    this.startTicker();
  }

  /** Skip straight to the next track (no DJ segment). */
  async skip(): Promise<void> {
    if (this.stopped || this.advancing) return;
    this.clearTicker();
    const next = this.computeNext(false) ?? 0;
    await this.playIndex(next);
    if (!this.userPaused) this.startTicker();
  }

  /**
   * Go back, like Spotify: if we're more than a few seconds into the track,
   * restart it; otherwise jump to the previous track (wrapping at the start).
   */
  async previous(): Promise<void> {
    if (this.stopped || this.advancing) return;
    this.clearTicker();
    const restartThreshold = 3000;
    const prev =
      this.positionMs > restartThreshold
        ? this.index
        : (this.index - 1 + this.queue.length) % this.queue.length;
    await this.playIndex(prev);
    if (!this.userPaused) this.startTicker();
  }

  // --- internals ---------------------------------------------------------

  private setPhase(phase: DirectorPhase): void {
    this.phase = phase;
    this.deps.onState(this.getState());
  }

  private emit(): void {
    this.deps.onState(this.getState());
  }

  private fail(message: string): void {
    this.error = message;
    this.setPhase('error');
  }

  private async runIntro(): Promise<void> {
    const intro = pick(this.deps.station.persona.intros);
    if (!intro) return;
    this.lastSegment = intro;
    this.setPhase('speaking');
    await this.deps.speak(intro, this.deps.station.lang).catch(() => {});
  }

  private async playIndex(i: number): Promise<void> {
    if (this.stopped) return;
    this.index = i;
    this.wasPlaying = false;
    this.positionMs = 0;
    this.durationMs = this.queue[i]?.durationMs ?? 0;
    this.lastPos = -1;
    this.stalledTicks = 0;
    this.nullTicks = 0;
    this.setPhase('playingTrack');
    try {
      await this.deps.player.playTrack(this.queue[i].uri);
      this.failures = 0;
    } catch (e) {
      // Skip an unplayable track (local file, region lock, …), but don't loop
      // forever if the whole playlist is unplayable.
      this.failures++;
      if (this.failures > this.queue.length) {
        this.fail((e as Error).message || 'No playable tracks in this playlist.');
        return;
      }
      await this.playIndex((i + 1) % this.queue.length);
    }
  }

  private async onTrackEnded(): Promise<void> {
    if (this.advancing || this.stopped || this.userPaused) return;
    this.advancing = true;
    this.clearTicker();
    try {
      const justPlayed = this.queue[this.index] ?? null;
      const nextIndex = this.computeNext(true);

      if (nextIndex === null) {
        // Reached the end with repeat off: sign off and stop.
        await withTimeout(this.runOutro(), SEGMENT_TIMEOUT_MS);
        if (!this.stopped) {
          this.stopped = true;
          this.setPhase('idle');
          await this.deps.player.pause().catch(() => {});
        }
        return;
      }

      const upNext = this.queue[nextIndex] ?? null;
      this.tracksSinceDj++;
      if (this.tracksSinceDj >= this.deps.cadence) {
        this.tracksSinceDj = 0;
        // A hung segment (e.g. a TTS engine that never fires onend) must never
        // freeze the show, so cap how long the DJ bit can take.
        await withTimeout(this.runSegment(justPlayed, upNext), SEGMENT_TIMEOUT_MS);
      }

      if (!this.stopped) await this.playIndex(nextIndex);
    } catch {
      // Never let a failed segment/handoff strand the show — advance anyway.
      if (!this.stopped) {
        const fallback = (this.index + 1) % this.queue.length;
        await this.playIndex(fallback).catch(() => {});
      }
    } finally {
      this.advancing = false;
      if (!this.stopped && !this.userPaused) this.startTicker();
    }
  }

  private async runOutro(): Promise<void> {
    const outro = pick(this.deps.station.persona.outros);
    if (!outro) return;
    this.lastSegment = outro;
    this.setPhase('speaking');
    await this.deps.speak(outro, this.deps.station.lang).catch(() => {});
  }

  private async runSegment(
    justPlayed: SpotifyTrack | null,
    upNext: SpotifyTrack | null,
  ): Promise<void> {
    this.setPhase('gap');
    await this.deps.player.pause().catch(() => {});
    let segment: DjSegment | null = null;
    try {
      segment = await this.deps.buildSegment({
        station: this.deps.station,
        justPlayed,
        upNext,
        index: this.index,
      });
    } catch {
      segment = null;
    }
    if (this.stopped || !segment || !segment.text.trim()) return;
    this.lastSegment = segment.text;
    this.setPhase('speaking');
    await this.deps.speak(segment.text, segment.lang).catch(() => {});
  }

  private startTicker(): void {
    this.clearTicker();
    this.ticker = window.setInterval(() => void this.tick(), TICK_MS);
  }

  private clearTicker(): void {
    if (this.ticker != null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  /**
   * Authoritative end-of-track signal from the SDK's player_state_changed
   * event. This fires reliably at the transition even when getCurrentState()
   * subsequently returns null (which happens when a single-track URI ends and
   * the device goes idle — the exact case that used to freeze the show).
   */
  handleState(s: Spotify.PlaybackState | null): void {
    if (!s || this.phase !== 'playingTrack' || this.stopped || this.userPaused || this.advancing) {
      return;
    }
    const current = s.track_window?.current_track;
    const expected = this.queue[this.index]?.uri;
    if (!current || current.uri !== expected) return;

    this.positionMs = s.position;
    if (s.duration) this.durationMs = s.duration;
    if (!s.paused) this.wasPlaying = true;
    this.emit();

    if (isTrackEnd(s, expected, this.wasPlaying)) {
      void this.onTrackEnded();
    }
  }

  private async tick(): Promise<void> {
    if (this.phase !== 'playingTrack' || this.stopped || this.userPaused || this.advancing) {
      return;
    }
    const s = await this.deps.player.getState();

    if (!s) {
      // No state while we believe we're playing: a finished single track makes
      // the device go idle and getCurrentState() return null. After a few
      // seconds of that, treat the track as ended so the show never freezes.
      if (this.wasPlaying && ++this.nullTicks >= 3) {
        this.nullTicks = 0;
        void this.onTrackEnded();
      }
      return;
    }
    this.nullTicks = 0;
    this.positionMs = s.position;
    this.durationMs = s.duration;
    this.emit();

    const current = s.track_window?.current_track;
    const expected = this.queue[this.index]?.uri;
    if (!current || current.uri !== expected) return; // stale / transitioning

    if (!s.paused) {
      this.wasPlaying = true;
      // Stall watchdog: if the position stops advancing for ~8s mid-track, the
      // SDK has wedged — advance rather than freeze.
      if (s.position === this.lastPos) {
        if (++this.stalledTicks >= 8) {
          this.stalledTicks = 0;
          void this.onTrackEnded();
          return;
        }
      } else {
        this.stalledTicks = 0;
      }
      this.lastPos = s.position;
    }

    if (isTrackEnd(s, expected, this.wasPlaying)) {
      void this.onTrackEnded();
    }
  }
}
