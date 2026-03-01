---
date: 2026-03-01
topic: analytics-layer
---

# Analytics Layer — Release events, stock overlay, and velocity metrics

## What We're Building

Three connected enrichments on top of the existing weekly snapshot data:

1. **Release detection** — store `version` and `price` in snapshots (already available from scrapers). A version change between consecutive snapshots is treated as a release event. Release markers appear on comparison charts as vertical lines or flags.

2. **DUOL stock price overlay** — weekly DUOL (Duolingo) closing price fetched via Yahoo Finance's free unofficial API (no API key needed). Stored in a `stock_prices` table. Overlaid as a secondary axis on the Duolingo comparison chart. Babbel is private — no stock data available.

3. **Velocity metrics + release impact scoring** — week-over-week rating and review deltas computed from snapshots. After each detected release, compute average rating delta over the following 4 weeks as a "release impact score". Surface these in an analytics section below the comparison charts.

The MVP of each piece is small. The combined effect turns App Vitals from a tracker into a lightweight competitive intelligence tool.

## Why This Approach

**Release detection from scrapers:** The scrapers already return `version` and `updatedAt`. Storing `version` in snapshots requires a small schema migration and one extra column in the cron snapshot write. No new scraping, no new dependencies. Weekly cadence means releases are detected up to 7 days late — acceptable for trend analysis.

**Yahoo Finance:** Returns free, unauthenticated weekly OHLC data at `https://query1.finance.yahoo.com/v8/finance/chart/DUOL?interval=1wk`. Widely used, no auth required. Fetched during the existing weekly cron job and stored alongside app snapshots. Correlation with Babbel metrics is possible even though Babbel itself is private.

**Velocity computed at read time:** No need to store deltas — compute them when serving snapshot data by diffing consecutive rows. The existing `getSnapshots()` already returns snapshots in ascending order.

## Key Decisions

- **Schema change**: Add `version TEXT` and `price REAL` columns to the `snapshots` table. `price` stores the numeric amount (0.0 for free apps).
- **Stock table**: New `stock_prices` table with `(date TEXT PRIMARY KEY, ticker TEXT, close REAL)`. Populated weekly by the cron job.
- **Release event definition**: A release is a snapshot where `version != previous_version` for the same store+app_id. Computed in `getSnapshots()` — return a `isRelease: boolean` flag on each snapshot row.
- **Release impact scope**: 4-week window post-release (4 weekly snapshots). Score = average score delta vs the snapshot immediately before release. Show as `+0.2` or `−0.1`.
- **DUOL only**: Stock overlay only applies to Duolingo. If app is Babbel (or other), the stock series is absent. No need to make this generic.
- **Where to surface**: New `AnalyticsSection` component below the existing `ComparisonCharts`. Shows: velocity badges per app, a release event timeline, stock overlay toggle on comparison charts.
- **Stock overlay is opt-in**: A toggle button on the chart — don't show by default (avoids confusing axis scaling).

## Open Questions

- **Yahoo Finance reliability**: Unofficial API — no SLA. If it starts failing, switch to Alpha Vantage free tier (25 req/day, key required). Should be fine for weekly cron.
- **Backfilling stock history**: Yahoo Finance returns up to 2 years of weekly data in one call. Should we backfill on first run? Probably yes — gives immediate correlation context.
- **Comparison charts prerequisite**: The `ComparisonCharts` component (brainstormed 2026-02-26) isn't built yet. Release markers and stock overlay build on top of it. Plan/implement comparison charts first, then layer analytics on top.
- **Release notes**: App Store and Play Store expose release notes per version. Worth including as tooltip text on release markers? Adds value but scraping notes requires an extra call per detected release.

## Files Expected to Change

| File | Change |
|---|---|
| `lib/db.ts` (migration) | Add `version`, `price` columns to `snapshots`; create `stock_prices` table |
| `lib/snapshots.ts` | Save/return `version` + `price`; compute `isRelease` flag in `getSnapshots` |
| `lib/stock-prices.ts` | New — fetch DUOL weekly price from Yahoo Finance, save/query `stock_prices` |
| `app/api/cron/snapshot/route.ts` | Also fetch + save DUOL stock price during weekly run |
| `app/api/stock/route.ts` | New GET endpoint returning `stock_prices` rows for a ticker |
| `types/app-data.ts` | Extend `Snapshot` with `version`, `price`, `isRelease` fields |
| `components/ComparisonCharts.tsx` | Release markers on chart lines; stock overlay toggle + series |
| `components/AnalyticsSection.tsx` | New — velocity badges, release timeline, impact scores |

## Dependencies / Sequencing

1. **First**: Comparison Charts (see `2026-02-26-comparison-charts-brainstorm.md`) — release markers live on those charts
2. **Then**: Schema expansion (version + price in snapshots) + cron update
3. **Then**: Stock price fetch + storage + overlay
4. **Finally**: AnalyticsSection with velocity + impact scoring

Each step is independently shippable.

## Next Steps

→ `/workflows:plan` for Comparison Charts (prerequisite)
→ Then `/workflows:plan` for this analytics layer
