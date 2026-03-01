---
title: "feat: Deploy to Vercel with Turso and weekly cron snapshot sync"
type: feat
date: 2026-02-28
---

# feat: Deploy to Vercel with Turso and weekly cron snapshot sync

## Overview

Deploy app-vitals to Vercel (free Hobby tier) with Turso as the hosted SQLite
database and cron-job.org as the weekly cron trigger. The weekly cron
auto-saves snapshots for all preset apps (both iOS and Android). No credit
card required.

**Stack:**
- **Vercel** — Next.js host, free Hobby tier, zero-config deploy
- **Turso** — hosted libSQL (SQLite-compatible), free tier (9 GB, 1B reads/mo)
- **cron-job.org** — free external cron, hits `GET /api/cron/snapshot` weekly

## Problem Statement

The app currently uses `better-sqlite3` backed by a local `./data/snapshots.db`
file. Vercel's serverless runtime has a read-only filesystem — the local DB
file cannot be written to. Migrating the database client to Turso's
`@libsql/client` keeps the same SQL schema and query logic while moving
persistence to a hosted remote SQLite instance. A new cron endpoint enables
fully-automated weekly snapshot collection.

## Proposed Solution

Five sequential phases:

1. **Swap DB client** — `better-sqlite3` → `@libsql/client`, update schema init
2. **Add cron endpoint** — `GET /api/cron/snapshot` with secret auth
3. **Update tests** — new async mock shapes
4. **Deploy + configure** — Vercel, Turso, cron-job.org setup steps

## Technical Approach

### Architecture

```
cron-job.org  ──── weekly GET ────►  Vercel
                  (Bearer secret)     /api/cron/snapshot
                                            │
                                            ▼
                                   fetchIosApp / fetchAndroidApp
                                   (App Store + Google Play — throw on error)
                                            │
                                            ▼
                                   saveSnapshot() × N
                                            │
                                            ▼
                                         Turso
                                   (hosted libSQL)
```

### lib/db.ts — async `getDb()`

`createClient()` is synchronous (just builds the config object); schema DDL
is async. Use a single `_dbPromise` global as both the race-condition gate and
the cached result — one global, no split state between `_db` and `_ready`.

```typescript
// lib/db.ts
import "server-only";
import { createClient, type Client } from "@libsql/client";

const globalForDb = globalThis as unknown as { _dbPromise?: Promise<Client> };

export function getDb(): Promise<Client> {
  globalForDb._dbPromise ??= (async () => {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");

    const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

    await client.batch(
      [
        `CREATE TABLE IF NOT EXISTS snapshots (
           id           INTEGER PRIMARY KEY AUTOINCREMENT,
           store        TEXT    NOT NULL,
           app_id       TEXT    NOT NULL,
           saved_at     TEXT    NOT NULL,
           score        REAL    NOT NULL,
           review_count INTEGER NOT NULL,
           min_installs INTEGER
         )`,
        // Only the UNIQUE index — it doubles as a lookup index on the same columns.
        // A separate plain idx_snapshots_lookup is redundant and has been removed.
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_dedup
           ON snapshots (store, app_id, saved_at)`,
      ],
      "write"
    );

    return client;
  })();

  return globalForDb._dbPromise;
}
```

**Why `??=` on `_dbPromise`:** the Promise is assigned synchronously before any
`await`, so concurrent callers see it immediately and skip re-initialisation.
This eliminates the race condition where two simultaneous cold-start requests
could each enter the init block before `_db` was set.

**Dev:** `TURSO_DATABASE_URL=file:./data/snapshots.db` (no auth token needed).
**Prod:** `TURSO_DATABASE_URL=libsql://…turso.io` + `TURSO_AUTH_TOKEN=<jwt>`.

### lib/snapshots.ts — async functions

`@libsql/client` has no `.prepare()`. Every call is `await db.execute({ sql, args })`.
`lastInsertRowid` is typed `bigint | undefined` — use `?? 0` before `Number()`.
Integer columns may be returned as `bigint` — use `Number()` on all numeric
fields, not `as number` casts (which don't protect against bigint at runtime).

```typescript
// lib/snapshots.ts
export async function saveSnapshot(
  store: "ios" | "android",
  appId: string,
  score: number,
  reviewCount: number,
  minInstalls?: number,
): Promise<Snapshot> {
  const db = await getDb();
  const savedAt = new Date().toISOString();
  const result = await db.execute({
    sql: "INSERT INTO snapshots (store, app_id, saved_at, score, review_count, min_installs) VALUES (?, ?, ?, ?, ?, ?)",
    args: [store, appId, savedAt, score, reviewCount, minInstalls ?? null],
  });
  return {
    id: Number(result.lastInsertRowid ?? 0),  // ?? 0: lastInsertRowid is bigint|undefined
    store,
    appId,
    savedAt,
    score,
    reviewCount,
    minInstalls,
  };
}

export async function getSnapshots(
  store: "ios" | "android",
  appId: string,
): Promise<Snapshot[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT id, store, app_id, saved_at, score, review_count, min_installs
          FROM (
            SELECT id, store, app_id, saved_at, score, review_count, min_installs
            FROM snapshots
            WHERE store = ? AND app_id = ?
            ORDER BY saved_at DESC
            LIMIT 30
          )
          ORDER BY saved_at ASC`,
    args: [store, appId],
  });
  return result.rows.map((r) => ({
    id:          Number(r.id),
    store:       r.store as "ios" | "android",
    appId:       r.app_id as string,
    savedAt:     r.saved_at as string,
    score:       Number(r.score),        // Number() guards against bigint return
    reviewCount: Number(r.review_count), // Number() guards against bigint return
    minInstalls: r.min_installs != null ? Number(r.min_installs) : undefined,
  }));
}
```

### app/api/snapshots/bulk/route.ts — batch insert

Replace `db.transaction()` with `client.batch([...stmts], "write")`.

> **Note:** `batch()` is pipelined, not transactional — if the process crashes
> mid-batch, partial inserts may be committed. For an idempotent import with
> `INSERT OR IGNORE` this is acceptable; `INSERT OR IGNORE` on a re-run skips
> already-inserted rows cleanly.

Each statement in the batch returns its own `ResultSet`, so `inserted`/`skipped`
counting is preserved via `rowsAffected`:

```typescript
// app/api/snapshots/bulk/route.ts (core loop)
const db = await getDb();
const stmts = rows.map((row) => ({
  sql: "INSERT OR IGNORE INTO snapshots (store, app_id, saved_at, score, review_count, min_installs) VALUES (?, ?, ?, ?, ?, ?)",
  args: [row.store, row.appId, row.savedAt, row.score, row.reviewCount, row.minInstalls ?? null],
}));
const results = await db.batch(stmts, "write");
const inserted = results.filter((r) => r.rowsAffected === 1).length;
const skipped  = results.length - inserted;
```

Remove the `_dbDedupDisabled` global flag entirely — it was a workaround for
local dev databases where the unique index might not exist. The `UNIQUE INDEX`
in `getDb()` now guarantees it exists on every fresh Turso database.

### app/api/cron/snapshot/route.ts — new file

> **Important:** `fetchIosApp` and `fetchAndroidApp` **throw** on error — they
> do not return `ApiError`. Do NOT use `isApiError()` here; it is dead code in
> this context. `Promise.allSettled` catches thrown errors in the `rejected`
> bucket automatically.

```typescript
// app/api/cron/snapshot/route.ts
import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { PRESET_APPS } from "@/components/PresetApps";
import { fetchIosApp } from "@/lib/ios-store";
import { fetchAndroidApp } from "@/lib/android-store";
import { saveSnapshot } from "@/lib/snapshots";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const jobs = PRESET_APPS.flatMap((preset) => [
    { store: "ios" as const,     fetch: () => fetchIosApp(preset.iosId),         id: preset.iosId     },
    { store: "android" as const, fetch: () => fetchAndroidApp(preset.androidId), id: preset.androidId },
  ]);

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const data = await job.fetch(); // throws on error — caught by allSettled
      await saveSnapshot(job.store, job.id, data.score, data.reviewCount, data.minInstalls);
    })
  );

  const saved  = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason as Error)?.message ?? "unknown");

  return NextResponse.json({ saved, failed, errors });
}
```

## Implementation Phases

### Phase 1: Dependency swap + env setup

- [x] `npm uninstall better-sqlite3 @types/better-sqlite3`
- [x] `npm install @libsql/client`
- [x] Update `next.config.ts`: remove `"better-sqlite3"` from `serverExternalPackages`
- [x] Create `.env.example` (committed):
  ```
  TURSO_DATABASE_URL=file:./data/snapshots.db
  TURSO_AUTH_TOKEN=
  CRON_SECRET=
  ```
- [x] Create `.env.local` (gitignored, copied from example for local dev):
  ```
  TURSO_DATABASE_URL=file:./data/snapshots.db
  # TURSO_AUTH_TOKEN not required for local file: URLs
  CRON_SECRET=local-dev-secret
  ```
- [x] Ensure `data/` and `.env.local` are in `.gitignore`

### Phase 2: Migrate DB layer

- [x] Rewrite `lib/db.ts`:
  - Single `_dbPromise` global (no split `_db`/`_ready`)
  - Fast-fail guard: `if (!url) throw new Error("TURSO_DATABASE_URL is not set")`
  - Drop `idx_snapshots_lookup` — only `idx_snapshots_dedup` needed
  - Remove old `try/catch` around index creation entirely
- [x] Remove `_dbDedupDisabled` global and every reference to it:
  - `lib/db.ts` — delete `_dbDedupDisabled` flag and `try/catch` block
  - `app/api/snapshots/bulk/route.ts` — delete the 503 guard block (lines 168–179)
- [x] Rewrite `lib/snapshots.ts`:
  - `saveSnapshot` async, `Number(result.lastInsertRowid ?? 0)`
  - `getSnapshots` async with explicit column list (no `SELECT *`), `Number()` on all numerics
- [x] Update `app/api/snapshots/route.ts`:
  - Add `await` to `saveSnapshot(...)` and `getSnapshots(...)` calls
  - **Note:** forgetting `await` here is a silent bug — the route returns a serialised `{}` Promise instead of actual data, with no compile error
  - Add `export const runtime = "nodejs"`
- [x] Update `app/api/snapshots/bulk/route.ts`:
  - Replace `db.transaction(fn)` with `await db.batch(stmts, "write")`
  - Use `r.rowsAffected` (not `r.changes`) for inserted/skipped counting
  - Add `export const runtime = "nodejs"`

### Phase 3: Add cron endpoint

- [x] Create `app/api/cron/snapshot/route.ts` (see design above)
- [x] Verify `fetchIosApp` and `fetchAndroidApp` (uncached versions) are exported from `lib/ios-store.ts` and `lib/android-store.ts`

### Phase 4: Update tests

All `getDb` mocks change from sync better-sqlite3 shape to async libsql shape.

**Mock pattern — before and after:**

```typescript
// BEFORE (better-sqlite3 sync mock)
const mockRun     = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });
const mockAll     = jest.fn().mockReturnValue([]);
const mockPrepare = jest.fn().mockReturnValue({ run: mockRun, all: mockAll });
const mockDb      = { prepare: mockPrepare, exec: jest.fn(), transaction: jest.fn() };
jest.mock("@/lib/db", () => ({ getDb: () => mockDb }));

// AFTER (@libsql/client async mock)
// Note: use lazy () => Promise.resolve(mockDb) NOT mockResolvedValue(mockDb)
// because jest.mock factories are hoisted above const declarations (TDZ issue).
const mockExecute = jest.fn().mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: undefined });
const mockBatch   = jest.fn().mockResolvedValue([]);
const mockDb      = { execute: mockExecute, batch: mockBatch };
jest.mock("@/lib/db", () => ({ getDb: () => Promise.resolve(mockDb) }));
```

- [x] Update `__tests__/lib/snapshots.test.ts`:
  - Async mock shapes (see above)
  - All `saveSnapshot(...)` and `getSnapshots(...)` calls need `await`
  - `mockReturnValue([])` → `mockResolvedValue([])` for async fns under test
  - Error cases: `mockImplementation(() => { throw ... })` → `mockRejectedValue(...)`
- [x] Update `__tests__/api/snapshots.test.ts`:
  - Async `getDb` mock
  - `runtime` export does not affect tests — no change needed there
- [x] Update `__tests__/api/snapshots-bulk.test.ts`:
  - Delete test case `"returns 503 when dedup index is disabled"` (and any describe block containing it)
  - Delete `beforeEach` cleanup: `delete (global as { _dbDedupDisabled?: boolean })._dbDedupDisabled`
  - Update mock: `db.transaction` → `db.batch`; assert `batch()` is called with all statements in a single call (not `execute()` in a loop — that would be a correctness regression)
  - `rowsAffected` (not `changes`) in mock return values
- [x] Create `__tests__/api/cron/snapshot.test.ts` (`@jest-environment node`):
  - Returns 401 without `Authorization` header
  - Returns 401 with wrong secret
  - Calls `fetchIosApp` and `fetchAndroidApp` for each preset app
  - Calls `saveSnapshot` for each successful fetch
  - Returns `{ saved: 4, failed: 0, errors: [] }` on full success
  - Returns `{ saved: 3, failed: 1, errors: ["..."] }` when one fetch throws
  - Does NOT call `saveSnapshot` for failed fetches

### Phase 5: Deploy

**One-time setup (manual steps, not code):**

1. **Turso:**
   ```bash
   brew install tursodatabase/tap/turso
   turso auth login
   turso db create app-vitals
   turso db show app-vitals       # copy the libsql:// URL
   turso db tokens create app-vitals  # copy the JWT token
   ```
   Schema is auto-created on first request via `getDb()` DDL batch.

2. **Vercel:** connect GitHub repo at vercel.com (or `npx vercel`). Add env vars:
   - `TURSO_DATABASE_URL` — `libsql://…turso.io` from step 1
   - `TURSO_AUTH_TOKEN` — JWT from step 1
   - `CRON_SECRET` — `openssl rand -hex 32`

3. **cron-job.org:**
   - Create account (free, no card required)
   - New cron job → URL: `https://your-app.vercel.app/api/cron/snapshot`
   - Schedule: weekly, Monday 06:00 UTC
   - Request header: `Authorization: Bearer <CRON_SECRET>`
   - Enable → test immediately with "Execute now" to verify `{ saved: 4, failed: 0 }`

## Acceptance Criteria

- [x] `npm test` passes (all tests, updated mocks)
- [x] Local dev works with `TURSO_DATABASE_URL=file:./data/snapshots.db` — no auth token needed
- [x] `GET /api/cron/snapshot` returns 401 without correct auth header
- [ ] `GET /api/cron/snapshot` with `Authorization: Bearer <secret>` returns `{ saved: 4, failed: 0, errors: [] }`
- [ ] App is live on Vercel — search, snapshot save, snapshot history all work against Turso
- [ ] Snapshot data persists across Vercel redeployments (stored in Turso)
- [x] `.env.example` committed; `.env.local` and `data/` gitignored
- [x] No remaining references to `db.prepare`, `db.exec`, `db.transaction`, or `_dbDedupDisabled`

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| `@libsql/client` edge runtime webpack issue | `export const runtime = "nodejs"` on all DB-touching routes |
| `better-sqlite3` sync calls missed in migration | Grep for `db.prepare`, `db.exec`, `db.transaction` before shipping |
| Forgetting `await` on async snapshot functions | Silent bug — Promise serialises as `{}` in JSON with no compile error; note called out in Phase 2 |
| Turso free tier rate limit (1B reads/mo) | 2 presets × 2 stores × 30 rows = trivially small |
| `lastInsertRowid` is `bigint \| undefined` | Use `Number(result.lastInsertRowid ?? 0)` |
| Cron fetch hangs at network level | `maxDuration = 60`; if a scrape stalls, Vercel times out and cron-job.org sees 504 — acceptable for weekly jobs |
| `TURSO_DATABASE_URL` missing in prod | Fast-fail guard in `getDb()` throws immediately with a clear message |

## References

- Brainstorm: `docs/brainstorms/2026-02-28-deployment-weekly-cron-brainstorm.md`
- Existing DB: `lib/db.ts`, `lib/snapshots.ts`
- Existing bulk route: `app/api/snapshots/bulk/route.ts`
- Preset apps: `components/PresetApps.ts`
- Turso Next.js guide: https://docs.turso.tech/sdk/ts/guides/nextjs
- Securing Vercel cron routes: https://codingcat.dev/post/how-to-secure-vercel-cron-job-routes-in-next-js-14-app-router
- Institutional learning — bigint safety: `docs/solutions/logic-errors/sqlite-bigint-and-apierror-contract.md`
- Institutional learning — bulk transactions: `docs/solutions/database-issues/sqlite-bulk-insert-transaction-performance.md`
