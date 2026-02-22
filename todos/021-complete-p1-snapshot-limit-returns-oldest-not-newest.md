---
status: pending
priority: p1
issue_id: "021"
tags: [code-review, correctness, data-integrity]
dependencies: []
---

# P1: LIMIT 30 returns oldest 30 snapshots, not newest 30

## Problem Statement

`lib/snapshots.ts` uses `ORDER BY saved_at ASC LIMIT 30`. ASC ordering means the 30 *oldest* snapshots are returned, not the 30 most recent. For users with fewer than 30 snapshots this is invisible. Once they accumulate more than 30, new snapshots are silently excluded from sparklines and the chart shows only historical data.

## Findings

- **`lib/snapshots.ts:48`** — `ORDER BY saved_at ASC LIMIT 30`
- The plan doc describes the cap as "30 most recent" — intent is to show the newest 30
- Architecture Strategist and Data Integrity Guardian both flagged this as a semantic mismatch between documented intent and implementation

## Proposed Solutions

### Option A: Subquery to get newest 30 in chronological order (Recommended)

```ts
// lib/snapshots.ts
const rows = db.prepare(
  `SELECT id, store, app_id, saved_at, score, review_count, min_installs
   FROM (
     SELECT * FROM snapshots
     WHERE store = ? AND app_id = ?
     ORDER BY saved_at DESC
     LIMIT 30
   )
   ORDER BY saved_at ASC`
).all(store, appId) as SnapshotRow[];
```

Gets the 30 newest rows (DESC), then re-orders them ASC for sparklines. No index changes needed.

### Option B: Always ASC (accept oldest-30 behavior, update plan doc)

Update the plan and UI to clarify "shows oldest 30 snapshots" and add a display note. Simpler but arguably wrong UX.

**Recommended:** Option A — the plan clearly intends "most recent", the fix is minimal.

## Acceptance Criteria

- [ ] `getSnapshots` returns the 30 most recent snapshots when more than 30 exist
- [ ] Returned rows are still ordered ASC (chronological) for sparkline rendering
- [ ] Existing tests updated to reflect the new query
- [ ] Test added with >30 mock rows to verify only newest are returned

## Work Log

- 2026-02-22: Flagged by Architecture Strategist and Data Integrity Guardian in PR #3 review
