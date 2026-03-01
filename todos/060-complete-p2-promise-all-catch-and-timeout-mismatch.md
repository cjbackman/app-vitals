---
status: pending
priority: p2
issue_id: "060"
tags: [code-review, reliability, quality]
dependencies: []
---

# Add `.catch` to `Promise.all` in CompetitorTable + Align Timeouts

## Problem Statement

Two related reliability issues in `components/CompetitorTable.tsx`:

1. The outer `Promise.all` has no `.catch`. While `Promise.allSettled` cannot reject, a future refactor replacing `allSettled` with `all` would introduce an unhandled promise rejection with no warning — and the missing `.catch` gives no signal that this path was intentionally considered.

2. `CompetitorTable` uses a 15s timeout; `SearchPage` uses a 10s timeout. Both hit the same backend scrapers. If the scraper times out for `SearchPage` at 10s (showing an error in the leading card), `CompetitorTable` continues spinning for 5 more seconds. This is jarring: "card shows error, table still loading."

## Findings

- `components/CompetitorTable.tsx:102–123` — `Promise.all([...]).then(...)` with no `.catch`
- `components/CompetitorTable.tsx:78` — `setTimeout(..., 15_000)`
- `components/SearchPage.tsx:56` — `setTimeout(..., 10_000)` (different timeout)
- Race conditions reviewer confirmed: no render flash from batched state setters (React 18 batches them); abort guard works correctly; the missing `.catch` is the real gap

## Proposed Solutions

### Option 1: Add `.catch` + align timeouts

**Approach:**
```typescript
Promise.all([
  Promise.allSettled(dataFetches),
  Promise.allSettled(snapshotFetches),
]).then(([dataResults, snapshotResults]) => {
  if (controller.signal.aborted) return;
  clearTimeout(timeoutId);
  // ...
}).catch((err) => {
  // Promise.allSettled cannot reject; this path is unreachable under normal conditions.
  if (!controller.signal.aborted) {
    setRows(competitors.map((preset) => ({ preset, data: null, velocity: null })));
  }
});
```
Change `setTimeout(..., 15_000)` to `setTimeout(..., 10_000)` to match `SearchPage`.

**Pros:** Explicit about unreachability; surfaced if contract ever breaks; consistent UX on timeout
**Cons:** None
**Effort:** 10 minutes
**Risk:** None

---

## Recommended Action

Option 1. Add the `.catch` with a comment explaining why it should be unreachable, and align the timeout to 10s.

## Technical Details

**Affected files:**
- `components/CompetitorTable.tsx:78` (timeout)
- `components/CompetitorTable.tsx:102–123` (add `.catch`)

## Acceptance Criteria

- [ ] `.catch` added to outer `Promise.all` chain
- [ ] Timeout aligned to 10s (matching `SearchPage`)
- [ ] Comment explains `allSettled` cannot reject
- [ ] Existing tests pass

## Work Log

### 2026-03-01 - Discovery

**By:** Race conditions reviewer
