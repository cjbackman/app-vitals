---
status: pending
priority: p1
issue_id: "056"
tags: [code-review, quality, reliability]
dependencies: []
---

# `fetchSnaps` Missing `r.ok` Check — NaN Velocities on API Errors

## Problem Statement

`fetchSnaps` in `CompetitorTable.tsx` and the snapshot fetch in `ComparisonCharts.tsx` do not check `r.ok` before calling `r.json()`. When the `/api/snapshots` endpoint returns a 4xx/5xx, the error JSON body is silently cast to `Snapshot[]` and passed to `computeVelocity`, producing `NaN` deltas that render as "NaN" in the Δ cells rather than "—".

The existing `dataFetches` in the same `useEffect` already does this correctly — `fetchSnaps` is inconsistent.

## Findings

- `components/CompetitorTable.tsx:83–86` — `fetchSnaps` calls `r.json()` unconditionally
- `components/ComparisonCharts.tsx:199–204` — same pattern, no `r.ok` guard
- When `/api/snapshots` returns `{ error: "...", code: "..." }`, `computeVelocity` receives a non-array object; `.at(-1)` returns `undefined`; arithmetic on `undefined` produces `NaN`
- `NaN > 0` and `NaN < 0` are both `false`, so `velocityColor` returns `text-gray-400` — but `formatDelta(NaN, ...)` produces the string `"NaN"` rendered in the UI
- The existing `dataFetches` pattern handles this correctly: `.then((r) => (r.ok ? r.json() : Promise.reject(r)))` — `fetchSnaps` must match

## Proposed Solutions

### Option 1: Add `r.ok` guard in `fetchSnaps`, return `[]` on error

**Approach:**
```typescript
const fetchSnaps = (appId: string): Promise<Snapshot[]> =>
  fetch(`/api/snapshots?store=${store}&appId=${encodeURIComponent(appId)}`, {
    signal: controller.signal,
  }).then((r) => {
    if (!r.ok) return [];
    return r.json() as Promise<Snapshot[]>;
  });
```
Apply identical fix to `ComparisonCharts.tsx`.

**Pros:** Consistent with existing `dataFetches` pattern; gracefully degrades to "—" on error
**Cons:** None
**Effort:** 10 minutes
**Risk:** None

---

### Option 2: Throw on non-ok, let `allSettled` catch it

**Approach:** `Promise.reject(r)` on non-ok — `allSettled` catches it; snapshot result for that app becomes `{ status: "rejected" }` and the consumer already falls back to `[]`.

**Pros:** Same outcome; error object available for logging
**Cons:** Slightly more complex; requires ensuring `allSettled` consumer handles `rejected` for snapshot fetches (it already does via `snapshotResult?.status === "fulfilled"`)
**Effort:** 10 minutes
**Risk:** Low

---

## Recommended Action

Option 1 — matches existing `fetchSnaps` intent (silent fallback to no-velocity) and is the minimal fix.

## Technical Details

**Affected files:**
- `components/CompetitorTable.tsx:83–86`
- `components/ComparisonCharts.tsx:199–204`

## Acceptance Criteria

- [ ] `fetchSnaps` in `CompetitorTable` returns `[]` when `r.ok` is false
- [ ] Snapshot fetch in `ComparisonCharts` returns `[]` when `r.ok` is false
- [ ] Velocity cells show "—" (not "NaN") when `/api/snapshots` returns an error
- [ ] Existing tests still pass; new test added for error path in CompetitorTable velocity tests

## Work Log

### 2026-03-01 - Discovery

**By:** Code review agents (TypeScript reviewer, Race conditions reviewer)

**Findings:**
- Both fetch sites missing `r.ok` guard
- `dataFetches` in same file has correct guard — inconsistency confirmed
