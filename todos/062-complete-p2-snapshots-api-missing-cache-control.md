---
status: pending
priority: p2
issue_id: "062"
tags: [code-review, performance]
dependencies: []
---

# `/api/snapshots` Missing `Cache-Control` Header

## Problem Statement

`/api/snapshots` returns no `Cache-Control` header. The existing `/api/ios` and `/api/android` routes both set `Cache-Control: public, s-maxage=3600, stale-while-revalidate=60`. Snapshot data changes only when the weekly cron runs — every page reload and navigation within a session re-fetches from Turso unnecessarily.

## Findings

- `app/api/snapshots/route.ts:33` — `NextResponse.json(snapshots)` with no headers
- `app/api/ios/route.ts` and `app/api/android/route.ts` (via `makeStoreHandler`) — both set `Cache-Control: public, s-maxage=3600`
- With 2 preset apps and 2 CompetitorTable instances: 4 snapshot fetches per page load, all cache-miss
- Snapshot data is written only by the weekly cron — a 5-minute CDN TTL is conservative; a 1-hour or 1-day TTL is equally correct
- Performance reviewer confirmed: highest impact-to-effort fix

## Proposed Solutions

### Option 1: Add `Cache-Control` matching the store routes

**Approach:**
```typescript
// app/api/snapshots/route.ts
return NextResponse.json(snapshots, {
  headers: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=60",
  },
});
```

**Pros:** Consistent with `/api/ios` and `/api/android`; Vercel CDN caches; 1-hour TTL safe given weekly cron cadence
**Cons:** After a cron run, cached responses may be stale for up to 1 hour
**Effort:** 5 minutes
**Risk:** None (read-only endpoint)

---

### Option 2: Shorter TTL (5 minutes) for a fresher feel

**Approach:** `s-maxage=300, stale-while-revalidate=60` — same as option 1 but more conservative TTL.

**Pros:** Fresher data after cron runs
**Cons:** Less cache benefit; still better than nothing
**Effort:** 5 minutes
**Risk:** None

---

## Recommended Action

Option 2 (300s) for conservatism — users reloading to check for fresh data will see updates within 5 minutes of a cron run. Can be bumped to 3600 once the cron cadence is confirmed stable.

## Technical Details

**Affected files:**
- `app/api/snapshots/route.ts:33`

## Acceptance Criteria

- [ ] `Cache-Control` header added to success response in `/api/snapshots`
- [ ] TTL ≥ 300 seconds
- [ ] `stale-while-revalidate` set

## Work Log

### 2026-03-01 - Discovery

**By:** Performance reviewer (Priority 1 recommendation)
