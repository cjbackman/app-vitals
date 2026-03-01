---
status: pending
priority: p2
issue_id: "063"
tags: [code-review, quality, maintainability]
dependencies: []
---

# Fragile `snapshotResults[i+1]` Index Offset in CompetitorTable

## Problem Statement

`CompetitorTable.tsx` builds `snapshotFetches` as `[leadingPreset, ...competitors]`, placing the leading app's snapshots at index 0 and competitors at indices 1+. The consumption loop then uses `snapshotResults[i + 1]` to get competitor snapshots. This positional coupling is invisible to the type system — if the spread order ever changes, velocity data would be silently swapped between apps.

## Findings

- `components/CompetitorTable.tsx:98` — `[leadingPreset, ...competitors].map(fetchSnaps)` — leading app at index 0
- `components/CompetitorTable.tsx:117` — `snapshotResults[i + 1]` — silent +1 offset
- `components/CompetitorTable.tsx:113–115` — `snapshotResults[0]` special-cased for leading app
- Comment at line 117 explains the offset but type system cannot enforce it
- Pattern reviewer flagged as "fragile positional coupling" with silent failure mode

## Proposed Solutions

### Option 1: Fetch leading snapshot separately, competitors 1:1 with dataFetches

**Approach:**
```typescript
// Fetch leading app snapshots independently
const leadingSnapshotFetch = fetchSnaps(leadingPreset[idKey]);

// Competitor snapshots: 1:1 with dataFetches (same index, no offset)
const snapshotFetches = competitors.map((preset) => fetchSnaps(preset[idKey]));

Promise.all([
  Promise.allSettled(dataFetches),
  Promise.allSettled(snapshotFetches),
  leadingSnapshotFetch.then(computeSnapshotDelta).catch(() => null),
]).then(([dataResults, snapshotResults, leadingDelta]) => {
  if (controller.signal.aborted) return;
  clearTimeout(timeoutId);
  setLeadingDelta(leadingDelta);
  setRows(
    dataResults.map((result, i) => {
      const data = result.status === "fulfilled" ? result.value.data : null;
      const snaps = snapshotResults[i]?.status === "fulfilled" ? snapshotResults[i].value : [];
      return { preset: competitors[i]!, data, delta: computeSnapshotDelta(snaps) };
    })
  );
});
```

**Pros:** `snapshotResults[i]` aligns 1:1 with `dataResults[i]` — no offset; leading fetch is explicitly named
**Cons:** Three-way `Promise.all` is slightly more complex; requires handling `leadingSnapshotFetch` rejection
**Effort:** 30 minutes
**Risk:** Low

---

### Option 2: Keep current structure, add assertion comment

**Approach:** Document the invariant more prominently — add a TypeScript assertion that validates the index alignment in dev:
```typescript
console.assert(
  snapshotResults.length === dataResults.length + 1,
  "snapshot fetch order invariant violated"
);
```

**Pros:** Minimal code change
**Cons:** Does not eliminate the fragility; runtime check only
**Effort:** 5 minutes
**Risk:** None

---

## Recommended Action

Option 1 — eliminates the offset entirely and makes the code self-documenting. Best done alongside todo #061 (renaming `Velocity` → `SnapshotDelta`).

## Technical Details

**Affected files:**
- `components/CompetitorTable.tsx:98–123`

## Acceptance Criteria

- [ ] No `snapshotResults[i + 1]` offset in consumption loop
- [ ] Leading app snapshot fetch is clearly separated from competitor snapshot fetches
- [ ] Existing velocity tests all pass
- [ ] No behavior change visible in the UI

## Work Log

### 2026-03-01 - Discovery

**By:** Pattern reviewer, Simplicity reviewer
