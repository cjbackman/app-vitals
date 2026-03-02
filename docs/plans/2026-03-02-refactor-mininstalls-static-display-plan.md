---
title: "refactor: Show minInstalls as static metadata, not sparkline"
type: refactor
date: 2026-03-02
---

# refactor: Show minInstalls as Static Metadata Field

## Overview

`minInstalls` is a stepped approximation from Google Play (`1,000,000+`, `5,000,000+`, etc.). It barely changes week-to-week and when it does it jumps discretely — making a sparkline misleading. It should be displayed as a static metadata badge alongside **Price**, **Updated**, and **Developer**, and removed from the snapshot time-series entirely.

## Problem Statement

- `SnapshotHistory` renders an **Installs** sparkline series for Android apps (`components/SnapshotHistory.tsx:153–154`)
- The data is a rounded floor value (the scraper returns e.g. `1_000_000` meaning "1M+"), so the sparkline is nearly flat and visually uninformative
- Storing it in snapshots every week is wasted DB writes and payload

## Proposed Solution

1. **Display `minInstalls` in `AppCard` metadata** — read from the live `AppData` prop (already available), show as `"1M+"` for Android, nothing for iOS
2. **Remove from the snapshot pipeline** — stop writing to and reading from `min_installs` in `snapshots`
3. **Remove the Installs sparkline** from `SnapshotHistory`
4. **Keep the `min_installs` DB column** — no migration needed; old rows retain their data, new rows just write `null`. Dropping the column is unnecessary risk for zero benefit.

## Implementation

### `components/AppCard.tsx`

The metadata grid uses inline `<div>/<p>` pairs — there is no `MetaItem` component. Follow the same pattern as the existing cells.

Place Installs before Updated, changing Updated from `col-span-2` to a regular half-width cell:

```tsx
// Before: Updated spanned full width (col-span-2)
// After: Installs | Updated sit side by side

{data.minInstalls != null && (
  <div>
    <p className="text-gray-400">Installs</p>
    <p className="font-medium text-gray-900">{formatCount(data.minInstalls)}+</p>
  </div>
)}
<div>
  <p className="text-gray-400">Updated</p>
  <p className="font-medium text-gray-900">{/* existing updated display */}</p>
</div>
```

**Formatting note:** `formatCount` renders values below 1M as `"1k"`, `"50k"` etc., giving `"50k+"`. Google Play shows `"50,000+"` for those tiers. This is an intentional simplification — the format is consistent with how reviews are displayed elsewhere in the app. If exact Play Store formatting is needed later, use `n.toLocaleString() + "+"` instead.

### `components/SnapshotHistory.tsx`

Remove all three lines of the Installs series (declaration + filter + conditional render):

```diff
- const installs = snapshots
-   .filter((s) => s.minInstalls !== undefined)
-   .map((s) => s.minInstalls as number);
  ...
- {store === "android" && installs.length > 0 && (
-   <Sparkline label="Installs" data={installs} ... />
- )}
```

After removal, `SnapshotHistory` renders only **Rating** and **Reviews** sparklines for both stores.

### `types/app-data.ts`

Remove `minInstalls` from the `Snapshot` interface only (stays in `AppData`):

```diff
 interface Snapshot {
   ...
-  minInstalls?: number; // Android only; never present on iOS snapshots
   version: string | null;
   isRelease: boolean;
 }
```

### `lib/snapshots.ts`

- Remove `minInstalls?: number` from `saveSnapshot` opts type
- Remove `min_installs` from SQL `INSERT` column list and args
- Remove `min_installs` from `getSnapshots` SQL `SELECT`
- Remove `minInstalls: r.min_installs != null ? ...` from row mapping
- Remove `minInstalls: opts.minInstalls` from returned Snapshot object

### `app/api/cron/snapshot/route.ts`

Remove `minInstalls` from the Android `saveSnapshot` call:

```diff
 saveSnapshot("android", preset.androidId, {
   score: data.score,
   reviewCount: data.reviewCount,
   version: data.version === "Varies with device" ? null : data.version,
-  minInstalls: data.minInstalls,
 })
```

**Note:** `app/api/snapshots/route.ts` (the GET route) requires no code change — it passes `getSnapshots` output straight to `NextResponse.json`, and after the lib change those objects simply won't have a `minInstalls` field.

### Tests to update

| File | Change |
|---|---|
| `__tests__/lib/snapshots.test.ts` | Remove "returns a Snapshot with minInstalls for Android" and "omits minInstalls when not provided" and "includes minInstalls when present in row" tests; remove `min_installs: null` key from all mock row fixtures (~15 occurrences) |
| `__tests__/components/SnapshotHistory.test.tsx` | Remove "renders...Installs sparklines for Android" test; remove "does not render Installs sparkline for iOS" test (feature no longer exists for any store); drop `minInstalls: 500000000` from `ANDROID_SNAPSHOT` fixture (TypeScript excess property error enforces this); add test: "does not render Installs sparkline for Android either" |
| `__tests__/api/cron/snapshot.test.ts` | Remove `minInstalls: undefined` from `VALID_APP_DATA` fixture (line 25) |
| `__tests__/lib/android-store.test.ts` | No change — `minInstalls` stays in `AppData`, scraper still maps it |
| `__tests__/components/AppCard.test.tsx` | Add test: Android `data` with `minInstalls` renders `"1M+"` in metadata; iOS `data` without `minInstalls` does not render the Installs field |

## Acceptance Criteria

- [x] `AppCard` shows `"1M+"` (or equivalent formatted string) for Android apps that have `minInstalls`
- [x] `AppCard` shows nothing for iOS apps (no Installs field rendered)
- [x] Updated cell no longer `col-span-2`; sits alongside Installs for Android, alone for iOS
- [x] `SnapshotHistory` does not render an Installs sparkline for any store
- [x] `saveSnapshot` no longer accepts or stores `minInstalls`
- [x] `getSnapshots` no longer returns `minInstalls` on `Snapshot` objects
- [x] `Snapshot` type no longer has `minInstalls` field
- [x] `AppData` type retains `minInstalls?: number` (still fetched live from scraper)
- [x] `min_installs` DB column retained (no migration); future rows write `null`
- [x] All tests pass

## References

- `components/AppCard.tsx` — metadata grid (inline `<div>/<p>` pattern, `col-span-2` on Updated to adjust)
- `components/SnapshotHistory.tsx:140–154` — installs array + conditional sparkline to delete
- `types/app-data.ts` — remove `minInstalls` from `Snapshot` only
- `lib/snapshots.ts` — `saveSnapshot` opts, INSERT args, `getSnapshots` SELECT + mapping
- `app/api/cron/snapshot/route.ts:43` — Android `minInstalls` pass-through to remove
- `__tests__/api/cron/snapshot.test.ts:25` — `VALID_APP_DATA` fixture to clean up
- `lib/format.ts:formatCount` — use for `"1M+"` formatting
