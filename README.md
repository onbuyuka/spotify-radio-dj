# 📻 RadioDJ

A personal radio in the browser. It plays **your Spotify playlist** and drops an
AI **DJ** between the tracks — reading the headlines, scores, weather and a fact or
two about the song that just played. Pick a **station** (each has its own voice and
persona), pick a playlist, press play.

> Desktop browser + **Spotify Premium** required. This is a personal project shared
> with a handful of friends — not an App Store / production app.

## How it works

The browser is a **conductor**, not a music player:

- **Spotify Web Playback SDK** turns the tab into a Spotify Connect device and plays
  full songs. (Songs are DRM-protected, so the app never touches the audio — the DJ
  speaks **between** tracks, not over them.)
- Between songs, the app builds a short script from **data sources** and speaks it
  with **text-to-speech** (the free Web Speech API to start; swappable later).
- A **station** bundles a language, a voice and a persona. Switching station changes
  the DJ.

## Tech

Vite + React 19 + TypeScript, Tailwind (CDN), HashRouter. Static site deployed to
GitHub Pages. Mirrors the structure of the other static apps in this workspace.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://127.0.0.1:3000 |
| `npm run build` | Production bundle to `dist/` |
| `npm test` | Run unit tests (Vitest) |
| `npm run build:feed` | Build the data snapshot (`public/feed.json`) |
| `npm run deploy` | Build + publish to the `gh-pages` branch |

## Status

Under construction, phase by phase. Audio loop (Spotify control → gap → DJ → next
track) is being de-risked first.

## Setup for friends

Coming with the first deploy: log in with your own Spotify Premium account (your
email must be added to the app's allow-list first), choose a playlist, hit play.
