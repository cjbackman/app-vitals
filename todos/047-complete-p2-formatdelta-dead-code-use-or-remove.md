---
status: complete
priority: p2
issue_id: "047"
tags: [code-review, quality, yagni]
dependencies: []
---

# P2: `formatDelta` and `formatPercent` are dead code — use them or remove them

## Problem Statement

`formatDelta` and `formatPercent` were added to `lib/format.ts` in this PR but have no callers in production code. `CompetitorTable` has its own local `ratingDelta` function that duplicates `formatDelta`'s logic (with a subtle sign-handling difference). This is a YAGNI violation per CLAUDE.md and leaves the codebase with tested-but-unused exports.

## Findings

- `lib/format.ts:18-30` — `formatDelta` and `formatPercent` exported but never imported in production code
- `components/CompetitorTable.tsx:24-27` — local `ratingDelta` function duplicates `formatDelta`'s concern
- `ratingDelta` uses `(d > 0 ? "+" : "") + d.toFixed(1)` — relies on `toFixed`'s built-in sign for negatives, which works but is non-obvious. `formatDelta` uses explicit `"-"` prefix with `Math.abs`, which is clearer
- `formatPercent` has no candidate caller anywhere in the current codebase
- Identified by code-simplicity-reviewer and kieran-typescript-reviewer

## Proposed Solutions

### Option A: Use `formatDelta` in CompetitorTable, delete `formatPercent` (Recommended)
- Remove `ratingDelta` function from `CompetitorTable.tsx` (lines 24-27)
- Add `formatDelta` to import: `import { formatCount, formatDelta } from "@/lib/format"`
- Replace call site (lines 125-128):
  ```typescript
  const ratingDeltaStr =
    score !== null && leadingScore !== null
      ? formatDelta(score - leadingScore, (n) => n.toFixed(1))
      : "—";
  ```
- Delete `formatPercent` from `lib/format.ts` (lines 23-30) — no caller; restore when sparklines feature is implemented
- Delete `formatPercent` tests from `__tests__/lib/format.test.ts` (lines 49-66)

**Pros:** Eliminates dead code, fixes sign-handling subtlety, reduces CompetitorTable's private surface
**Cons:** `formatPercent` must be recreated when sparklines are built
**Effort:** Small
**Risk:** Low — behaviour is equivalent

### Option B: Delete both `formatDelta` and `formatPercent`
- Delete lines 14-30 from `lib/format.ts`
- Delete lines 35-66 from `__tests__/lib/format.test.ts`
- Restore both when the sparklines (`ComparisonCharts`) feature is actually implemented

**Pros:** Pure YAGNI compliance
**Cons:** More work to restore; `formatDelta` tests would need to be rewritten later
**Effort:** Small
**Risk:** Low

### Option C: Keep as-is
- Leave the dead code and accept the inconsistency

**Pros:** No change
**Cons:** YAGNI violation, duplicated logic, confusing for future readers
**Effort:** None
**Risk:** Ongoing maintenance confusion

## Acceptance Criteria
- [ ] No exported function in `lib/format.ts` is unused in production code
- [ ] `CompetitorTable.tsx` does not have a local `ratingDelta` function if `formatDelta` covers the use case
- [ ] All tests pass after changes

## Work Log
- 2026-02-28: Identified by code-simplicity-reviewer and kieran-typescript-reviewer in competitor table code review
