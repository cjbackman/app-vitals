---
title: "feat: Historical snapshot CSV import"
type: feat
date: 2026-02-22
---

# feat: Historical snapshot CSV import

## Overview

Add a `/import` page where users can upload a CSV of historical app metrics (ratings, review counts, installs) to seed the local SQLite database. This makes sparklines show meaningful trends immediately, rather than waiting for manual daily saves to accumulate.

## Proposed Solution

**Client-side CSV parsing → JSON POST.** The browser reads the CSV file, parses rows into JSON (including string→number coercion), and sends a single `POST /api/snapshots/bulk` with a JSON body. All validation happens server-side. The client only enforces the 1 000-row cap and header correctness (to avoid silently inserting data with swapped columns).

**Deduplication via UNIQUE INDEX + `INSERT OR IGNORE`.** Add a unique index on `(store, app_id, saved_at)` to `lib/db.ts` in a separate try/catch block (outside the main `exec()`) so a failure to create the index does not break `getDb()`.

**All bulk insert logic lives inside the route handler.** No new lib function — one callsite does not justify abstraction (CLAUDE.md: "No helper utilities for one-off operations").

**No preview step.** The server response (`{ inserted, skipped }`) is the feedback mechanism. For a single-user local tool a table preview of 3 rows before submitting adds complexity without value.

**CSV format** (column names match DB snake_case):
```
store,app_id,saved_at,score,review_count,min_installs
ios,com.spotify.client,2025-08-01,4.7,12000000,
android,com.spotify.music,2025-08-01T00:00:00.000Z,4.3,23000000,1000000000
```

`min_installs` is optional (Android only). `saved_at` accepts date-only (`2025-08-01`) — normalised server-side to `2025-08-01T00:00:00.000Z` (UTC midnight, not local time).

## Technical Considerations

- **No new npm packages.** CSV parsing uses string splitting. No `papaparse`.
- **1 000-row cap.** Validated both client-side (on parse) and server-side (on receive).
- **Simple success response.** `{ inserted: number; skipped: number }`. No per-row invalid tracking — the route rejects the whole request if any row fails shape validation (400), then uses `INSERT OR IGNORE` to handle duplicates (counted in `skipped`). This keeps the response contract simple.
- **`normalizeSavedAt` must append `T00:00:00.000Z` explicitly** — never use `new Date("2025-08-01")` which parses as UTC in spec but is ambiguous in practice. See: `new Date("2025-08-01T00:00:00.000Z")` is always UTC midnight.
- **UNIQUE constraint** — dedup is exact timestamp match. A row saved via normal "Save snapshot" at `2025-08-01T10:23:45.123Z` and an import row normalised to `2025-08-01T00:00:00.000Z` are considered different and both insert. Document this in the UI.
- **Navigation.** Add an "Import history" link to `SearchPage.tsx`.

## Acceptance Criteria

- [ ] `/import` page renders a file picker accepting `.csv` files
- [ ] Client validates header row matches `store,app_id,saved_at,score,review_count,min_installs` exactly — rejects file immediately if not
- [ ] Client shows row count and enforces the 1 000-row cap before submitting
- [ ] Submitting POSTs to `POST /api/snapshots/bulk` and shows `"Inserted X · Skipped Y duplicates"` result
- [ ] Rows with an already-matching `(store, app_id, saved_at)` are silently skipped (`skipped` count)
- [ ] Date-only `saved_at` values (`2025-08-01`) are normalised to `2025-08-01T00:00:00.000Z` on the server
- [ ] A request with any row failing validation returns 400 — no partial inserts
- [ ] Rows exceeding 1 000 are rejected with a clear error (client + server)
- [ ] After a successful import the user can return to search and see populated sparklines
- [ ] All new code has tests (see test cases below)

## Files

### New files

```
app/api/snapshots/bulk/route.ts         — POST handler; all logic inline
components/ImportPage.tsx               — "use client" — file picker, row count, import button, result banner
app/import/page.tsx                     — Next.js page, renders ImportPage
__tests__/api/snapshots-bulk.test.ts
__tests__/components/ImportPage.test.tsx
```

### Modified files

```
lib/db.ts                               — add UNIQUE INDEX on (store, app_id, saved_at)
components/SearchPage.tsx               — add "Import history" link
```

### No changes to

```
lib/snapshots.ts                        — bulk logic lives in the route, not here
types/app-data.ts                       — no new types; use Omit<Snapshot, "id"> inline
```

## API Contract

**Request:** `POST /api/snapshots/bulk`
```json
{
  "rows": [
    { "store": "ios", "appId": "com.spotify.client", "savedAt": "2025-08-01", "score": 4.7, "reviewCount": 12000000 },
    { "store": "android", "appId": "com.spotify.music", "savedAt": "2025-08-01T00:00:00.000Z", "score": 4.3, "reviewCount": 23000000, "minInstalls": 1000000000 }
  ]
}
```

**Response 200:**
```json
{ "inserted": 8, "skipped": 1 }
```

**Response 400:** `{ "error": "...", "code": "INVALID_SNAPSHOT_PARAMS" }` — any of:
- body not an object or `rows` missing/not array
- `rows.length > 1000`
- any array element is not an object (`null`, primitive)
- any row fails field validation (see validation rules below)

## Implementation Sketches

### DB change (`lib/db.ts`)

```ts
// After the existing db.exec(...) call — separate try/catch so a failure
// does not break getDb() if the dev DB already has duplicate rows.
try {
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_dedup ON snapshots (store, app_id, saved_at)"
  );
} catch {
  // Existing data has duplicate (store, app_id, saved_at) rows.
  // Import will still work; INSERT OR IGNORE falls back to INSERT with no-op on conflict.
  // Clean up duplicates manually: DELETE FROM snapshots WHERE id NOT IN (SELECT MIN(id) FROM snapshots GROUP BY store, app_id, saved_at)
}
```

### Route handler (`app/api/snapshots/bulk/route.ts`)

```ts
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { APP_ID_PATTERN, MAX_APP_ID_LENGTH } from "@/lib/make-store-handler";

const MAX_ROWS = 1000;

function normalizeSavedAt(value: string): string | null {
  // Full ISO 8601 with time component — validate and normalise
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Date-only: always append UTC midnight explicitly to avoid TZ ambiguity
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "INVALID_SNAPSHOT_PARAMS" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) { /* 400 */ }

  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.rows)) { /* 400 */ }
  if (b.rows.length > MAX_ROWS) { /* 400: exceeds 1000 rows */ }

  // Validate all rows up-front — reject whole request if any row is invalid
  const rows = b.rows as unknown[];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (typeof row !== "object" || row === null) { /* 400: row i not an object */ }
    const r = row as Record<string, unknown>;

    if (r.store !== "ios" && r.store !== "android") { /* 400 */ }
    if (typeof r.appId !== "string" || r.appId.length === 0 ||
        r.appId.length > MAX_APP_ID_LENGTH || !APP_ID_PATTERN.test(r.appId)) { /* 400 */ }
    if (typeof r.savedAt !== "string" || normalizeSavedAt(r.savedAt) === null) { /* 400 */ }
    if (typeof r.score !== "number" || !Number.isFinite(r.score) ||
        r.score < 0 || r.score > 5) { /* 400 */ }
    if (typeof r.reviewCount !== "number" || !Number.isFinite(r.reviewCount) ||
        r.reviewCount < 0) { /* 400 */ }
    if (r.minInstalls !== undefined &&
        (typeof r.minInstalls !== "number" || !Number.isFinite(r.minInstalls) ||
         r.minInstalls < 0)) { /* 400 */ }
  }

  try {
    const db = getDb();
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO snapshots (store, app_id, saved_at, score, review_count, min_installs) VALUES (?, ?, ?, ?, ?, ?)"
    );
    let inserted = 0;
    let skipped = 0;

    for (const row of rows as Array<Record<string, unknown>>) {
      const savedAt = normalizeSavedAt(row.savedAt as string)!;
      const result = stmt.run(
        row.store, row.appId, savedAt, row.score, row.reviewCount,
        row.minInstalls ?? null
      );
      result.changes === 1 ? inserted++ : skipped++;
    }

    return NextResponse.json({ inserted, skipped });
  } catch {
    return NextResponse.json(
      { error: "Failed to import snapshots", code: "SCRAPER_ERROR" },
      { status: 500 }
    );
  }
}
```

### Client CSV parsing (`components/ImportPage.tsx`)

```tsx
// String→number coercion after splitting on commas:
const HEADERS = ["store", "app_id", "saved_at", "score", "review_count", "min_installs"];

function parseCsv(text: string): Array<Record<string, unknown>> | string {
  const lines = text.trim().split("\n");
  const header = lines[0].trim().split(",");
  // Validate header exactly — wrong order = silently swapped columns
  if (header.join(",") !== HEADERS.join(",")) {
    return `Invalid headers. Expected: ${HEADERS.join(",")}`;
  }
  if (lines.length - 1 > 1000) return "File exceeds 1 000 row limit";

  return lines.slice(1).map((line) => {
    const [store, app_id, saved_at, score, review_count, min_installs] = line.split(",");
    return {
      store: store?.trim(),
      appId: app_id?.trim(),
      savedAt: saved_at?.trim(),
      score: parseFloat(score),            // parseFloat, not Number() — tolerates whitespace
      reviewCount: parseInt(review_count, 10),
      ...(min_installs?.trim() ? { minInstalls: parseInt(min_installs, 10) } : {}),
    };
  });
}
// State: file | null, parseError | null, rowCount | null, submitting, result
// 1. <input type="file" accept=".csv"> → onChange: readAsText → parseCsv → setRows / setParseError
// 2. Shows row count or parse error inline
// 3. Import button (disabled when no valid rows) → POST /api/snapshots/bulk → setResult
// 4. Result banner: "Inserted X · Skipped Y duplicates" or error message
```

## Test Cases

### `__tests__/api/snapshots-bulk.test.ts` (`@jest-environment node`)

- 400 when `rows` is missing
- 400 when `rows` is not an array
- 400 when `rows.length > 1000`
- 400 when a row element is `null`
- 400 when `score` is `NaN` (send `null` from client — `typeof null !== "number"` guard)
- 400 when `score` is `6` (out of range)
- 400 when `score` is `-0.1` (out of range)
- 400 when `reviewCount` is negative
- 400 when `savedAt` is an invalid date string
- 400 when `appId` fails `APP_ID_PATTERN`
- 200 `{ inserted: 1, skipped: 0 }` for a valid single iOS row
- 200 `{ inserted: 0, skipped: 1 }` when `bulkImportSnapshots` returns `changes: 0` (mock)
- 200 with `minInstalls` for Android row
- 500 when DB throws
- `normalizeSavedAt("2025-08-01")` → `"2025-08-01T00:00:00.000Z"`
- `normalizeSavedAt("2025-08-01T12:00:00.000Z")` → passes through
- `normalizeSavedAt("not-a-date")` → `null`
- `normalizeSavedAt("2025-13-01")` → `null` (invalid month)

### `__tests__/components/ImportPage.test.tsx`

- File picker renders with `accept=".csv"`
- Parse error shown when headers don't match
- Row count displayed after valid file selected
- Error shown when file exceeds 1 000 rows
- Import button disabled when no file selected
- Fetch called with correct JSON body on submit
- Result banner shows after successful response
- Error banner shows on fetch failure

## Dependencies & Risks

- **UNIQUE INDEX migration** — isolated in its own try/catch, so `getDb()` will not throw. The cleanup query for a dev DB with duplicates is documented inline in the code comment (see DB change sketch above).
- **Exact-timestamp dedup** — a "Save snapshot" at `T10:23:45.123Z` and an import row at `T00:00:00.000Z` for the same date are considered different. Document this in the UI as "Duplicate detection matches exact timestamp."
- **Header validation is a hard requirement** — wrong column order produces silently inverted data (score and reviewCount swapped). The client must reject the file immediately if headers don't match exactly.

## References

- Existing POST route pattern: `app/api/snapshots/route.ts`
- DB schema + migration pattern: `lib/db.ts:9-22`
- Validation constants: `lib/make-store-handler.ts` (`APP_ID_PATTERN`, `MAX_APP_ID_LENGTH`)
- Snapshot type: `types/app-data.ts:27-36`
- Solution docs: `docs/solutions/logic-errors/sqlite-bigint-and-apierror-contract.md`
