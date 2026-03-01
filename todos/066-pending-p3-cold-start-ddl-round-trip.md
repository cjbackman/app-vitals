---
status: pending
priority: p3
issue_id: "066"
tags: [code-review, performance]
dependencies: []
---

# Cold-Start DDL Round-Trip: Run Migration Once, Not Every Cold Start

## Problem Statement

`lib/db.ts` runs `ALTER TABLE snapshots ADD COLUMN version TEXT` on every cold start (every Vercel serverless function invocation after idle). The `ALTER TABLE` is wrapped in `try/catch` — it succeeds on first run and silently swallows "duplicate column name" on all subsequent runs. This adds a DDL round-trip (a network call to Turso) to every cold-start path, including page loads and API fetches.

## Findings

- `lib/db.ts` — migration runs inside `getDb()` on every cold start
- `try/catch` with bare `catch {}` swallows "duplicate column name: version" silently (covered by todo #059)
- Turso is a remote database; even a lightweight DDL statement costs ~5–50 ms per cold start
- Standard pattern: use `PRAGMA user_version` to track schema version and skip migrations that have already run
- Performance reviewer: "cold-start DDL round-trip — use PRAGMA user_version"

## Proposed Solutions

### Option 1: Use `PRAGMA user_version` to skip migrations after first run

**Approach:**
```typescript
const SCHEMA_VERSION = 1;

async function runMigrations(client: Client): Promise<void> {
  const versionResult = await client.execute("PRAGMA user_version");
  const currentVersion = Number(versionResult.rows[0]?.[0] ?? 0);
  if (currentVersion >= SCHEMA_VERSION) return;

  if (currentVersion < 1) {
    // Idempotent: column may or may not exist
    try {
      await client.execute("ALTER TABLE snapshots ADD COLUMN version TEXT");
    } catch {
      // Already added
    }
  }

  await client.execute(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
```

`PRAGMA user_version` is a single local read inside Turso — no DDL execution cost on warm starts.

**Pros:** Eliminates migration round-trip on all subsequent cold starts; clean versioned schema evolution
**Cons:** Slightly more code; requires care when adding future migrations
**Effort:** 30 minutes
**Risk:** Low

---

### Option 2: Accept current state (YAGNI)

**Approach:** Leave the try/catch migration as-is once todo #059 narrows the catch. At 2 preset apps and low traffic, the occasional cold-start DDL cost is insignificant.

**Pros:** No code change
**Cons:** Extra round-trip on every cold start; won't scale cleanly with more migrations
**Effort:** 0
**Risk:** None

---

## Recommended Action

Option 2 for now (YAGNI at low traffic). Implement Option 1 when the number of migrations grows beyond 1–2 or when cold-start latency becomes a user-visible concern.

## Technical Details

**Affected files:**
- `lib/db.ts` — migration logic

## Acceptance Criteria

- [ ] Migration only runs when `PRAGMA user_version` is below current schema version
- [ ] Subsequent cold starts skip DDL entirely
- [ ] Schema version is incremented correctly after each migration
- [ ] Tests updated if migration logic is tested

## Work Log

### 2026-03-01 - Discovery

**By:** Performance reviewer
