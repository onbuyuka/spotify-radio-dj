import type { FeedSnapshot } from '../types';

// Loads the DJ data snapshot (public/feed.json) built server-side by
// scripts/buildFeed.mjs. Read once when the booth opens; the scheduled GitHub
// Action keeps the deployed file fresh.

function feedUrl(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base.replace(/\/$/, '')}/feed.json`;
}

const EMPTY: FeedSnapshot = { updated: '', news: [], sports: [], weather: [], facts: [] };

/** Fetch the snapshot; returns an empty feed (never throws) if unavailable. */
export async function loadFeed(): Promise<FeedSnapshot> {
  try {
    const res = await fetch(`${feedUrl()}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return EMPTY;
    const json = (await res.json()) as Partial<FeedSnapshot>;
    return {
      updated: typeof json.updated === 'string' ? json.updated : '',
      news: Array.isArray(json.news) ? json.news : [],
      sports: Array.isArray(json.sports) ? json.sports : [],
      weather: Array.isArray(json.weather) ? json.weather : [],
      facts: Array.isArray(json.facts) ? json.facts : [],
    };
  } catch {
    return EMPTY;
  }
}

export const EMPTY_FEED = EMPTY;
