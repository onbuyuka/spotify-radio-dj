import type { SpotifyTrack, Station, DjSegment, SongTrivia } from '../types';
import type { SegmentContext } from '../components/Director';
import { pick, uid } from './random';
import { FUN_FACTS } from '../data/funFacts';

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
 * Build a DJ segment for a single source id, or null if it has nothing to say.
 */
function buildForSource(sourceId: string, ctx: SegmentContext): DjSegment | null {
  switch (sourceId) {
    case 'song':
      return buildSongSegment(ctx.station, ctx.justPlayed, ctx.upNext);
    case 'fact':
      return buildFactSegment(ctx.station);
    default:
      return null;
  }
}

/**
 * Create a segment builder that round-robins through the enabled source ids,
 * trying each in turn until one yields a segment. Falls back to the song source
 * so the DJ always has something to say.
 */
export function createSegmentBuilder(
  sourceIds: string[],
): (ctx: SegmentContext) => Promise<DjSegment | null> {
  const ids = sourceIds.length ? sourceIds.slice() : ['song'];
  let cursor = 0;
  return async (ctx: SegmentContext) => {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[(cursor + i) % ids.length];
      const seg = buildForSource(id, ctx);
      if (seg && seg.text.trim()) {
        cursor = (cursor + i + 1) % ids.length;
        return seg;
      }
    }
    return buildSongSegment(ctx.station, ctx.justPlayed, ctx.upNext);
  };
}
