---
date: 2026-02-23
topic: sqlite-bulk-insert-transaction
category: database-issues
tags: [sqlite, performance, better-sqlite3, transaction, atomicity]
symptoms:
  - "Bulk import of N rows takes O(N) seconds instead of sub-second"
  - "Partial data committed after a crash mid-import"
  - "1000 individual fsync calls per import"
module: snapshots-bulk-import
---

# Wrap SQLite Bulk Inserts in a Transaction

## Problem

Each `stmt.run()` call in better-sqlite3 without an explicit transaction is an implicit auto-commit. SQLite flushes the WAL to disk (`fsync`) on every commit. At 1000 rows:

- **Performance**: 1000 × 1–5 ms/fsync = 1–5 seconds of wall time
- **Atomicity**: If the process crashes at row 500, rows 1–500 are durably committed; rows 501–1000 are lost with no signal to the user

## Fix

Use `db.transaction()` to wrap the loop:

```typescript
const stmt = db.prepare("INSERT OR IGNORE INTO snapshots (...) VALUES (?, ?, ?, ?, ?, ?)");

const importAll = db.transaction((rows: ValidatedRow[]) => {
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = stmt.run(row.store, row.appId, row.savedAt, row.score, row.reviewCount, row.minInstalls);
    result.changes === 1 ? inserted++ : skipped++;
  }
  return { inserted, skipped };
});

return NextResponse.json(importAll(validatedRows));
```

`db.transaction()` returns a function. When called, it executes the callback inside a single BEGIN/COMMIT. On any thrown exception it issues a ROLLBACK automatically.

## Performance Impact

| Rows | Without transaction | With transaction |
|------|---------------------|-----------------|
| 100  | 100–500 ms          | ~5 ms           |
| 1000 | 1–5 s               | ~30 ms          |

A single `fsync` instead of N.

## Test Mock Pattern

In Jest tests, mock `db.transaction()` to call the callback synchronously:

```typescript
const mockTransaction = jest.fn().mockImplementation(
  (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => fn(...args)
);
const mockDb = { prepare: mockPrepare, transaction: mockTransaction };
```

Remember to reset and reinitialise `mockTransaction` in `beforeEach`.

## Prevention

Whenever inserting more than 1 row in a loop with better-sqlite3, always use `db.transaction()`. The API is synchronous — no async/await needed.
