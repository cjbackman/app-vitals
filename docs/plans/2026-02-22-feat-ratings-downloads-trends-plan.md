---
title: "feat: Ratings & Downloads Trends"
type: feat
date: 2026-02-22
brainstorm: docs/brainstorms/2026-02-22-ratings-downloads-trends-brainstorm.md
reviewed: true
---

# feat: Ratings & Downloads Trends

## Overview

Add historical snapshot tracking and sparkline visualisation to the App Vitals lookup page. Users manually save app metric snapshots (rating, review count, Android-only installs) via a button on each AppCard. Once saved, a history section renders compact SVG sparklines inline below each card, persisting across page reloads via a local SQLite database.

The main lookup flow is unchanged. This feature is purely additive.

---

## Problem Statement

The app shows a point-in-time snapshot of app metadata. There's no way to track how ratings or download counts change over time. This feature adds opt-in local persistence so users can observe trends without automated polling, a hosted database, or accounts.

---

## Proposed Solution

- **Storage:** SQLite local file via `better-sqlite3` — no hosted infra, no cost, local dev only
- **Collection:** Manual "Save snapshot" button per AppCard
- **Visualisation:** SVG sparklines inlined in `SnapshotHistory.tsx` — zero additional runtime dependencies
- **UI placement:** History section inline below each AppCard (no separate page)
- **Deployment target:** Local development only (`./data/snapshots.db`)

---

## Architecture

### Ownership Model

`AppCard` owns its own snapshot state. It knows its `store` and `appId` (passed as a new prop). It fetches its own snapshot history and handles saves internally — no orchestration in `SearchPage`.

```
User clicks "Save" on AppCard
  → AppCard POSTs to POST /api/snapshots
  → AppCard re-fetches GET /api/snapshots?store=&appId= (only on save)
  → AppCard updates its own snapshots state
  → SnapshotHistory re-renders sparklines
```

`SearchPage` only needs to pass `appId` down alongside the existing `store` and `data` props. No snapshot state lives in `SearchPage`.

### AppCard Snapshot Lifecycle

```
data prop changes (new app loaded)
  → useEffect fires on [appId, data]
  → If data is valid AppData: fetch GET /api/snapshots?store=&appId= (AbortController cleanup)
  → If data is null / ApiError: clear snapshots state

User clicks Save
  → Disable button, begin in-flight
  → POST /api/snapshots
  → Re-fetch GET /api/snapshots (single fetch, after save only)
  → Set saved=true → setTimeout 2s → saved=false (cleanup on unmount)
```

### API Contract

**`POST /api/snapshots`**

Request body:
```json
{ "store": "ios" | "android", "appId": "com.example.app", "score": 4.5, "reviewCount": 12000, "minInstalls": 500000 }
```
- `minInstalls` is optional (omit for iOS)
- `savedAt` is server-generated — not client-supplied
- Response: `201` + `{ id, store, appId, savedAt, score, reviewCount, minInstalls }` (constructed from input + generated ID + server timestamp — no second DB read)
- `400` on missing/invalid fields (`store`, `appId`, `score`, `reviewCount` required)

**`GET /api/snapshots?store=ios&appId=com.example.app`**

- `200` + array sorted ascending by `savedAt`, `LIMIT 30` applied in SQL (not in route handler)
- `400` if `store` or `appId` missing

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  store        TEXT    NOT NULL,   -- 'ios' | 'android'
  app_id       TEXT    NOT NULL,   -- bundle ID or package name
  saved_at     TEXT    NOT NULL,   -- ISO 8601, server-generated
  score        REAL    NOT NULL,
  review_count INTEGER NOT NULL,
  min_installs INTEGER             -- NULL for iOS
);

CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
  ON snapshots (store, app_id, saved_at);
```

DB file: `./data/snapshots.db` hardcoded in `lib/db.ts`. No env-var override — local dev only.

---

## File Inventory

### New Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | SQLite connection singleton with `global` cache for hot-reload safety |
| `lib/snapshots.ts` | `saveSnapshot()` and `getSnapshots()` |
| `app/api/snapshots/route.ts` | GET + POST route handlers |
| `components/SnapshotHistory.tsx` | Collapsible history section; contains unexported `Sparkline` function |
| `__tests__/lib/snapshots.test.ts` | DB lib unit tests (node env) |
| `__tests__/api/snapshots.test.ts` | Route handler tests (400/201/200) |
| `__tests__/components/SnapshotHistory.test.tsx` | Component tests |
| `__mocks__/better-sqlite3.ts` | Jest mock for SQLite driver |
| `data/.gitkeep` | Placeholder so `data/` is tracked; `data/*.db` gitignored |

**Note:** `Snapshot` interface goes into `types/app-data.ts` (not a separate file). `Sparkline` is an unexported function inside `SnapshotHistory.tsx` (not a separate component file).

### Modified Files

| File | Change |
|------|--------|
| `types/app-data.ts` | Add `minInstalls?: number` to `AppData`; add `Snapshot` interface |
| `lib/android-store.ts` | Map `raw.minInstalls` to `AppData.minInstalls` |
| `components/AppCard.tsx` | Add `appId` prop; internal snapshot state; Save button; SnapshotHistory |
| `components/SearchPage.tsx` | Pass `appId={iosId}` / `appId={androidId}` to AppCards; remove all snapshot orchestration |
| `next.config.ts` | Add `'better-sqlite3'` to `serverExternalPackages` array |
| `package.json` | Add `better-sqlite3` and `@types/better-sqlite3` |
| `__tests__/lib/android-store.test.ts` | Add assertion for `minInstalls` mapping |
| `__tests__/components/AppCard.test.tsx` | Cover Save button states; snapshot fetch on data change |

---

## Implementation Phases

### Phase 1: Types & Data Layer

Extend `AppData`, wire `minInstalls` in the Android fetcher, set up the SQLite database layer and API routes. **No UI changes.** All tests pass at the end of this phase.

**Tasks:**

1. `npm install better-sqlite3 @types/better-sqlite3`

2. Add `'better-sqlite3'` to `serverExternalPackages` in `next.config.ts`

3. Create `data/` directory; add `data/*.db` to `.gitignore`; add `data/.gitkeep`

4. Add to `types/app-data.ts`:
   - `minInstalls?: number` to the `AppData` interface
   - `Snapshot` interface:
     ```ts
     export interface Snapshot {
       id: number;
       store: "ios" | "android";
       appId: string;
       savedAt: string;        // ISO 8601
       score: number;
       reviewCount: number;
       minInstalls?: number;   // Android only; never present on iOS snapshots
     }
     ```

5. Map `raw.minInstalls` in `lib/android-store.ts` alongside existing field mappings

6. Create `lib/db.ts` — lazy singleton with `global` cache for Next.js hot-reload safety:
   ```ts
   // lib/db.ts
   import "server-only";
   import Database from "better-sqlite3";

   const globalForDb = global as typeof global & { _db?: Database.Database };

   export function getDb(): Database.Database {
     if (!globalForDb._db) {
       globalForDb._db = new Database("./data/snapshots.db");
       globalForDb._db.exec(`
         CREATE TABLE IF NOT EXISTS snapshots ( ... );
         CREATE INDEX IF NOT EXISTS ...;
       `);
     }
     return globalForDb._db;
   }
   ```
   Note: `exec` is called inside the singleton guard — the DDL runs once per process lifetime.

7. Create `lib/snapshots.ts`:
   - `saveSnapshot(store, appId, score, reviewCount, minInstalls?)` — inserts row, returns constructed `Snapshot` from input + `lastInsertRowid` + server-generated `savedAt`. No second DB read.
   - `getSnapshots(store, appId)` — `SELECT ... ORDER BY saved_at ASC LIMIT 30`

8. Duplicate `APP_ID_PATTERN = /^[a-zA-Z0-9._-]+$/` and `MAX_APP_ID_LENGTH = 256` in `app/api/snapshots/route.ts` (they are not exported from `lib/make-store-handler.ts`). Keep it local to the file — not worth extracting for one additional use site.

9. Create `app/api/snapshots/route.ts` — GET (query params) + POST (JSON body) handlers

10. Create `__mocks__/better-sqlite3.ts` with precise mock shape:
    ```ts
    // __mocks__/better-sqlite3.ts
    export const mockRun = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    export const mockAll = jest.fn().mockReturnValue([]);
    export const mockGet = jest.fn().mockReturnValue(undefined);
    export const mockExec = jest.fn();
    export const mockPrepare = jest.fn().mockReturnValue({
      run: mockRun, all: mockAll, get: mockGet,
    });
    const MockDatabase = jest.fn().mockImplementation(() => ({
      prepare: mockPrepare,
      exec: mockExec,
    }));
    export default MockDatabase;
    // Note: better-sqlite3 uses CJS module.exports — verify __esModule handling matches import style in lib/db.ts
    ```

11. Create `__tests__/lib/snapshots.test.ts` (node env, `jest.resetModules()` in `beforeEach`):
    - `saveSnapshot` returns a `Snapshot` with correct fields
    - `getSnapshots` returns sorted array
    - `getSnapshots` returns empty array when no data

12. Create `__tests__/api/snapshots.test.ts` (separate from lib tests):
    - `POST /api/snapshots` with valid body → 201
    - `POST /api/snapshots` missing required field → 400
    - `GET /api/snapshots?store=ios&appId=...` → 200 + array
    - `GET /api/snapshots` without params → 400

13. Update `__tests__/lib/android-store.test.ts` — add assertion that `minInstalls` is mapped

**Phase 1 done when:** `npm test` passes with all new tests green.

---

### Phase 2: UI Layer

Wire AppCard to manage its own snapshot state. Add Save button, SnapshotHistory, and sparklines.

**Tasks:**

1. Create `components/SnapshotHistory.tsx` with an unexported `Sparkline` function at the top:

   **`Sparkline` spec (unexported):**
   - Props: `data: number[]`, `label: string`
   - Hardcoded dimensions: `width=120`, `height=32`, `stroke="#6366f1"`, `strokeWidth=1.5`
   - Single data point: render `<circle cx={width/2} cy={height/2} r={2} />` — not a polyline
   - All-identical values: set all y-coordinates to `height/2` (avoid division by zero in normalisation)
   - SVG viewBox is `0 0 {width} {height}`; y-axis is inverted — `y = height - normalised * height`

   **`SnapshotHistory` component:**
   - Props: `snapshots: Snapshot[]`, `store: "ios" | "android"`
   - Returns `null` when `snapshots.length === 0`
   - Renders: Rating sparkline, Reviews sparkline, Installs sparkline (Android only, `data-testid="sparkline-installs"`)
   - Expanded by default; no collapse toggle in this iteration

2. Update `components/AppCard.tsx`:
   - New prop: `appId?: string`
   - Internal state: `snapshots: Snapshot[]`, `saving: boolean`, `saved: boolean`
   - `useEffect` on `[appId, data]`:
     - If `data` is valid `AppData` and `appId` is present: fetch `GET /api/snapshots?store=&appId=` with AbortController; cleanup on effect teardown
     - Otherwise: `setSnapshots([])`
   - `handleSave` async function:
     - Guard: return if `!data || isApiError(data) || !appId || saving`
     - `setSaving(true)` → POST → re-fetch snapshots → `setSaving(false)` → `setSaved(true)`
     - `saved=true` reverts after 2s via `setTimeout`; store timer in `timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`; clean up in `useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, [])`
   - Save button: shown in success state only; disabled when `saving || !appId`; label = `saving ? "Saving…" : saved ? "Saved!" : "Save snapshot"`
   - Render `<SnapshotHistory snapshots={snapshots} store={store} />` below the metrics grid

3. Update `components/SearchPage.tsx`:
   - Pass `appId={iosId}` to the iOS `<AppCard>`
   - Pass `appId={androidId}` to the Android `<AppCard>`
   - No other snapshot-related changes — all state and fetching now lives in `AppCard`

4. Create `__tests__/components/SnapshotHistory.test.tsx`:
   - Returns nothing when `snapshots` is empty
   - Renders Rating and Reviews sparklines for iOS
   - Renders Rating, Reviews, and Installs sparklines for Android — use `data-testid="sparkline-installs"` for the Installs check
   - Does not render Installs for iOS

5. Update `__tests__/components/AppCard.test.tsx`:
   - Save button appears when data is loaded and `appId` is provided
   - Save button absent when `loading=true`
   - Save button absent when `data` is an `ApiError`
   - Save button absent when `appId` is not provided
   - Clicking Save calls the POST endpoint (mock `fetch`)
   - Button shows "Saving…" while in flight; "Saved!" on success; reverts after timeout

**Phase 2 done when:** `npm test` passes and the full save → sparkline flow works in the browser.

---

## UX Decisions

| Question | Decision |
|----------|----------|
| Snapshot fetch trigger | On `data` prop change (after load), and after a save — never on every lookup start |
| History clear trigger | When `data` changes to a different app (via useEffect on `[appId, data]`) |
| Min snapshots to show history section | 1 (renders a dot; signals data was captured) |
| Save button during loading / error / no appId | Disabled |
| Save button feedback | "Saving…" in flight → "Saved!" for 2s → "Save snapshot" |
| Duplicate snapshots | Allowed — no deduplication at DB level |
| Collapse toggle | None in this iteration |
| Sparkline time axis / tooltips | Deferred |
| Display cap indicator | None — silently shows 30 most recent |

---

## Acceptance Criteria

### Functional
- [x] "Save snapshot" button appears on AppCard only when app data is loaded successfully and `appId` is present
- [x] Saving POSTs to `/api/snapshots` and re-fetches snapshot history (save only — not on every lookup)
- [x] History section appears below the card once ≥1 snapshot exists
- [x] iOS card: sparklines for Rating and Reviews (no Installs)
- [x] Android card: sparklines for Rating, Reviews, and Installs
- [x] Up to 30 snapshots displayed; cap applied via `LIMIT 30` in SQL
- [x] Snapshots persist across page reloads
- [x] `minInstalls` mapped from Android scraper into `AppData`

### Non-functional
- [x] `better-sqlite3` in `next.config.ts` `serverExternalPackages`
- [x] `data/*.db` gitignored; `data/.gitkeep` committed
- [x] No new production npm packages beyond `better-sqlite3`
- [x] No new component files for `Sparkline` — inlined in `SnapshotHistory.tsx`
- [x] `Snapshot` interface in `types/app-data.ts` — no separate `types/snapshot.ts`
- [x] DB path hardcoded — no `DB_PATH` env var

### Tests
- [x] `__tests__/lib/snapshots.test.ts` — save, fetch, empty result (lib only, no HTTP concerns)
- [x] `__tests__/api/snapshots.test.ts` — 400/201/200 HTTP behavior
- [x] `__tests__/components/AppCard.test.tsx` — Save button states, timeout cleanup
- [x] `__tests__/components/SnapshotHistory.test.tsx` — renders per store, hides when empty, `data-testid="sparkline-installs"`
- [x] `__tests__/lib/android-store.test.ts` — `minInstalls` mapped correctly

---

## Alternative Approaches Considered

| Option | Why Rejected |
|--------|-------------|
| Auto-save on every lookup | Accumulates noise; no user control |
| Cron-based polling | Adds scheduling infrastructure; out of scope |
| Recharts / react-sparklines | Recharts is 300KB+; `react-sparklines` is unmaintained since 2019 |
| `@libsql/client` (Turso) | Remote infra; overkill for local dev |
| Separate `/analytics` page | User explicitly chose inline placement |
| Sparkline as a separate exported component | One call site; inlining is simpler; extract if a second use site appears |
| `types/snapshot.ts` as a dedicated file | One interface; co-locate with `AppData` in `types/app-data.ts` |
| `DB_PATH` env var | Local dev only; hardcode removes dead configuration |
| Snapshot state in `SearchPage` | AppCard knows its own `store` and `appId`; prop-drilling avoided |
| Re-fetch snapshots on every lookup | Redundant; fetch only after a save |

---

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|-----------|------|-----------|
| `better-sqlite3` native addon | Build may fail on mismatched Node versions | Requires native build; confirm Node version before install |
| SQLite file on disk | Lost on ephemeral deployments | Documented: local dev only. Migrate to Postgres if hosted deployment is needed |
| `AppData` type extension | `minInstalls?` is optional; existing code compiles unchanged | Low risk; additive change |
| Next.js hot-reload + DB singleton | Multiple DB instances in dev | Mitigated by `global` cache pattern in `lib/db.ts` |

---

## References

### Internal
- AppCard props — `components/AppCard.tsx:51-55`
- SearchPage state + lookup flow — `components/SearchPage.tsx:10-13`, `:18-72`
- AppData type — `types/app-data.ts:5-22`
- Android fetcher — `lib/android-store.ts:16-51`
- Lib dual-export pattern — `lib/ios-store.ts:16-56`
- Route handler factory + validation — `lib/make-store-handler.ts:15-59`
- `serverExternalPackages` — `next.config.ts:4`
- Jest mock patterns — `__mocks__/next-cache.ts`, `__mocks__/server-only.ts`
- Brainstorm — `docs/brainstorms/2026-02-22-ratings-downloads-trends-brainstorm.md`
