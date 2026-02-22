---
title: SQLite LIMIT returns oldest rows, not newest
date: 2026-02-22
category: database-issues
module: snapshots
tags: [sqlite, sql, better-sqlite3, ordering, pagination]
symptoms:
  - Sparkline shows old data instead of recent history
  - LIMIT 30 returns the 30 oldest rows
---

# SQLite LIMIT returns oldest rows, not newest

## Problem

`ORDER BY saved_at ASC LIMIT 30` returns the 30 **oldest** rows. SQL evaluates `ORDER BY` before `LIMIT`, so ascending order with a limit gives you the first 30 in ascending time — the oldest records.

## Fix

Use a subquery. The inner query gets the 30 newest (DESC + LIMIT); the outer query re-orders them chronologically for display:

```sql
SELECT id, store, app_id, saved_at, score, review_count, min_installs
FROM (
  SELECT id, store, app_id, saved_at, score, review_count, min_installs
  FROM snapshots
  WHERE store = ? AND app_id = ?
  ORDER BY saved_at DESC
  LIMIT 30
)
ORDER BY saved_at ASC
```

File: `lib/snapshots.ts` → `getSnapshots()`

## Prevention

When you need the N most recent rows in ascending order, always use this two-level pattern. A single `ORDER BY ... ASC LIMIT N` can never return the newest-N in chronological order.
