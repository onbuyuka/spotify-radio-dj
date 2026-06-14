import type { SourceMeta } from '../types';

// Registry of DJ data sources. The Play page renders a picker from this list;
// only `available` sources can be toggled on. News/sports/weather flip to
// available once the snapshot pipeline (scripts/buildFeed.mjs) lands.

export interface SourceDef extends SourceMeta {
  /** Short blurb shown in the picker. */
  blurb: string;
  /** Whether this source is wired up yet. */
  available: boolean;
}

export const SOURCES: SourceDef[] = [
  {
    id: 'song',
    label: 'Song facts',
    kind: 'song',
    lang: 'any',
    blurb: 'A line about the track that just played and what’s next.',
    available: true,
  },
  {
    id: 'fact',
    label: 'Fun facts',
    kind: 'fact',
    lang: 'any',
    blurb: 'A short, surprising fact between songs.',
    available: true,
  },
  {
    id: 'news-tr',
    label: 'Türkçe haberler',
    kind: 'news',
    lang: 'tr',
    blurb: 'Turkish headlines (coming with the news feed).',
    available: false,
  },
  {
    id: 'news-world',
    label: 'World news',
    kind: 'news',
    lang: 'en',
    blurb: 'International headlines (coming with the news feed).',
    available: false,
  },
  {
    id: 'sports',
    label: 'Sports scores',
    kind: 'sports',
    lang: 'any',
    blurb: 'Latest scores (coming with the snapshot feed).',
    available: false,
  },
  {
    id: 'weather',
    label: 'Weather',
    kind: 'weather',
    lang: 'any',
    blurb: 'Today’s forecast (coming with the snapshot feed).',
    available: false,
  },
];

export const AVAILABLE_SOURCES = SOURCES.filter((s) => s.available);

export function getSource(id: string): SourceDef | undefined {
  return SOURCES.find((s) => s.id === id);
}
