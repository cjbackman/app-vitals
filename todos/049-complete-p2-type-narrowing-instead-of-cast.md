---
status: complete
priority: p2
issue_id: "049"
tags: [code-review, quality, typescript]
dependencies: []
---

# P2: Replace `(data as AppData)` cast with proper type narrowing

## Problem Statement

`CompetitorTable.tsx` uses a boolean variable `hasData` to narrow `data`, but TypeScript cannot use a plain boolean as a type guard — the narrowing is lost. The `as AppData` casts that follow are papering over this gap. The correct fix is to narrow `data` directly in the conditional expression, which TypeScript can track.

## Findings

- `components/CompetitorTable.tsx:119-121`:
  ```typescript
  const hasData = data !== null && !isApiError(data);
  const score = hasData ? (data as AppData).score : null;
  const reviewCount = hasData ? (data as AppData).reviewCount : null;
  ```
  `hasData` is `boolean`, not a type predicate — TypeScript still sees `data` as `AppData | ApiError | null` inside the ternary branches
- `isApiError` is already a proper type guard (`data is ApiError`) — it just needs to be applied where TypeScript can track the result
- Identified by kieran-typescript-reviewer and code-simplicity-reviewer

## Proposed Solutions

### Option A: Extract to `appData` variable (Recommended)
Replace lines 119-121 with:
```typescript
const appData = data !== null && !isApiError(data) ? data : null;
const score = appData?.score ?? null;
const reviewCount = appData?.reviewCount ?? null;
```

TypeScript narrows `data` to `AppData` in the truthy branch and the result is typed as `AppData | null`. No casts required. `appData?.score` is compiler-verified.

**Pros:** No casts, compiler-verified, cleaner
**Cons:** None
**Effort:** Tiny
**Risk:** None — functionally identical

### Option B: Inline narrowing at each use
```typescript
const score = data !== null && !isApiError(data) ? data.score : null;
const reviewCount = data !== null && !isApiError(data) ? data.reviewCount : null;
```
Repeats the guard twice but avoids the intermediate variable.

**Pros:** No extra variable
**Cons:** Duplicates the guard condition
**Effort:** Tiny
**Risk:** None

## Acceptance Criteria
- [ ] No `as AppData` casts in `CompetitorTable.tsx`
- [ ] TypeScript compiler verifies the narrowing (no `@ts-ignore` or `as` needed)
- [ ] All tests pass

## Work Log
- 2026-02-28: Identified by kieran-typescript-reviewer and code-simplicity-reviewer in competitor table code review
