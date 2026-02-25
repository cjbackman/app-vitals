---
title: "Sparkline Axis Labels: Precision Management, Floating-Point Noise, and Range Amplification"
category: ui-bugs
tags: [svg, sparkline, charts, floating-point, react, typescript, formatting, axis-labels]
symptoms:
  - "Axis labels show the same value (e.g. '4.7'/'4.7') while the chart line moves"
  - "iOS ratings sparkline shows identical min/max labels despite visible trend"
  - "Axis label leading digit is clipped ('.72457' instead of '4.72')"
  - "Count axis labels show '724k'/'724k' for two slightly different values"
  - "Chart line moves when all values are essentially the same (floating-point noise)"
module: SnapshotHistory
date: 2026-02-25
---

# Sparkline Axis Labels: Precision Management, Floating-Point Noise, and Range Amplification

Hand-rolled SVG sparklines with Y-axis min/max labels.

## Problems

Three distinct but related symptoms all share the same root cause: insufficient axis label precision management.

**Symptom 1 — Identical axis labels with a moving chart line.**
After adding Y-axis labels (`min` at bottom, `max` at top), the labels often showed the same value (e.g., `724k`/`724k` or `4.7`/`4.7`) while the chart line clearly moved. For ratings, App Store returns floats like `4.699999809265137` (IEEE 754 double for 4.7); two ratings that differ in the 5th decimal place round identically to `"4.7"`.

**Symptom 2 — Chart line moves on floating-point noise.**
The SVG coordinate formula maps the data range to `chartH` pixels. With a range of `0.0000001`, that tiny difference gets amplified to `80px`, making random IEEE 754 noise look like a meaningful trend. The labels showed `"4.7"` / `"4.7"` while the line bounced dramatically.

**Symptom 3 — Leading digit clipped from axis label.**
The first round of fixes for Symptom 1 iterated decimal places up to `d=6` for ratings, producing labels like `"4.72457"` which overflowed the 30px `PAD_LEFT` gutter. The `"4."` prefix was clipped, leaving `".72457"`.

## Root Cause

All three symptoms come from the same design gap: the formatter and the chart coordinate math were independent. The formatter could show identical strings while the coordinates used the raw numeric range — producing visible chart movement with unreadable labels.

## Solution

### 1. `buildAxisFormat` — adaptive precision until labels are distinct

```typescript
function buildAxisFormat(
  min: number,
  max: number,
  base: (n: number) => string
): (n: number) => string {
  if (min === max) return base;
  if (base(min) !== base(max)) return base; // already distinct

  if (max < 100) {
    // Ratings: cap at toFixed(2) — deeper precision = floating-point noise
    const fmt = (n: number) => n.toFixed(2);
    if (fmt(min) !== fmt(max)) return fmt;
  } else {
    // Counts: escalate k/M decimal places
    const divisor = max >= 1_000_000 ? 1_000_000 : 1_000;
    const suffix = max >= 1_000_000 ? "M" : "k";
    for (let d = 2; d <= 4; d++) {
      const fmt = (n: number) =>
        `${(n / divisor).toFixed(d).replace(/\.?0+$/, "")}${suffix}`;
      if (fmt(min) !== fmt(max)) return fmt;
    }
    return (n: number) => n.toLocaleString();
  }
  return base; // indistinguishable — caller handles via labelsDistinct
}
```

**Key constraints:**
- `max < 100` (ratings): cap at `toFixed(2)`. Values indistinguishable at 2dp are floating-point noise, not real variation. Labels beyond ~5 characters overflow the 30px gutter.
- `max >= 1000` (counts): iterate d=2..4 only. Raw `toLocaleString()` fallback for extreme cases.

### 2. `labelsDistinct` + `effectiveRange` — couple the formatter to the chart line

```typescript
const axisFmt = buildAxisFormat(min, max, format);
const labelsDistinct = range > 0 && axisFmt(min) !== axisFmt(max);
const effectiveRange = labelsDistinct ? range : 0;

// y coordinate uses effectiveRange — not the raw range
const y =
  effectiveRange === 0
    ? PAD_Y + chartH / 2
    : PAD_Y + chartH - ((v - min) / effectiveRange) * chartH;
```

When `labelsDistinct` is false (labels can't be told apart), `effectiveRange` is forced to `0`, which:
- Flattens the chart line to the horizontal center
- Shows one centered label instead of identical top/bottom labels

This eliminates the "moving line with identical labels" visual contradiction.

### 3. Rating base format: `toFixed(2)` not `toFixed(1)`

```tsx
// In SnapshotHistory:
<Sparkline data={ratings} label="Rating" format={(n) => n.toFixed(2)} color={color} />
```

Normal App Store rating variation (e.g., 4.68 → 4.73) is immediately distinguishable at `toFixed(2)` without needing the adaptive path. Using `toFixed(1)` as the base caused all ratings to collapse to `"4.7"` and triggered the adaptive path unnecessarily.

### 4. `formatCount` with `toFixed(1)` + trailing-zero strip

```typescript
export function formatCount(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000)
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}
```

Using `toFixed(1)` as the base (vs `Math.round`) ensures close values like 724123 / 724890 produce distinct labels (`"724.1k"` / `"724.9k"`) without needing the adaptive path.

## Axis Label Layout

- `PAD_LEFT = 30` — left gutter for axis labels
- Labels at `x={PAD_LEFT - 2}`, `textAnchor="end"` — right-aligned into gutter, no overlap with polyline
- Max label length for ratings: `"4.70"` (4 chars, ~24px at fontSize 9) — fits in 30px gutter
- Max label length for counts: `"999.9k"` (6 chars, ~36px) — fine for the gutter at small font size

## When the Flat-Line Logic Triggers

| Case | `labelsDistinct` | Chart line | Axis labels |
|------|-----------------|------------|-------------|
| All values identical | `false` | Flat center | One centered label |
| Floating-point noise only | `false` | Flat center | One centered label |
| Values differ but base format collapses them | `false` (after adaptive path fails) | Flat center | One centered label |
| Values clearly distinct | `true` | Normal trend line | Max at top, min at bottom |

## Tests

```typescript
// Floating-point noise → flat line + single label
it("flattens when values are indistinguishable at toFixed(2)", () => {
  const tinyDiff = Number.EPSILON * 4.7;
  render(<SnapshotHistory snapshots={[
    { score: 4.7, reviewCount: 100 },
    { score: 4.7 + tinyDiff, reviewCount: 100 },
    { score: 4.7, reviewCount: 100 },
  ]} store="ios" />);
  const texts = screen.getAllByText(/^\d/);
  const ratingTexts = texts.filter(t => parseFloat(t.textContent!) >= 4);
  expect(ratingTexts).toHaveLength(1); // one centered label, not two identical
});

// Distinct ratings → two different labels
it("shows distinct top/bottom labels for a real rating trend", () => {
  render(<SnapshotHistory snapshots={[
    { score: 4.68, reviewCount: 100 },
    { score: 4.73, reviewCount: 100 },
  ]} store="ios" />);
  expect(screen.getByText("4.68")).toBeInTheDocument();
  expect(screen.getByText("4.73")).toBeInTheDocument();
});
```

## Files Changed

| File | Change |
|------|--------|
| `components/SnapshotHistory.tsx` | `buildAxisFormat`, `labelsDistinct`/`effectiveRange` pattern, `toFixed(2)` rating base |
| `lib/format.ts` | `formatCount` with `toFixed(1)` + trailing-zero strip |
| `__tests__/components/SnapshotHistory.test.tsx` | Floating-point noise test, distinct-labels test |
| `__tests__/lib/format.test.ts` | Unit tests for `formatCount` |

## References

- Implementation: `components/SnapshotHistory.tsx`
- Shared formatter: `lib/format.ts`
- Plan: `docs/plans/2026-02-25-feat-bigger-charts-with-axis-plan.md`
- PR #5
