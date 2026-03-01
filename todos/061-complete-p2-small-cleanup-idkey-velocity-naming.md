---
status: pending
priority: p2
issue_id: "061"
tags: [code-review, quality]
dependencies: []
---

# Small Cleanup: `idKey`/`storeIdKey` Duplication + `Velocity` Naming

## Problem Statement

Two small issues in `components/CompetitorTable.tsx` found by multiple reviewers:

1. `storeIdKey` (line 71) and `idKey` (line 81, inside `useEffect`) compute the same expression. Having two names for the same derived value is confusing and a silent bug risk if they diverge.

2. The `Velocity` interface name is a misnomer. "Velocity" implies a rate of change per unit time. The fields are raw deltas between two consecutive snapshots, with no time dimension. The rest of the codebase uses the word "delta" (`formatDelta`, `pctDelta`). `Velocity` is inconsistent.

## Findings

- `components/CompetitorTable.tsx:71` — `const storeIdKey = store === "ios" ? "iosId" : "androidId"`
- `components/CompetitorTable.tsx:81` — `const idKey = store === "ios" ? "iosId" : "androidId"` (same expression, different name, inside `useEffect`)
- `idKey` at line 81 is used in the `useEffect` closure; `storeIdKey` is used in JSX render
- `interface Velocity { scoreDelta: number; reviewDelta: number }` — name implies time-rate; fields are raw deltas
- `computeVelocity` function name — same mismatch
- Pattern reviewer and Simplicity reviewer both flagged independently

## Proposed Solutions

### Option 1: Remove `idKey`, use `storeIdKey`; rename interface and function

**Approach:**
- Delete `const idKey = ...` inside `useEffect` (line 81)
- Replace the two uses of `idKey` inside `useEffect` with `storeIdKey`
- Rename `interface Velocity` → `interface SnapshotDelta`
- Rename `function computeVelocity` → `function computeSnapshotDelta`
- Rename `leadingVelocity` state → `leadingDelta`
- Rename `velocity` field in `CompetitorRow` → `delta`

**Pros:** Eliminates silent duplication; aligns naming with `formatDelta` vocabulary
**Cons:** Mechanical rename; no behavior change
**Effort:** 15 minutes
**Risk:** None (TypeScript will catch any missed renames)

---

## Recommended Action

Option 1 — both are mechanical fixes with no risk.

## Technical Details

**Affected files:**
- `components/CompetitorTable.tsx` — rename variables and interface throughout

## Acceptance Criteria

- [ ] `idKey` removed; `storeIdKey` used throughout the component
- [ ] `Velocity` → `SnapshotDelta` (or `Delta`); all references updated
- [ ] `computeVelocity` → `computeSnapshotDelta` (or `computeDelta`)
- [ ] `leadingVelocity` state → `leadingDelta`
- [ ] TypeScript compiles with no errors
- [ ] All tests pass

## Work Log

### 2026-03-01 - Discovery

**By:** Pattern reviewer (naming), Simplicity reviewer (idKey duplication)
