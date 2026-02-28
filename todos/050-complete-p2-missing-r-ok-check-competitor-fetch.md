---
status: complete
priority: p2
issue_id: "050"
tags: [code-review, quality, consistency]
dependencies: []
---

# P2: Missing `r.ok` check before `r.json()` in CompetitorTable — inconsistent with AppCard

## Problem Statement

`CompetitorTable.tsx` calls `r.json()` without checking `r.ok` first. `AppCard.tsx` consistently checks `r.ok` before parsing. If the API returns a non-2xx status with a non-JSON body (e.g. a 502 from a proxy, a 413 request-too-large error), `r.json()` will throw and the `Promise.allSettled` slot will settle as `"rejected"`, silently leaving that competitor row in the loading/dash state forever. The behavior degrades correctly but arrives via the exception path rather than the intentional error path.

## Findings

- `components/CompetitorTable.tsx:65` — `r.json()` called without `r.ok` guard:
  ```typescript
  .then((r) => r.json() as Promise<AppData | ApiError>)
  ```
- `components/AppCard.tsx:92-94` — established pattern:
  ```typescript
  .then((r) => (r.ok ? (r.json() as Promise<Snapshot[]>) : Promise.reject(r)))
  .then((d) => setSnapshots(Array.isArray(d) ? d : []))
  .catch(() => {}); // best-effort
  ```
- The API routes (`/api/ios`, `/api/android`) always return typed JSON — but Next.js runtime errors (502, 503) or edge proxy errors produce non-JSON bodies
- `Promise.allSettled` catches the throw, so the practical outcome is a silent dash — no crash — but it's inconsistent
- Identified by pattern-recognition-specialist and security-sentinel

## Proposed Solutions

### Option A: Add `r.ok` guard matching AppCard pattern (Recommended)
Change `CompetitorTable.tsx` line 65:
```typescript
// Before:
.then((r) => r.json() as Promise<AppData | ApiError>)

// After:
.then((r) => (r.ok ? (r.json() as Promise<AppData | ApiError>) : Promise.reject(r)))
```

The rejected promise from a non-ok response will be caught by `Promise.allSettled` as `status: "rejected"`, which maps to `data: null` in the row — same end result, but via the explicit error path.

**Pros:** Consistent with AppCard, defensive against proxy errors, intent is clear
**Cons:** Slightly longer line
**Effort:** Tiny
**Risk:** None — behavior is the same for non-ok responses, better for ok responses

### Option B: Add a comment explaining why r.ok is omitted
Document that `allSettled` handles the failure case, accepting the inconsistency.

**Pros:** No code change
**Cons:** Still inconsistent; future contributors will copy the wrong pattern
**Effort:** Tiny
**Risk:** Pattern propagation

## Acceptance Criteria
- [ ] `CompetitorTable.tsx` checks `r.ok` before calling `r.json()`
- [ ] Pattern is consistent with `AppCard.tsx`'s fetch approach
- [ ] All tests pass (may need to update the mock fetch to return `ok: false` for error cases)

## Work Log
- 2026-02-28: Identified by pattern-recognition-specialist and security-sentinel in competitor table code review
