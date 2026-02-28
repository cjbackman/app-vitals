---
title: "feat: Comparison charts — multi-app overlaid sparklines with weekly trend"
type: feat
date: 2026-02-26
---

# feat: Comparison Charts — Multi-App Overlaid Sparklines with Weekly Trend

## Overview

Replace the stacked competitor AppCards with a unified **Comparison** section. Instead of showing each competitor's data in its own separate AppCard row, overlay all apps (leading + competitors) as colored lines inside shared sparkline charts. Show a weekly trend badge (absolute delta + %) per app per metric.

**Before:** Leading AppCard row → Competitor 1 AppCard row → Competitor 2 AppCard row
**After:** Leading AppCard row → Comparison section (iOS column + Android column, each with Rating chart + Reviews chart, all apps overlaid)

Brainstorm: `docs/brainstorms/2026-02-26-comparison-charts-brainstorm.md`

---

## Key Decisions (from brainstorm)

- **Layout**: iOS column (left) + Android column (right). Each column: Rating chart → Reviews chart.
- **Y-axis**: Per-series independent scaling — each app's line fills the full chart height independently. No shared Y-axis labels on the chart; the legend carries absolute values + trend.
- **Trend badge**: `latest_snapshot − second_to_last_snapshot`. Shows `↑X.X (+Y.Y%)` or `↓` prefix. Shows `—` if fewer than 2 snapshots exist.
- **Architecture**: New `ComparisonCharts` (container, fetches snapshots) + `ComparisonChart` (single metric+store SVG). `SnapshotHistory` left untouched.
- **Competitor AppCards removed**: No more stacked competitor AppCard rows in SearchPage.

---

## Implementation Plan

### 1. `lib/format.ts` — Add `formatDelta` and `formatPercent`

Add two new exports alongside the existing `formatCount`:

```typescript
// lib/format.ts

/** "+1.2k" / "-300" / "0" — delta formatted with the same formatter as the series */
export function formatDelta(delta: number, format: (n: number) => string): string {
  if (delta === 0) return "0";
  return (delta > 0 ? "+" : "") + format(Math.abs(delta));
}

/** "+2.1%" / "-0.5%" */
export function formatPercent(pct: number): string {
  if (!isFinite(pct)) return "—";
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
}
```

Tests: `__tests__/lib/format.test.ts` — add test cases for `formatDelta` and `formatPercent`.

---

### 2. `components/ComparisonChart.tsx` — Single metric+store SVG with multi-line overlay

New component. Renders one chart for one metric (rating or review count) and one store (ios or android).

**Props:**

```typescript
interface Series {
  label: string;         // app name (e.g. "Babbel")
  color: string;         // brandColor (e.g. "#FF6700")
  data: number[];        // metric values, ascending by savedAt
}

interface ComparisonChartProps {
  series: Series[];
  metric: "rating" | "reviewCount";
  label: string;         // e.g. "Rating" or "Reviews" — used for aria-label
}
```

**SVG layout:**

```
Width: 100% (viewBox based, or fixed ~300px)
Height: 80px (same as SnapshotHistory; may increase to ~100px if needed)
No PAD_LEFT (no Y-axis labels on chart — legend carries the values)
PAD_Y: 6px top/bottom
```

**Per-series Y scaling (independent):**

For each series independently:
```
min = Math.min(...data), max = Math.max(...data)
effectiveRange = max === min ? 1 : max - min
y(v) = PAD_Y + chartH - ((v - min) / effectiveRange) * chartH
```
When a series has 1 point: render a circle at the center (y = PAD_Y + chartH/2).
When a series has 0 points: skip polyline rendering.

**X mapping** (same as SnapshotHistory):
```
x(i) = (i / (data.length - 1)) * chartW
```
Single point: x = chartW / 2.

**Legend below chart:**

One row per series:
```
● Babbel  4.7  ↑0.1 (+2.1%)
● Duolingo  4.9  — (—)
```
- Colored dot (matches brandColor)
- App name
- Latest value (formatted with `formatCount` for reviews, `toFixed(1)` for rating)
- Trend badge computed from `data.at(-1) - data.at(-2)` (or `—` if `data.length < 2`)

**Weekly trend computation:**

```typescript
function computeTrend(data: number[], format: (n: number) => string) {
  if (data.length < 2) return { delta: "—", pct: "—" };
  const latest = data[data.length - 1]!;
  const prev = data[data.length - 2]!;
  const delta = latest - prev;
  const pct = prev === 0 ? Infinity : (delta / prev) * 100;
  return {
    delta: formatDelta(delta, format),
    pct: formatPercent(pct),
  };
}
```

**SVG aria-label**: `"{label} trend"` — consistent with SnapshotHistory convention, queryable via `screen.getByLabelText("Rating trend")`.

---

### 3. `components/ComparisonCharts.tsx` — Container: fetches all snapshots, renders 2×2 grid

New component. Fetches snapshots for every preset × both stores in parallel. Renders iOS and Android columns side by side.

**Props:**

```typescript
interface ComparisonChartsProps {
  apps: PresetApp[];  // all presets to compare (leading + competitors)
}
```

**Snapshot state:**

```typescript
// Keyed by "${store}:${appId}"
const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({});
```

**Parallel fetch on mount:**

```typescript
useEffect(() => {
  const controller = new AbortController();

  const pairs = apps.flatMap((app) => [
    { store: "ios" as const, appId: app.iosId, key: `ios:${app.iosId}` },
    { store: "android" as const, appId: app.androidId, key: `android:${app.androidId}` },
  ]);

  Promise.allSettled(
    pairs.map(({ store, appId, key }) =>
      fetch(`/api/snapshots?store=${store}&appId=${encodeURIComponent(appId)}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<Snapshot[]>) : Promise.reject(r)))
        .then((data) => ({ key, data: Array.isArray(data) ? data : [] }))
    )
  ).then((results) => {
    if (controller.signal.aborted) return;
    const next: Record<string, Snapshot[]> = {};
    for (const result of results) {
      if (result.status === "fulfilled") {
        next[result.value.key] = result.value.data;
      }
    }
    setSnapshots(next);
  });

  return () => controller.abort();
}, [apps]);
```

Key patterns:
- `Promise.allSettled` at outer level — one failed fetch doesn't clear others (per `docs/solutions/ui-bugs/parallel-fetch-orchestration-allsettled-vs-all.md`)
- AbortController in useEffect — cleaned up on unmount
- Snapshot history is best-effort — errors swallowed silently (same as AppCard)

**Render — series derivation:**

```typescript
function getSeries(store: "ios" | "android", appIdKey: keyof PresetApp, metric: keyof Pick<Snapshot, "score" | "reviewCount">) {
  return apps.map((app) => ({
    label: app.name,
    color: app.brandColor ?? "#6366f1",
    data: (snapshots[`${store}:${app[appIdKey]}`] ?? []).map((s) => s[metric]),
  }));
}
```

**Render — layout:**

```tsx
<div className="space-y-6">
  <h2 className="text-sm font-medium text-gray-500">Comparison</h2>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    {/* iOS column */}
    <div className="space-y-4">
      <p className="text-xs text-gray-400 font-medium">App Store</p>
      <ComparisonChart series={getSeries("ios", "iosId", "score")} metric="rating" label="Rating" />
      <ComparisonChart series={getSeries("ios", "iosId", "reviewCount")} metric="reviewCount" label="Reviews" />
    </div>
    {/* Android column */}
    <div className="space-y-4">
      <p className="text-xs text-gray-400 font-medium">Google Play</p>
      <ComparisonChart series={getSeries("android", "androidId", "score")} metric="rating" label="Rating" />
      <ComparisonChart series={getSeries("android", "androidId", "reviewCount")} metric="reviewCount" label="Reviews" />
    </div>
  </div>
</div>
```

---

### 4. `components/SearchPage.tsx` — Wire in ComparisonCharts, remove competitor AppCards

**Remove:** The `{competitorResults.map(...)}` competitor AppCard render section.

**Add:** `<ComparisonCharts>` below the leading app's AppCard, conditionally rendered when `selectedPreset !== null`. Pass all `PRESET_APPS` — the comparison always shows every preset, regardless of which is leading.

```tsx
{selectedPreset !== null && (
  <ComparisonCharts apps={PRESET_APPS} />
)}
```

`competitorResults` state and its fetch logic **remain in SearchPage** — it's still used to determine whether to show the Comparison section (via `selectedPreset` derivation). Actually: `competitorResults` fetch can be removed entirely since ComparisonCharts has its own snapshot fetching and doesn't need app metadata for the chart. The competitor *app metadata* fetches (for the AppCards) go away.

Wait — `competitorResults` was used for two things: (1) render competitor AppCards, (2) trigger the comparison section visibility. Since (1) is removed and (2) is replaced by `selectedPreset !== null` check, `competitorResults` state + fetch logic in `handleSearch` can be removed.

**Updated SearchPage state diff:**
- Remove: `competitorResults` state and `setCompetitorResults` call
- Remove: competitors fetch from `handleSearch` (the `fetchPair` calls for non-leading presets)
- Remove: `CompetitorResult` interface
- Keep: leading app fetch, `results` state, `selectedPreset` derivation
- Add: `<ComparisonCharts apps={PRESET_APPS} />` below leading app cards

---

### 5. Tests

#### `__tests__/components/ComparisonChart.test.tsx`

```typescript
// @jest-environment jsdom

// Mock next/image (per established pattern)
// No SnapshotHistory needed (ComparisonChart is standalone SVG)

describe("ComparisonChart", () => {
  it("renders a polyline per series")
  it("renders nothing when all series have 0 data points")
  it("renders a dot when a series has exactly 1 data point")
  it("shows trend badge ↑ when latest > previous")
  it("shows trend badge ↓ when latest < previous")
  it("shows — when fewer than 2 data points")
  it("SVG has aria-label matching the label prop")
  it("each series legend row shows the formatted latest value")
})
```

#### `__tests__/components/ComparisonCharts.test.tsx`

```typescript
// @jest-environment jsdom
// Mock ComparisonChart to capture series prop without SVG complexity
// URL-based mockFetch (order-independent) — per SearchPage.test.tsx pattern

describe("ComparisonCharts", () => {
  it("fetches snapshots for all apps and stores on mount")
  it("passes correct series data to ComparisonChart instances")
  it("aborts in-flight fetches on unmount")
  it("renders 4 ComparisonChart instances (2 stores × 2 metrics)")
  it("a failed snapshot fetch for one app does not prevent others from rendering")
})
```

#### `__tests__/lib/format.test.ts` (add to existing)

```typescript
describe("formatDelta", () => {
  it("prefixes positive delta with +")
  it("prefixes negative delta with - and absolute value")
  it("returns 0 for zero delta")
})

describe("formatPercent", () => {
  it("prefixes positive percentage with +")
  it("prefixes negative percentage without +")
  it("returns — for non-finite input (div by zero)")
})
```

#### `__tests__/components/SearchPage.test.tsx`

Update existing tests:
- Remove assertions for competitor AppCard rows (`getByTestId("competitor-section")` etc.)
- Add: `ComparisonCharts is rendered when selectedPreset !== null`
- Add: `ComparisonCharts is not rendered for non-preset searches`
- Mock `ComparisonCharts` to avoid snapshot fetching side-effects in SearchPage tests

---

## Acceptance Criteria

- [x] ComparisonCharts section appears below the leading app when a preset is selected
- [x] ComparisonCharts is not shown for manual (non-preset) searches
- [x] 4 charts rendered: iOS Rating, iOS Reviews, Android Rating, Android Reviews
- [x] Each chart overlays all apps as colored lines using their `brandColor`
- [x] Each app's line independently fills the full chart height (per-series Y scaling)
- [x] Legend shows: app name, latest value, weekly trend badge
- [x] Trend badge shows `↑X.X (+Y.Y%)` or `↓` when 2+ snapshots exist
- [x] Trend badge shows `—` when fewer than 2 snapshots exist
- [x] Stacked competitor AppCard rows removed from SearchPage
- [x] Competitor fetch logic removed from `handleSearch`
- [x] All new code has tests; all existing tests pass

---

## Files to Change

| File | Change |
|---|---|
| `lib/format.ts` | Add `formatDelta`, `formatPercent` |
| `components/ComparisonChart.tsx` | New — single metric+store multi-line SVG chart |
| `components/ComparisonCharts.tsx` | New — container, parallel snapshot fetch, 2×2 grid |
| `components/SearchPage.tsx` | Remove competitor AppCard logic + fetch; add `<ComparisonCharts>` |
| `__tests__/lib/format.test.ts` | Add formatDelta, formatPercent tests |
| `__tests__/components/ComparisonChart.test.tsx` | New — SVG rendering + trend badge tests |
| `__tests__/components/ComparisonCharts.test.tsx` | New — fetch integration + layout tests |
| `__tests__/components/SearchPage.test.tsx` | Update — remove competitor assertions, add ComparisonCharts assertions |

---

## References

- Brainstorm: `docs/brainstorms/2026-02-26-comparison-charts-brainstorm.md`
- Axis label precision pattern: `docs/solutions/ui-bugs/sparkline-axis-label-precision-and-chart-noise.md`
- Parallel fetch pattern: `docs/solutions/ui-bugs/parallel-fetch-orchestration-allsettled-vs-all.md`
- data-testid pattern: `docs/solutions/ui-bugs/data-testid-on-mapped-elements-use-getall.md`
- SnapshotHistory source: `components/SnapshotHistory.tsx`
- AppCard snapshot fetch pattern: `components/AppCard.tsx:81–97`
- Existing format utilities: `lib/format.ts`
