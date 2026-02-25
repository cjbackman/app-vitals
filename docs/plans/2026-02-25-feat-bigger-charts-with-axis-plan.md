---
title: "feat: Bigger sparklines with Y-axis labels and per-app brand colors"
type: feat
date: 2026-02-25
---

# feat: Bigger Sparklines with Y-Axis Labels and Per-App Brand Colors

## Overview

The current sparklines are 120×32 px — too small to read comfortably. This plan expands them to 260×80 px, adds Y-axis min/max labels so the scale is legible, and supports per-app brand colors for trend lines (Babbel: `#FF6700`).

No new charting library. The existing hand-rolled SVG sparkline is extended in place.

## Proposed Solution

### 1. Resize + Y-axis labels + color/format props (`components/SnapshotHistory.tsx`)

- Increase `WIDTH` from **120 → 260** and `HEIGHT` from **32 → 80**.
- Add padding constants: `PAD_LEFT = 30` (y-axis label space), `PAD_Y = 6` (top/bottom).
- Derived: `chartW = WIDTH - PAD_LEFT`, `chartH = HEIGHT - PAD_Y * 2`.
- Updated coordinate math:
  ```typescript
  const x = PAD_LEFT + (i / (data.length - 1)) * chartW;
  const y = range === 0
    ? PAD_Y + chartH / 2                                    // flat-line (both circle AND polyline)
    : PAD_Y + chartH - ((v - min) / range) * chartH;
  ```
- Single-point circle: `cx={PAD_LEFT + chartW / 2} cy={PAD_Y + chartH / 2}`.
- Add Y-axis labels when `data.length >= 2`:
  ```tsx
  <text x={PAD_LEFT - 2} y={PAD_Y} textAnchor="end" dominantBaseline="hanging"
        fontSize={9} fill="#9ca3af">{formatCount(max)}</text>
  <text x={PAD_LEFT - 2} y={HEIGHT} textAnchor="end" dominantBaseline="auto"
        fontSize={9} fill="#9ca3af">{formatCount(min)}</text>
  ```
  Rating labels use `n.toFixed(1)`; count labels use `formatCount` from `lib/format.ts`.
- Add `format: (n: number) => string` prop to `Sparkline` (determines axis label formatting).
- Add `color?: string` prop to `Sparkline` and to `SnapshotHistoryProps`; fallback to `STROKE`.
- Update `Sparkline`'s inline props interface: `{ data: number[]; label: string; color?: string; format: (n: number) => string }`.

Call sites in `SnapshotHistory`:
```tsx
<Sparkline data={ratings}  label="Rating"  format={(n) => n.toFixed(1)} color={color} />
<Sparkline data={reviews}  label="Reviews" format={formatCount}          color={color} />
<Sparkline data={installs} label="Installs" format={formatCount}         color={color} />
```

### 2. Extract shared number formatter (`lib/format.ts`)

Move `formatReviewCount` out of `AppCard.tsx` (currently at line 49) into a shared module and rename it `formatCount`:

```typescript
// lib/format.ts
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}
```

Import in both `SnapshotHistory.tsx` and `AppCard.tsx` (replacing the local copy).

### 3. Inline Babbel brand color in `AppCard` (no `PresetApp` field — YAGNI)

```typescript
// Inside AppCard component body:
const brandColor =
  (store === "ios" && appId === "829587759") ||
  (store === "android" && appId === "com.babbel.mobile.android.en")
    ? "#FF6700"
    : undefined;

// In JSX:
<SnapshotHistory snapshots={snapshots} store={store} color={brandColor} />
```

No changes to `PresetApps.ts`. Add `brandColor` there when a second preset app needs it.

## Technical Considerations

- **Axis label overlap**: `textAnchor="end"` at `x={PAD_LEFT - 2}` keeps labels in the left gutter without touching the polyline.
- **Suppress labels for single point**: Both axis labels are suppressed when `data.length < 2` (same max/min number stacked top-and-bottom looks wrong).
- **Flat-line consistency**: `range === 0` uses `PAD_Y + chartH / 2` for *both* the circle and every polyline point — not `HEIGHT / 2`.
- **Babbel orange**: `#FF6700` (Babbel brand assets via Brandfetch).
- **`lib/format.ts` is not `server-only`** — it is a pure utility; both client and server components can import it.

## Acceptance Criteria

- [ ] Each sparkline is 260×80 px (was 120×32)
- [ ] Y-axis min and max value labels appear left of each sparkline when ≥ 2 data points
- [ ] Y-axis labels are suppressed for single-point data
- [ ] Ratings label uses one decimal (`"4.5"`); count labels use k/M suffix (`"12k"`, `"2.3M"`)
- [ ] Labels sit in the left gutter — no overlap with the polyline
- [ ] Polyline and circle are inset by padding — do not touch SVG edges
- [ ] `SnapshotHistory` accepts optional `color` prop; Babbel AppCards use `#FF6700`; others use default indigo
- [ ] `formatReviewCount` removed from `AppCard.tsx`; `formatCount` imported from `lib/format.ts`
- [ ] All existing `SnapshotHistory` tests pass
- [ ] New tests: color prop, formatCount values, axis label suppression for single point
- [ ] `npm test` passes (no regressions)

## Files to Change

| File | Change |
|------|--------|
| `components/SnapshotHistory.tsx` | Resize, padding, y-axis labels, `color` + `format` props |
| `components/AppCard.tsx` | Inline Babbel color; replace local formatter with import |
| `lib/format.ts` *(new)* | Extract `formatCount` shared utility |
| `components/PresetApps.ts` | No change |
| `__tests__/components/SnapshotHistory.test.tsx` | Color + axis label tests |
| `__tests__/lib/format.test.ts` *(new)* | Unit tests for `formatCount` |

## References

- Current sparkline implementation: `components/SnapshotHistory.tsx:1-91`
- `formatReviewCount` to extract: `components/AppCard.tsx:49`
- Existing SnapshotHistory tests: `__tests__/components/SnapshotHistory.test.tsx`
- Babbel brand orange: `#FF6700`
