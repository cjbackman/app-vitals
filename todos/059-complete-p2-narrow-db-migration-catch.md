---
status: pending
priority: p2
issue_id: "059"
tags: [code-review, reliability, security]
dependencies: []
---

# Narrow `catch {}` in `lib/db.ts` — Swallows All Migration Errors

## Problem Statement

The `try/catch` around the `ALTER TABLE` migration in `lib/db.ts` silently discards every error, not just the expected "duplicate column name" case. A Turso connectivity failure, auth error, or malformed SQL would be swallowed and `getDb()` would return a client in an unknown schema state. Any subsequent `INSERT` that references the `version` column would then fail with a cryptic error rather than a clear migration failure.

Flagged by TypeScript reviewer, Data integrity reviewer, and Security reviewer independently.

## Findings

- `lib/db.ts:40–44` — bare `catch {}` with no error type check
- The SQLite/libSQL error message for a duplicate column is `"duplicate column name: version"`
- Any other error (auth, network, syntax) is silently discarded with the same no-op behavior
- Error is not logged — operators cannot distinguish a healthy startup from a failed migration in logs
- Subsequent INSERTs reference `version` in the column list; if the migration silently failed, those INSERTs will fail at write time, not startup time, making root cause hard to find

## Proposed Solutions

### Option 1: Check error message before swallowing

**Approach:**
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!message.includes("duplicate column name")) {
    throw err;
  }
}
```

**Pros:** Minimal change; expected error still silently ignored; unexpected errors surface immediately
**Cons:** Relies on SQLite/libSQL error message text (stable in practice)
**Effort:** 5 minutes
**Risk:** None

---

### Option 2: Log before swallowing (keep silent but observable)

**Approach:**
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!message.includes("duplicate column name")) {
    console.error("[db migration] unexpected error:", message);
  }
}
```

**Pros:** Doesn't throw — no risk of breaking startup; makes failures observable in logs
**Cons:** Application continues in potentially broken state
**Effort:** 5 minutes
**Risk:** None

---

## Recommended Action

Option 1 — re-throw unexpected errors. The migration runs once at cold start; a failure here should be fatal rather than silent.

Also: inline the loop — see todo #060 which recommends replacing the `for` loop with a direct `try/catch` per YAGNI.

## Technical Details

**Affected files:**
- `lib/db.ts:40–44`

## Acceptance Criteria

- [ ] `catch` block checks error message before swallowing
- [ ] "duplicate column name" errors still silently ignored
- [ ] All other errors re-thrown (or logged if softer approach chosen)
- [ ] Existing tests pass

## Work Log

### 2026-03-01 - Discovery

**By:** TypeScript reviewer, Data integrity reviewer, Security reviewer (3 independent reports)
