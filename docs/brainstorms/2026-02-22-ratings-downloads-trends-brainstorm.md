---
date: 2026-02-22
topic: ratings-downloads-trends
---

# Ratings & Downloads Trends

## What We're Building

A historical analytics feature that lets users save snapshots of app metrics over time and visualise trends inline on the existing lookup page. Each AppCard gains a "Save snapshot" button; once snapshots exist, a collapsible history section appears below the card showing compact sparkline charts for rating, review count, and (Android-only) install count.

The feature is additive — the main lookup flow is unchanged. History is opt-in per lookup.

## Data Available

| Metric         | iOS | Android |
|----------------|-----|---------|
| Rating         | ✓   | ✓       |
| Review count   | ✓   | ✓       |
| Install count  | ✗   | ✓ (`minInstalls`) |

Apple does not expose download/install counts through the App Store scraper. The iOS card will show rating + review trends only; the Android card will show all three.

## Why This Approach

**Sparklines over a snapshot table:** A table requires cognitive work to infer trends from numbers. Sparklines give immediate visual signal with minimal screen real estate — appropriate for an inline section on the lookup page.

**Sparklines over full charts:** Full charts (axes, tooltips, zoom) are overkill for a metadata lookup tool. They'd dominate the UI and add implementation complexity. Sparklines are a better fit for the current product scope.

**SQLite over hosted DB:** No infra to manage, no cost, no auth. Appropriate for a single-user or small-team tool. Can migrate to Postgres later if needed.

**Manual save over auto-save or cron:** Auto-saving every lookup would accumulate noise. A cron job adds scheduling infrastructure. Manual save gives the user control and keeps the architecture simple.

## Key Decisions

- **Storage:** SQLite local file via `better-sqlite3`
- **Collection trigger:** Manual "Save snapshot" button per AppCard
- **Visualisation:** Sparklines (compact inline trend lines)
- **iOS downloads:** Not supported — omit from iOS card without apology
- **UI placement:** Collapsible history section inline below each AppCard

## Open Questions

- Which SQLite wrapper? (`better-sqlite3` vs `@libsql/client` for Turso compatibility)
- Which chart/sparkline library? (Recharts `<LineChart>`, `react-sparklines`, or a custom SVG)
- Schema design: one `snapshots` table keyed by `(store, appId, savedAt)`?
- Should snapshots be scoped to the current lookup session or persist globally across page reloads?
- What's the maximum number of snapshots to display before the sparkline gets noisy?

## Next Steps

→ `/workflows:plan` for implementation details
