---
status: pending
priority: p3
issue_id: "064"
tags: [code-review, performance]
dependencies: []
---

# Snapshot Over-Fetching: CompetitorTable Fetches 30 Rows, Uses 2

## Problem Statement

`/api/snapshots` always returns up to 30 snapshots. `computeSnapshotDelta` in `CompetitorTable` only needs the last 2. The remaining 28 rows are serialized, transmitted, and deserialized for no benefit. `AppCard` legitimately uses all 30 for sparklines. The mismatch grows as more preset apps are added.

## Findings

- `lib/snapshots.ts:39–46` — hardcoded `LIMIT 30`
- `components/CompetitorTable.tsx` — `computeSnapshotDelta` uses only `.at(-1)` and `.at(-2)`
- At 2 preset apps: 4 snapshot fetches per CompetitorTable pair × 30 rows = 120 rows fetched, 8 actually used (93% waste for velocity)
- `AppCard` uses all 30 for sparkline rendering — cannot reduce globally
- Performance reviewer: "Priority 3 — add `limit` parameter"

## Proposed Solutions

### Option 1: Add `limit` query parameter to `/api/snapshots`

**Approach:**
```typescript
// app/api/snapshots/route.ts
const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "30"), 30);

// lib/snapshots.ts — add limit parameter to getSnapshots
export async function getSnapshots(store, appId, limit = 30): Promise<Snapshot[]>
// SQL: ORDER BY saved_at DESC LIMIT ? (pass limit)
```
`CompetitorTable` calls `/api/snapshots?store=...&appId=...&limit=2`
`AppCard` calls without `limit` (gets default 30)

**Pros:** ~93% payload reduction per CompetitorTable snapshot fetch; no change to AppCard; minimal SQL change
**Cons:** API surface grows by one parameter
**Effort:** 45 minutes (including tests)
**Risk:** Low

---

### Option 2: Accept current waste at 2 preset apps

**Approach:** Do nothing now; revisit at 10+ preset apps when the overhead becomes meaningful.

**Pros:** No code change
**Cons:** Slightly inefficient; easy to fix when it matters
**Effort:** 0
**Risk:** None

---

## Recommended Action

Option 2 for now (YAGNI — 2 preset apps means trivial overhead); create this todo so the optimization is tracked for when preset count grows.

## Technical Details

**Affected files (when implemented):**
- `app/api/snapshots/route.ts` — add `limit` param validation
- `lib/snapshots.ts` — parameterize LIMIT
- `components/CompetitorTable.tsx` — add `limit=2` to fetch URL
- Tests for both

## Acceptance Criteria

- [ ] `limit` query param accepted by `/api/snapshots`
- [ ] Default is 30 (backward compatible)
- [ ] Max is 30 (no over-fetching allowed)
- [ ] `CompetitorTable` passes `limit=2`
- [ ] `AppCard` unchanged (gets default 30)
- [ ] `isRelease` computation still correct with limit=2 (only needs last 2)

## Work Log

### 2026-03-01 - Discovery

**By:** Performance reviewer (Priority 3 recommendation)
