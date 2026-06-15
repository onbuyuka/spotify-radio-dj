import { describe, it, expect } from 'vitest';
import { getStation } from '../data/stations';
import {
  buildSongSegment,
  songTrivia,
  buildFactSegment,
  buildNewsSegment,
  buildSportsSegment,
  buildWeatherSegment,
  createSegmentBuilder,
} from '../utils/segments';
import { chunkText } from '../utils/tts';
import { shuffled } from '../utils/random';
import { normalizeState, defaultState } from '../utils/storage';
import type { SpotifyTrack, FeedSnapshot } from '../types';

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

function feed(over: Partial<FeedSnapshot> = {}): FeedSnapshot {
  return {
    updated: '2026-06-15T00:00:00Z',
    news: [
      { title: 'Türkçe başlık', source: 'NTV', lang: 'tr' },
      { title: 'World headline', source: 'BBC World', lang: 'en' },
    ],
    sports: [{ league: 'Süper Lig', home: 'A', away: 'B', homeScore: 2, awayScore: 1, status: 'FT' }],
    weather: [{ place: 'İstanbul', tempC: 26, description: 'clear sky', high: 27, low: 18 }],
    facts: [],
    ...over,
  };
}

describe('buildNewsSegment', () => {
  const en = getStation('night-owl');
  it('speaks a Turkish headline in Turkish (item language, not station)', () => {
    const seg = buildNewsSegment(en, { title: 'Deneme', source: 'NTV', lang: 'tr' });
    expect(seg.lang).toBe('tr');
    expect(seg.text).toContain('Deneme');
    expect(seg.text).toContain('NTV');
  });
  it('speaks an English headline in English', () => {
    const seg = buildNewsSegment(en, { title: 'Hello', source: 'BBC', lang: 'en' });
    expect(seg.lang).toBe('en');
    expect(seg.text).toContain('From BBC');
  });
});

describe('buildSportsSegment / buildWeatherSegment', () => {
  const tr = getStation('radyo-gece');
  const en = getStation('night-owl');
  it('formats a score in the station language', () => {
    const s = buildSportsSegment(en, { league: 'EPL', home: 'X', away: 'Y', homeScore: 3, awayScore: 0, status: 'FT' });
    expect(s.lang).toBe('en');
    expect(s.text).toContain('X 3');
    expect(s.text).toContain('Y 0');
  });
  it('formats weather in Turkish for a Turkish station', () => {
    const w = buildWeatherSegment(tr, { place: 'İstanbul', tempC: 20, description: 'clear sky' });
    expect(w.lang).toBe('tr');
    expect(w.text).toContain('İstanbul');
    expect(w.text).toContain('20');
  });
});

describe('createSegmentBuilder with a feed', () => {
  const en = getStation('night-owl');
  const ctx = { station: en, justPlayed: track(), upNext: track(), index: 0 };

  it('pulls Turkish news for news-tr and English for news-world', async () => {
    const build = createSegmentBuilder(['news-tr', 'news-world'], feed());
    const a = await build(ctx);
    const b = await build(ctx);
    const byLang = Object.fromEntries([a, b].map((s) => [s!.lang, s!.text]));
    expect(byLang.tr).toContain('Türkçe başlık');
    expect(byLang.en).toContain('World headline');
  });

  it('skips a feed source with no items and still returns a segment', async () => {
    const build = createSegmentBuilder(['sports'], feed({ sports: [] }));
    const seg = await build(ctx);
    expect(seg!.sourceId).toBe('song'); // fell back
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
