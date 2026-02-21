# App Vitals — Initial Brainstorm

**Date:** 2026-02-21
**Status:** Captured

---

## What We're Building

A web app that fetches metadata from the Apple App Store and Google Play Store, displays it in a clean UI, and eventually allows comparison against competitor apps.

**MVP scope:** Fetch and display basic metadata for a single app (ratings, review count, version, developer info) from both stores.

---

## Why This Approach

Start with the simplest possible thing: a search or lookup page where you enter an app identifier and see its store metadata. No auth, no database, no accounts — just fetch-and-display. This validates the data layer (store APIs/scrapers) before building anything complex on top.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Stack | Next.js (React) | Full-stack in one framework; API routes for store fetching; good ecosystem |
| Team | Solo | Simpler branching, no PR reviews required |
| Principles | Test-first, YAGNI | Build only what's needed; tests alongside features |
| Phase 1 scope | Metadata fetch + display | Validate data sources before analytics |

---

## Phased Roadmap

### Phase 1 — Metadata MVP
- Scaffold Next.js app
- Fetch App Store metadata (app ID → name, rating, review count, version, developer)
- Fetch Google Play metadata (same fields)
- Display results in a basic UI

### Phase 2 — Competitive Analysis
- Multi-app search/compare
- Side-by-side metrics view
- Save/bookmark apps to track

### Phase 3 — Review Analysis
- Fetch and display recent reviews
- Sentiment summary
- Filter by rating, keyword

### Phase 4 — Historical Tracking
- Store snapshots over time
- Rating trend charts

---

## Open Questions

- **App Store API:** Apple doesn't have an official public API. Options: iTunes Search API (limited), unofficial scraping, or a third-party service (e.g., AppFollow, AppTweak, or open-source scrapers). Need to evaluate in Phase 1.
- **Google Play API:** Similarly unofficial — `google-play-scraper` (Node.js) is popular and well-maintained. Worth evaluating.
- **Rate limits / ToS:** Scraping stores may violate ToS at scale. Caching fetched data is important.
- **App identifier UX:** App Store uses numeric IDs and bundle IDs; Google Play uses package names. How does the user enter these? Search by name?

---

## Next Steps

Run `/workflows:plan` to plan the Next.js scaffold and Phase 1 metadata fetch feature.
