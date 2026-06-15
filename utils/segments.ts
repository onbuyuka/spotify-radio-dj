import type {
  SpotifyTrack,
  Station,
  DjSegment,
  SongTrivia,
  FeedSnapshot,
  NewsItem,
  ScoreItem,
  WeatherItem,
} from '../types';
import type { SegmentContext } from '../components/Director';
import { pick, uid } from './random';
import { FUN_FACTS } from '../data/funFacts';
import { EMPTY_FEED } from './feed';

// DJ segment builders. Each source turns the current context into a short spoken
// line. `createSegmentBuilder` rotates through the enabled sources so the DJ
// varies what it talks about between songs.

export function songTrivia(track: SpotifyTrack): SongTrivia {
  return {
    track: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    album: track.album?.name,
    releaseDate: track.album?.releaseDate,
  };
}

export function buildSongSegment(
  station: Station,
  justPlayed: SpotifyTrack | null,
  upNext: SpotifyTrack | null,
): DjSegment | null {
  if (!justPlayed && !upNext) return null;
  const isTr = station.lang === 'tr';
  const lines: string[] = [];

  if (justPlayed) {
    const t = songTrivia(justPlayed);
    const year = t.releaseDate ? t.releaseDate.slice(0, 4) : '';
    lines.push(
      isTr
        ? `Az önce ${t.artist} imzalı ${t.track} vardı${year ? `, ${year} yılından` : ''}.`
        : `That was ${t.track} by ${t.artist}${year ? `, from ${year}` : ''}.`,
    );
  }

  const transition = pick(station.persona.transitions);
  if (transition) lines.push(transition);

  if (upNext) {
    const artist = upNext.artists.map((a) => a.name).join(', ');
    lines.push(isTr ? `Sırada ${artist} var.` : `Up next, ${artist}.`);
  }

  return {
    id: uid(),
    stationId: station.id,
    sourceId: 'song',
    text: lines.join(' '),
    lang: station.lang,
    createdAt: new Date().toISOString(),
  };
}

/** A fun-fact bit, optionally lead in with a station transition line. */
export function buildFactSegment(station: Station): DjSegment | null {
  const fact = pick(FUN_FACTS[station.lang]);
  if (!fact) return null;
  const isTr = station.lang === 'tr';
  const lead = pick(station.persona.transitions);
  const opener = isTr ? 'Bunu biliyor muydunuz?' : 'Here’s one for you.';
  return {
    id: uid(),
    stationId: station.id,
    sourceId: 'fact',
    text: [lead, opener, fact].filter(Boolean).join(' '),
    lang: station.lang,
    createdAt: new Date().toISOString(),
  };
}

/**
 * A news headline. Spoken in the HEADLINE's language (not the station's) so a
 * Turkish headline gets the Turkish voice and an English one the English voice.
 */
export function buildNewsSegment(station: Station, item: NewsItem): DjSegment {
  const isTr = item.lang === 'tr';
  const lead = isTr ? `${item.source}'tan haber.` : `From ${item.source}.`;
  return {
    id: uid(),
    stationId: station.id,
    sourceId: 'news',
    text: `${lead} ${item.title}`,
    lang: item.lang,
    createdAt: new Date().toISOString(),
  };
}

/** A sports score, spoken in the station's language. */
export function buildSportsSegment(station: Station, item: ScoreItem): DjSegment {
  const isTr = station.lang === 'tr';
  const hasScore = item.homeScore != null && item.awayScore != null;
  let text: string;
  if (hasScore) {
    text = isTr
      ? `${item.league}'de ${item.home} ${item.homeScore}, ${item.away} ${item.awayScore}.`
      : `In the ${item.league}: ${item.home} ${item.homeScore}, ${item.away} ${item.awayScore}.`;
  } else {
    text = isTr
      ? `${item.league}'de ${item.home}, ${item.away} ile karşılaşıyor.`
      : `In the ${item.league}: ${item.home} versus ${item.away}.`;
  }
  return {
    id: uid(),
    stationId: station.id,
    sourceId: 'sports',
    text,
    lang: station.lang,
    createdAt: new Date().toISOString(),
  };
}

/** Today's weather for a place, spoken in the station's language. */
export function buildWeatherSegment(station: Station, item: WeatherItem): DjSegment {
  const isTr = station.lang === 'tr';
  const text = isTr
    ? `${item.place}'da hava ${item.tempC} derece, ${item.description}.`
    : `In ${item.place}, it's ${item.tempC} degrees and ${item.description}.`;
  return {
    id: uid(),
    stationId: station.id,
    sourceId: 'weather',
    text,
    lang: station.lang,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a segment builder that round-robins through the enabled source ids,
 * pulling news/sports/weather from the data feed and rotating through items so
 * the DJ doesn't repeat itself. Falls back to the song source so the DJ always
 * has something to say.
 */
export function createSegmentBuilder(
  sourceIds: string[],
  feed: FeedSnapshot = EMPTY_FEED,
): (ctx: SegmentContext) => Promise<DjSegment | null> {
  const ids = sourceIds.length ? sourceIds.slice() : ['song'];
  let cursor = 0;
  // Per-source item counters so successive segments cycle through the feed.
  const itemAt: Record<string, number> = {};
  const trNews = feed.news.filter((n) => n.lang === 'tr');
  const enNews = feed.news.filter((n) => n.lang === 'en');

  const next = <T>(key: string, arr: readonly T[]): T | undefined => {
    if (!arr.length) return undefined;
    const i = itemAt[key] ?? 0;
    itemAt[key] = i + 1;
    return arr[i % arr.length];
  };

  const build = (id: string, ctx: SegmentContext): DjSegment | null => {
    switch (id) {
      case 'song':
        return buildSongSegment(ctx.station, ctx.justPlayed, ctx.upNext);
      case 'fact':
        return buildFactSegment(ctx.station);
      case 'news-tr': {
        const item = next('news-tr', trNews);
        return item ? buildNewsSegment(ctx.station, item) : null;
      }
      case 'news-world': {
        const item = next('news-world', enNews);
        return item ? buildNewsSegment(ctx.station, item) : null;
      }
      case 'sports': {
        const item = next('sports', feed.sports);
        return item ? buildSportsSegment(ctx.station, item) : null;
      }
      case 'weather': {
        const item = next('weather', feed.weather);
        return item ? buildWeatherSegment(ctx.station, item) : null;
      }
      default:
        return null;
    }
  };

  return async (ctx: SegmentContext) => {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[(cursor + i) % ids.length];
      const seg = build(id, ctx);
      if (seg && seg.text.trim()) {
        cursor = (cursor + i + 1) % ids.length;
        return seg;
      }
    }
    return buildSongSegment(ctx.station, ctx.justPlayed, ctx.upNext);
  };
}
