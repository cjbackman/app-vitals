---
status: complete
priority: p2
issue_id: "051"
tags: [code-review, performance, reliability]
dependencies: []
---

# P2: CompetitorTable has no fetch timeout — competitor rows can hang indefinitely

## Problem Statement

`SearchPage.handleSearch` aborts its leading app fetch after 10 seconds. `CompetitorTable`'s `useEffect` has no equivalent timeout — if a network connection stalls (not the server), competitor rows will show loading dashes until the user unmounts the component (navigates away) or triggers a new search. The server has a `maxDuration = 15` safety net, but client-side hangs beyond server-level failures are not bounded.

## Findings

- `components/SearchPage.tsx:57` — timeout on leading fetch:
  ```typescript
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  ```
- `components/CompetitorTable.tsx:54-79` — no equivalent timeout; only cleanup on unmount or `competitorKey` change
- Server routes: `export const maxDuration = 15` — only protects against server-side hangs, not network stalls
- Identified by performance-oracle

## Proposed Solutions

### Option A: Add `setTimeout` abort matching SearchPage's pattern (Recommended)
Inside the `CompetitorTable` `useEffect`, after creating the `AbortController`:

```typescript
useEffect(() => {
  setRows(competitors.map((preset) => ({ preset, data: null })));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000); // match server maxDuration
  const apiRoute = store === "ios" ? "ios" : "android";

  Promise.allSettled(/* ... */).then((results) => {
    if (controller.signal.aborted) return;
    setRows(/* ... */);
  });

  return () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
}, [store, competitorKey]);
```

Note the cleanup must clear the timeout too (currently it only calls `controller.abort()`).

**Pros:** Bounds competitor row loading state; consistent with SearchPage behavior; clears on unmount cleanly
**Cons:** Timed-out competitor rows show dashes with no indication of timeout vs. slow network
**Effort:** Small
**Risk:** Low — may time out on very slow networks, but 15s is generous

### Option B: Accept the current behavior
Document that competitor rows time out only on component unmount.

**Pros:** No change
**Cons:** User-facing hang with no escape
**Effort:** None
**Risk:** Poor UX on slow connections

## Acceptance Criteria
- [ ] `CompetitorTable` `useEffect` aborts competitor fetches after a defined timeout
- [ ] Cleanup function clears the timeout to prevent memory leaks on unmount
- [ ] Timeout value is consistent with or longer than `SearchPage`'s 10s timeout

## Work Log
- 2026-02-28: Identified by performance-oracle in competitor table code review
