---
status: pending
priority: p2
issue_id: "038"
tags: [code-review, data-integrity, correctness, pr-4]
dependencies: []
---

# P2: UNIQUE INDEX silent failure disables deduplication with no warning

## Problem Statement

`lib/db.ts` wraps `CREATE UNIQUE INDEX` in a `catch {}` that swallows all exceptions. When this fails (e.g., a dev DB already has duplicate rows), `INSERT OR IGNORE` has no constraint to trigger against — it degrades to plain `INSERT`. Every re-import of the same file inserts duplicates silently. The user sees `inserted: N, skipped: 0` on every run. Trend sparklines display doubled data points. There is no error, no log entry, and no warning.

The feature's entire deduplication contract depends on this index existing.

## Findings

- **`lib/db.ts:22–31`** — `try { CREATE UNIQUE INDEX } catch { /* silent */ }`
- Data integrity agent: confirmed that without the index, `INSERT OR IGNORE` inserts every row unconditionally
- Simplicity agent: flagged as latent correctness risk

## Proposed Solutions

### Option A: Log a warning + set a flag, check flag in route — Recommended

```typescript
// lib/db.ts
const globalForDb = global as typeof global & {
  _db?: Database.Database;
  _dbDedupDisabled?: boolean;
};

try {
  globalForDb._db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_dedup ON snapshots (store, app_id, saved_at)"
  );
} catch {
  console.warn(
    "[db] UNIQUE INDEX could not be created — bulk import will insert duplicates. " +
    "Clean up with: DELETE FROM snapshots WHERE id NOT IN (SELECT MIN(id) FROM snapshots GROUP BY store, app_id, saved_at)"
  );
  globalForDb._dbDedupDisabled = true;
}
```

Then in `POST /api/snapshots/bulk`:
```typescript
const db = getDb();
if ((global as typeof global & { _dbDedupDisabled?: boolean })._dbDedupDisabled) {
  return NextResponse.json(
    { error: "Deduplication index is missing — import disabled. See server logs.", code: "SCRAPER_ERROR" },
    { status: 503 }
  );
}
```

**Pros:** User immediately sees the problem; server log explains recovery
**Cons:** Slightly more code, adds a global flag
**Effort:** Small
**Risk:** Low

### Option B: Auto-cleanup duplicates before creating the index

```typescript
globalForDb._db.exec(`
  DELETE FROM snapshots
  WHERE id NOT IN (
    SELECT MIN(id) FROM snapshots GROUP BY store, app_id, saved_at
  )
`);
globalForDb._db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_dedup ON snapshots (store, app_id, saved_at)"
);
```

**Pros:** Self-healing, no flag needed, index always created
**Cons:** Silently deletes data (keeps earliest duplicate, drops others) without user consent
**Effort:** Small
**Risk:** Medium — data deletion on startup without explicit user action

### Option C: Keep current behaviour — not recommended

The catch stays silent. Dev databases may have broken dedup silently.

**Pros:** Zero change
**Cons:** Deduplication is broken in common dev scenarios with no signal to the user
**Effort:** None
**Risk:** High for data integrity

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `lib/db.ts`, `app/api/snapshots/bulk/route.ts`
- **Test:** Difficult to test in unit tests (mocked DB); consider an integration test or manual verification step

## Acceptance Criteria

- [ ] When UNIQUE INDEX creation fails, a `console.warn` is emitted explaining the issue
- [ ] When the index is missing, the import route returns a clear error rather than silently inserting duplicates
- [ ] When the index is present, behaviour is unchanged

## Work Log

- 2026-02-23: Created from PR #4 code review — data integrity guardian (P2) + code simplicity reviewer

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
