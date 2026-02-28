---
status: complete
priority: p3
issue_id: "052"
tags: [code-review, quality, documentation]
dependencies: []
---

# P3: `CompetitorRow.data: null` comment is misleading — null means loading OR fetch failed

## Problem Statement

The `CompetitorRow` interface comment says `null = loading` but `null` is also the value set when a fetch rejects (network error, abort, non-ok response). If a fetch fails silently, the row shows the same dashes as a loading row — they are indistinguishable. The comment should reflect reality, and if future error UI is ever needed, the type would need to change.

## Findings

- `components/CompetitorTable.tsx:19-22`:
  ```typescript
  interface CompetitorRow {
    preset: PresetApp;
    data: AppData | ApiError | null; // null = loading
  }
  ```
- `components/CompetitorTable.tsx:72-75` — rejected `allSettled` slot maps to `data: null`:
  ```typescript
  result.status === "fulfilled"
    ? result.value
    : { preset: competitors[i]!, data: null }
  ```
  So `null` is both "waiting" and "failed"
- Identified by kieran-typescript-reviewer

## Proposed Solutions

### Option A: Fix the comment (Minimal — Recommended for now)
```typescript
interface CompetitorRow {
  preset: PresetApp;
  data: AppData | ApiError | null; // null = loading or fetch failed
}
```

**Pros:** Accurate, no structural change
**Cons:** Still can't distinguish loading from failed in render
**Effort:** Trivial
**Risk:** None

### Option B: Add explicit error state to type (Future-proofing)
Change `null` to a discriminated union:
```typescript
type CompetitorRowData =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: AppData | ApiError };
```
This enables showing an error indicator instead of permanent dashes when a fetch fails.

**Pros:** Full expressiveness for future error UI
**Cons:** Significant refactor; CompetitorTable is transitional (will be replaced by ComparisonCharts)
**Effort:** Medium
**Risk:** Low (isolated to CompetitorTable)

## Acceptance Criteria
- [ ] The comment on `CompetitorRow.data` accurately describes when `null` is used
- [ ] All tests pass

## Work Log
- 2026-02-28: Identified by kieran-typescript-reviewer in competitor table code review
