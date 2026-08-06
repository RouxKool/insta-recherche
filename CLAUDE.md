# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A search tool over past Instagram posts for Tataki's media team, so they can answer "have we already covered topic X?" Static site (GitHub Pages) + a data-refresh pipeline (GitHub Actions cron) that pulls from the Instagram Graph API. No backend, no external accounts beyond Instagram/Meta.

Current search is keyword/substring matching in the browser, not semantic — see "Passer à une vraie recherche sémantique plus tard" in README.md for the planned upgrade path (embeddings via an API, requiring a server-side function to hide the key, since GitHub Pages is 100% static).

**Statut actuel :** projet standalone pour l'instant (repo Node.js indépendant, hébergé sur GitHub Pages). Une migration vers Chough (plateforme interne SRG pour prototypes, Next.js/TypeScript sur Kubernetes) est envisagée plus tard, une fois l'accès au repo Chough obtenu. La logique du pipeline (fetch Instagram, filtrage, écriture des données) est volontairement peu couplée à l'hébergement statique pour rester portable vers une future API route Next.js.

## Commands

```bash
npm install
cp .env.example .env              # fill in INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID

npm run fetch                     # = node scripts/fetch-posts.js — refresh data/posts.json from the Instagram API
npm run dev                       # = npx serve . — required to preview locally; opening index.html directly breaks fetch("data/posts.json")
```

There is no build step, bundler, linter, or test suite — plain HTML/CSS/JS served as-is.

## Architecture

```
GitHub Actions (.github/workflows/update-posts.yml, cron every 3 days at 05:00 UTC, or manual dispatch)
   → scripts/fetch-posts.js calls scripts/lib/instagram.js
   → pulls carousels + Reels from the Instagram Graph API (paginated), keeps only posts >= 2024-01-01
   → fetches like/comment counts (free, same request) and reach (Insights API, batched 50/request)
   → writes data/posts.json, commits + pushes if changed
   → push to main triggers GitHub Pages republish

GitHub Pages (static site)
   → index.html / app.js / style.css / data/posts.json
   → app.js fetches data/posts.json and does all searching/filtering client-side
```

### Search logic (app.js)

Deliberately substring/keyword matching, not fuzzy (a generic fuzzy matcher like Fuse.js misses obvious literal matches in long captions — this was a considered tradeoff, not an oversight). Query is split on commas into multiple keywords (OR logic, for covering several rephrasings of one topic in a single search); each keyword is split into words. Posts ranked: exact phrase match (rank 0) beats all-words-present match (rank 1), then sorted by date. Accent/case-insensitive via `normalize()`.

### Data pipeline (scripts/)

- `fetch-posts.js` — orchestrates: fetch posts → filter by `MIN_DATE` (2024-01-01, older content is off current editorial line) → fetch reach → write `data/posts.json`.
- `lib/instagram.js` — Graph API client. `fetchPosts` paginates through `/media`, keeps only `CAROUSEL_ALBUM` and `REELS` (plain image posts are out of scope). `fetchReachByPostId` uses the Graph API batch endpoint (50 sub-requests/call) to fetch reach cheaply at scale; failures are per-post and non-fatal (`reach: null`), except if the *first* batch fails entirely on a permission error, in which case reach fetching is skipped for the rest of the run rather than repeating a call that will keep failing the same way.

### Data shape (`data/posts.json`)

See the schema in README.md. Key gotcha: `thumbnail_url`/`media_url` from the Instagram API are signed CDN links that expire in hours to ~24h — thumbnails only stay fresh because of the recurring cron; if the site goes several days without a data refresh, some old thumbnails may stop loading.

## Known constraints

- Instagram long-lived access tokens expire after 60 days and must be refreshed manually (see README.md "Instagram Graph API" section), then the `INSTAGRAM_ACCESS_TOKEN` GitHub secret updated.
- Reach requires the `instagram_manage_insights` permission on the token; without it, `reach` stays `null` everywhere but the rest of the pipeline still succeeds.
- `data/posts.json` is committed to git and can get large (currently ~5MB) — this is intentional (zero external storage/account needed), not an oversight to fix.
