---
status: pending
priority: p2
issue_id: "058"
tags: [code-review, architecture, yagni]
dependencies: []
---

# Delete `ComparisonCharts.tsx` and `formatPercent` — Dead Code

## Problem Statement

`components/ComparisonCharts.tsx` (310 lines) and its test suite (`__tests__/components/ComparisonCharts.test.tsx`, ~300 lines) are not imported anywhere in the render tree. `SearchPage.tsx` still uses `CompetitorTable`. This violates the CLAUDE.md rule: "Build only what is needed now. No speculative abstractions."

`formatPercent` in `lib/format.ts` is only called from `ComparisonCharts.tsx`. With the component dead, `formatPercent` also has no production caller.

Three independent reviewers flagged this (TypeScript, Simplicity, Pattern).

## Findings

- `components/ComparisonCharts.tsx` — 310 lines, no import in any component in the render tree
- `__tests__/components/ComparisonCharts.test.tsx` — 300 lines of tests for dead code
- `lib/format.ts:27–30` — `formatPercent` exported but only called from `ComparisonCharts`
- `__tests__/lib/format.test.ts` — `formatPercent` test block (~10 lines)
- The plan's Phase 1 ("Remove competitor AppCards, add `<ComparisonCharts>`") was not completed; the revert was correct but the code was left behind
- CLAUDE.md: "Build only what is needed now. No speculative abstractions"

## Proposed Solutions

### Option 1: Delete both files and `formatPercent` now

**Approach:** Remove `ComparisonCharts.tsx`, its test file, `formatPercent` from `lib/format.ts`, and the `formatPercent` test block. Re-add in the commit that actually wires `<ComparisonCharts>` into `SearchPage`.

**Pros:** ~620 LOC removed; no maintenance liability; respects YAGNI; clears confusion about what is "done"
**Cons:** If `ComparisonCharts` is added back in the next PR, it needs to be re-added
**Effort:** 15 minutes
**Risk:** None — nothing in production calls these files

---

### Option 2: Wire `ComparisonCharts` into `SearchPage` in this PR

**Approach:** Complete the original Phase 1: add `<ComparisonCharts>` below the Comparison section in `SearchPage`, replacing or supplementing `CompetitorTable`.

**Pros:** Feature ships; no code wasted
**Cons:** User previously rejected the chart-first approach ("Charts are too confusing with different scales"); requires product decision on where/how to show it
**Effort:** 1–2 hours (including addressing the independent Y-scale UX concern)
**Risk:** Medium — requires product clarity on what replaces what

---

## Recommended Action

Option 1 — delete now, re-add when wired. `buildAxisFormat` retains its one production caller (`SnapshotHistory.tsx`) so it stays.

## Technical Details

**Files to delete:**
- `components/ComparisonCharts.tsx`
- `__tests__/components/ComparisonCharts.test.tsx`

**Files to edit:**
- `lib/format.ts` — remove `formatPercent` (lines 27–30)
- `__tests__/lib/format.test.ts` — remove `formatPercent` describe block

## Acceptance Criteria

- [ ] `components/ComparisonCharts.tsx` deleted
- [ ] `__tests__/components/ComparisonCharts.test.tsx` deleted
- [ ] `formatPercent` removed from `lib/format.ts`
- [ ] `formatPercent` test block removed from `__tests__/lib/format.test.ts`
- [ ] All remaining tests pass
- [ ] No orphaned imports

## Work Log

### 2026-03-01 - Discovery

**By:** Simplicity reviewer, Pattern reviewer, TypeScript reviewer

**Findings:** 3 independent reviewers flagged this as the highest-impact simplification (~620 LOC)
