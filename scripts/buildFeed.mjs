// Builds public/feed.json — the DJ's data snapshot: news headlines (Turkish +
// world), sports scores, and weather. Run server-side (Node, no CORS) so the
// static site just reads the JSON same-origin. Every source is best-effort:
// a failing feed is skipped, never fatal.
//
// Usage:  node scripts/buildFeed.mjs
// Output: public/feed.json  { updated, news[], sports[], weather[], facts[] }
//
// The scheduled GitHub Action overrides FEED_OUT to write straight to the
// gh-pages branch so the live site refreshes without a rebuild.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.FEED_OUT
  ? resolve(process.env.FEED_OUT)
  : resolve(__dirname, '..', 'public', 'feed.json');

const UA = 'Mozilla/5.0 (RadioDJ feed builder; +https://github.com/onbuyuka/spotify-radio-dj)';
const PER_FEED = 6; // headlines kept per outlet
const NEWS_CAP = 40; // total headlines kept

// --- RSS news feeds -------------------------------------------------------
// lang drives which station speaks them. Verified reachable at build time;
// unreachable ones are simply skipped.
const NEWS_FEEDS = [
  { source: 'BBC Türkçe', lang: 'tr', url: 'https://feeds.bbci.co.uk/turkce/rss.xml' },
  { source: 'NTV', lang: 'tr', url: 'https://www.ntv.com.tr/gundem.rss' },
  { source: 'Habertürk', lang: 'tr', url: 'https://www.haberturk.com/rss' },
  { source: 'BBC World', lang: 'en', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { source: 'Al Jazeera', lang: 'en', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { source: 'NPR', lang: 'en', url: 'https://feeds.npr.org/1001/rss.xml' },
  { source: 'The Guardian', lang: 'en', url: 'https://www.theguardian.com/world/rss' },
];

// --- Sports (TheSportsDB free "123" key) ----------------------------------
// A broad list of big competitions. Whatever is IN SEASON surfaces; out-of-
// season leagues are dropped by the freshness window below (so we never narrate
// a month-old game as if it's news). Order = rough priority.
const SPORTS_LEAGUES = [
  { id: 4429, league: 'World Cup' }, // in season Jun–Jul 2026
  { id: 4339, league: 'Süper Lig' },
  { id: 4328, league: 'Premier League' },
  { id: 4335, league: 'La Liga' },
  { id: 4331, league: 'Bundesliga' },
  { id: 4332, league: 'Serie A' },
];

// Only narrate results from the last this-many days; older games are stale.
const SPORTS_MAX_AGE_DAYS = 2;
// Cap total games kept across all leagues.
const SPORTS_CAP = 12;

// --- Weather (Open-Meteo, no key) -----------------------------------------
const WEATHER_PLACES = [
  { place: 'İstanbul', lat: 41.0082, lon: 28.9784 },
  { place: 'London', lat: 51.5072, lon: -0.1276 },
];

// WMO weather code → short description.
const WMO = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'rime fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'violent rain showers',
  85: 'snow showers', 86: 'snow showers', 95: 'thunderstorm',
  96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

const FUN_FACTS = [
  'Honey never spoils — edible honey has been found in ancient tombs.',
  'Octopuses have three hearts.',
  'A day on Venus is longer than its year.',
  'Sharks are older than trees.',
  'Bananas are berries; strawberries are not.',
];

// --- helpers --------------------------------------------------------------

/** Decode the handful of XML entities that show up in RSS titles. */
function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the first capture group of a tag from an RSS <item> block. */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : undefined;
}

/** Parse an RSS/Atom string into [{ title, summary, link, publishedAt }]. */
function parseRss(xml) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const title = tag(b, 'title');
    if (!title) continue;
    out.push({
      title,
      summary: tag(b, 'description') || tag(b, 'summary'),
      link: tag(b, 'link'),
      publishedAt: tag(b, 'pubDate') || tag(b, 'updated'),
    });
  }
  return out;
}

async function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// --- collectors -----------------------------------------------------------

async function collectNews() {
  const news = [];
  for (const feed of NEWS_FEEDS) {
    try {
      const xml = await fetchText(feed.url);
      const items = parseRss(xml).slice(0, PER_FEED);
      for (const it of items) {
        news.push({
          title: it.title,
          summary: it.summary ? it.summary.slice(0, 240) : undefined,
          source: feed.source,
          lang: feed.lang,
          link: it.link,
          publishedAt: it.publishedAt,
        });
      }
      console.log(`  news: ${feed.source} → ${items.length}`);
    } catch (e) {
      console.warn(`  news: ${feed.source} FAILED (${e.message})`);
    }
  }
  return news.slice(0, NEWS_CAP);
}

/** Calendar dates (YYYY-MM-DD, UTC) from today back `days` days, inclusive. */
function recentDates(days) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i <= days; i++) {
    out.push(new Date(now - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

async function collectSports() {
  const cutoff = Date.now() - SPORTS_MAX_AGE_DAYS * 86_400_000;
  const dates = recentDates(Math.ceil(SPORTS_MAX_AGE_DAYS));
  const seen = new Set();
  const collected = [];

  // Sweep each league day-by-day via eventsday (richer than eventspastleague,
  // which only returns one game on the free tier). Gives every finished and
  // upcoming fixture for the league on that date.
  for (const lg of SPORTS_LEAGUES) {
    let count = 0;
    for (const date of dates) {
      try {
        const j = await fetchJson(
          `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}&l=${lg.id}`,
        );
        for (const e of j.events || []) {
          const id = e.idEvent || `${e.strHomeTeam}-${e.strAwayTeam}-${e.dateEvent}`;
          if (seen.has(id)) continue;
          const t = Date.parse(e.dateEvent || '');
          if (!Number.isFinite(t) || t < cutoff) continue;
          seen.add(id);
          const hasScore = e.intHomeScore != null && e.intAwayScore != null;
          collected.push({
            ts: t,
            league: lg.league,
            home: e.strHomeTeam,
            away: e.strAwayTeam,
            homeScore: hasScore ? Number(e.intHomeScore) : undefined,
            awayScore: hasScore ? Number(e.intAwayScore) : undefined,
            status: hasScore ? 'FT' : 'upcoming',
            date: e.dateEvent,
          });
          count++;
        }
      } catch (e) {
        console.warn(`  sports: ${lg.league} ${date} FAILED (${e.message})`);
      }
      await new Promise((r) => setTimeout(r, 1200)); // free tier: ~30 req/min
    }
    console.log(`  sports: ${lg.league} → ${count}`);
  }

  // Newest first; finished games before same-day upcoming fixtures.
  collected.sort(
    (a, b) => b.ts - a.ts || (a.status === 'FT' ? 0 : 1) - (b.status === 'FT' ? 0 : 1),
  );
  return collected.slice(0, SPORTS_CAP).map(({ ts, ...rest }) => rest);
}

async function collectWeather() {
  const weather = [];
  for (const p of WEATHER_PLACES) {
    try {
      const j = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
          `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
      );
      const tempC = Math.round(j.current?.temperature_2m ?? 0);
      const code = j.current?.weather_code ?? 0;
      weather.push({
        place: p.place,
        tempC,
        description: WMO[code] || 'unknown',
        high: j.daily?.temperature_2m_max?.[0] != null ? Math.round(j.daily.temperature_2m_max[0]) : undefined,
        low: j.daily?.temperature_2m_min?.[0] != null ? Math.round(j.daily.temperature_2m_min[0]) : undefined,
      });
      console.log(`  weather: ${p.place} → ${tempC}°C ${WMO[code] || ''}`);
    } catch (e) {
      console.warn(`  weather: ${p.place} FAILED (${e.message})`);
    }
  }
  return weather;
}

// --- main -----------------------------------------------------------------

async function main() {
  console.log('Building feed…');
  const [news, sports, weather] = await Promise.all([
    collectNews(),
    collectSports(),
    collectWeather(),
  ]);

  const feed = {
    updated: new Date().toISOString(),
    news,
    sports,
    weather,
    facts: FUN_FACTS.map((text) => ({ text })),
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(feed, null, 2));
  console.log(
    `Wrote ${OUT}: ${news.length} news, ${sports.length} scores, ${weather.length} weather.`,
  );
}

main().catch((e) => {
  console.error('Feed build failed:', e);
  process.exit(1);
});
