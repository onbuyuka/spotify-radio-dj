import { describe, it, expect } from 'vitest';
import { getStation } from '../data/stations';
import {
  buildSongSegment,
  songTrivia,
  buildFactSegment,
  createSegmentBuilder,
} from '../utils/segments';
import { chunkText } from '../utils/tts';
import { shuffled } from '../utils/random';
import { normalizeState, defaultState } from '../utils/storage';
import type { SpotifyTrack } from '../types';

function track(over: Partial<SpotifyTrack> = {}): SpotifyTrack {
  return {
    id: '1',
    uri: 'spotify:track:1',
    name: 'Song A',
    durationMs: 200_000,
    artists: [{ id: 'a', name: 'Artist X' }],
    album: { name: 'Album One', releaseDate: '1999-05-01' },
    ...over,
  };
}

describe('songTrivia', () => {
  it('joins multiple artists and surfaces album + release date', () => {
    const t = songTrivia(
      track({ artists: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }),
    );
    expect(t.artist).toBe('A, B');
    expect(t.album).toBe('Album One');
    expect(t.releaseDate).toBe('1999-05-01');
  });
});

describe('buildSongSegment', () => {
  const en = getStation('night-owl');
  const tr = getStation('radyo-gece');

  it('returns null when there is nothing to talk about', () => {
    expect(buildSongSegment(en, null, null)).toBeNull();
  });

  it('builds an English recap with artist and year', () => {
    const seg = buildSongSegment(en, track(), track({ artists: [{ id: 'y', name: 'Artist Y' }] }));
    expect(seg).not.toBeNull();
    expect(seg!.lang).toBe('en');
    expect(seg!.text).toContain('That was Song A by Artist X');
    expect(seg!.text).toContain('from 1999');
    expect(seg!.text).toContain('Up next, Artist Y.');
  });

  it('builds a Turkish recap', () => {
    const seg = buildSongSegment(tr, track(), null);
    expect(seg!.lang).toBe('tr');
    expect(seg!.text).toContain('Az önce Artist X imzalı Song A');
    expect(seg!.text).toContain('1999 yılından');
  });

  it('omits the year when the release date is missing', () => {
    const seg = buildSongSegment(en, track({ album: { name: 'X' } }), null);
    expect(seg!.text).toContain('That was Song A by Artist X');
    expect(seg!.text).not.toContain('from');
  });
});

describe('chunkText', () => {
  it('returns nothing for blank input', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('keeps a short line as a single chunk', () => {
    expect(chunkText('Hello there.')).toEqual(['Hello there.']);
  });

  it('splits long text into chunks within the cap', () => {
    const sentence = 'This is a fairly long sentence that keeps going and going. ';
    const chunks = chunkText(sentence.repeat(8));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(180);
  });
});

describe('shuffled', () => {
  it('keeps the same elements without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]); // original untouched
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffled([])).toEqual([]);
    expect(shuffled([7])).toEqual([7]);
  });
});

describe('buildFactSegment', () => {
  it('produces a non-empty fact line in the station language', () => {
    const seg = buildFactSegment(getStation('radyo-gece'));
    expect(seg).not.toBeNull();
    expect(seg!.lang).toBe('tr');
    expect(seg!.sourceId).toBe('fact');
    expect(seg!.text.length).toBeGreaterThan(10);
  });
});

describe('createSegmentBuilder', () => {
  const en = getStation('night-owl');
  const ctx = { station: en, justPlayed: track(), upNext: track(), index: 0 };

  it('falls back to the song source when given none', async () => {
    const build = createSegmentBuilder([]);
    const seg = await build(ctx);
    expect(seg!.sourceId).toBe('song');
  });

  it('rotates across enabled sources on successive calls', async () => {
    const build = createSegmentBuilder(['song', 'fact']);
    const first = await build(ctx);
    const second = await build(ctx);
    expect(new Set([first!.sourceId, second!.sourceId])).toEqual(new Set(['song', 'fact']));
  });
});

describe('normalizeState', () => {
  it('falls back to defaults for empty input', () => {
    expect(normalizeState(undefined)).toEqual(defaultState());
  });

  it('coerces an invalid cadence and keeps a valid client id', () => {
    const s = normalizeState({ settings: { cadence: -3, spotifyClientId: ' abc ' } });
    expect(s.settings.cadence).toBe(3);
    expect(s.settings.spotifyClientId).toBe('abc');
  });

  it('floors a fractional cadence and drops a non-boolean source map', () => {
    const s = normalizeState({ settings: { cadence: 2.8, enabledSources: { x: 'yes' } } });
    expect(s.settings.cadence).toBe(2);
    expect(s.settings.enabledSources).toEqual({});
  });
});
