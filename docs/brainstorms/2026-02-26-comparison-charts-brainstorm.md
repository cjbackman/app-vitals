---
date: 2026-02-26
topic: comparison-charts
---

# Comparison Charts — Combined multi-app sparklines with weekly trend

## What We're Building

Replace the current stacked competitor AppCards with a unified **Comparison** section below the leading app's AppCard. The new section shows one chart per metric (Rating, Reviews) per store (iOS + Android), with all apps' historical data overlaid as colored lines. Each app's line is independently Y-scaled so trends are visually prominent regardless of absolute magnitude differences. Weekly trend badges show delta value + percentage (e.g. "↑0.1 (+0.5%)") next to each app's current value.

**Before:** Leading app AppCard → Competitor 1 AppCards → Competitor 2 AppCards (stacked)
**After:** Leading app AppCard → Comparison section (combined charts, all apps)

Scope: weekly trend only (limited historical data). Monthly/quarterly/annual can be added later when more snapshots exist.

## Why This Approach

**New `ComparisonCharts` component** (not extending `SnapshotHistory`):
- `SnapshotHistory` stays untouched — still used by the leading app's AppCard for its per-app sparklines and save-snapshot UX
- `ComparisonCharts` is purpose-built for multi-app overlay with its own snapshot fetching, independent Y-axis scaling per series, and trend badge rendering
- YAGNI: no shared SVG primitive needed until there's a third consumer

**Per-app axis scaling**: review counts differ by 40× (Babbel ~50K, Duolingo ~2M). A shared axis makes Babbel's line invisible. Independent scaling shows trend shape for each app while a legend note clarifies that axes differ.

## Key Decisions

- **Layout**: iOS column (left) + Android column (right), matching existing AppCard grid. Each column: Rating chart → Reviews chart.
- **Chart content**: Each chart overlays all apps (leading + competitors) as separate colored lines using the existing `brandColor` per preset.
- **Y-axis**: Each series is independently scaled to fill the chart height. A small note ("scales differ") appears in the legend.
- **Trend badge**: One badge per app per metric showing `↑X.X (+Y.Y%)` or `↓` prefix. Computed from the most recent snapshot vs the snapshot closest to 7 days prior. Shows "—" if fewer than 2 snapshots exist.
- **Snapshot fetching**: `ComparisonCharts` receives app IDs and stores, fetches all snapshots in parallel via `/api/snapshots`. Fetches fire when the component mounts or when the app set changes.
- **Competitor AppCards removed**: No more stacked Duolingo AppCards below the leading app. The competitor save-snapshot button is gone for now — acceptable since the leading app's AppCard still saves.
- **No loading skeleton for comparison charts**: They appear when data arrives. If no snapshots exist yet for an app, that chart simply renders empty/zero-point state.

## Resolved Decisions

- **"Weekly" definition**: Weekly snapshots will be automated (upcoming iteration). Trend = `snapshots[0] − snapshots[1]` (latest vs previous), ordered by `savedAt` descending. No date math needed — "previous snapshot" is always "last week's snapshot" once automation is in place.
- **Single snapshot edge case**: Show "—" (dash) when fewer than 2 snapshots exist. Keeps the badge area consistent so layout doesn't shift when data arrives.
- **Chart dimensions**: TBD during implementation — may be slightly taller than current 80px to accommodate multiple lines.

## Open Questions

- **Chart dimensions**: Current SnapshotHistory is 260×80px. With multiple lines, may need more height. Settle during implementation.

## Files Expected to Change

| File | Change |
|---|---|
| `components/SearchPage.tsx` | Remove competitor AppCard render; pass apps array to ComparisonCharts |
| `components/ComparisonCharts.tsx` | New component — fetches snapshots for all apps, renders metric charts |
| `components/ComparisonChart.tsx` | New single metric+store chart — multi-line SVG sparkline with trend badges |

## Next Steps

→ `/workflows:plan` to design the implementation
