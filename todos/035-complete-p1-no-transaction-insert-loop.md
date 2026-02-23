---
status: pending
priority: p1
issue_id: "035"
tags: [code-review, performance, data-integrity, pr-4]
dependencies: []
---

# P1: No transaction around bulk insert loop — 1000 fsyncs + no atomicity

## Problem Statement

`POST /api/snapshots/bulk` runs up to 1000 individual `stmt.run()` calls without wrapping them in an explicit transaction. In better-sqlite3, every write without an explicit transaction is an implicit auto-commit, which triggers a full `fsync` to disk per row. At 1000 rows this means 1000 disk flushes, causing imports to take 1–5 seconds of avoidable wall time. More critically, there is no atomicity: if the process crashes mid-loop, rows 1–N are durably committed and rows N+1–1000 are silently lost. The user receives no response and cannot tell where the boundary is.

## Findings

- **`app/api/snapshots/bulk/route.ts:126–145`** — insert loop with no surrounding `db.transaction()`
- Performance agent: 1000 rows expected to take 1–5s without transaction vs <50ms with one
- Data integrity agent: confirmed partial import on crash with no recovery signal
- Both agents marked this P1

## Proposed Solutions

### Option A: Wrap with `db.transaction()` — Recommended

```typescript
// app/api/snapshots/bulk/route.ts
const db = getDb();
const stmt = db.prepare(
  "INSERT OR IGNORE INTO snapshots (store, app_id, saved_at, score, review_count, min_installs) VALUES (?, ?, ?, ?, ?, ?)"
);

const importAll = db.transaction((validatedRows: Array<Record<string, unknown>>) => {
  let inserted = 0;
  let skipped = 0;
  for (const row of validatedRows) {
    const savedAt = normalizeSavedAt(row.savedAt as string)!;
    const result = stmt.run(
      row.store, row.appId, savedAt, row.score, row.reviewCount,
      (row.minInstalls as number | undefined) ?? null
    );
    result.changes === 1 ? inserted++ : skipped++;
  }
  return { inserted, skipped };
});

return NextResponse.json(importAll(rows as Array<Record<string, unknown>>));
```

**Pros:** Reduces 1000 fsyncs to 1 (99% perf improvement), atomic commit or rollback on any error, only 6 lines changed
**Cons:** None meaningful for this use case
**Effort:** Small
**Risk:** Low — better-sqlite3 transaction API is stable

### Option B: Keep current code but document limitation

Add a comment explaining the trade-off and move on.

**Pros:** Zero code change
**Cons:** Performance stays poor, no atomicity
**Effort:** Minimal
**Risk:** Low to keep, but user experience suffers

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `app/api/snapshots/bulk/route.ts` lines 126–145
- **Test update needed:** Update `__tests__/api/snapshots-bulk.test.ts` — the mock currently uses `mockRun.mockReturnValue({ changes: 1 })`, which remains valid inside a transaction

## Acceptance Criteria

- [ ] Import of 1000 rows completes visibly faster (sub-second on typical SSD)
- [ ] A crash mid-import results in 0 rows committed (not N rows)
- [ ] Existing tests still pass

## Work Log

- 2026-02-23: Created from PR #4 code review — performance oracle (P1) + data integrity guardian (P1)

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
- better-sqlite3 transaction docs: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction---function
