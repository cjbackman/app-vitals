---
title: better-sqlite3 lastInsertRowid bigint cast and ApiError code contract
date: 2026-02-22
category: logic-errors
module: snapshots, api-routes
tags: [typescript, better-sqlite3, sqlite, apierror, type-safety, bigint]
symptoms:
  - Error state not shown in UI, blank screen on API error
  - Potential ID corruption for very large row IDs
  - isApiError() type guard returns false unexpectedly
---

# better-sqlite3 lastInsertRowid bigint cast and ApiError code contract

## Problem 1: Unsafe `lastInsertRowid` cast

`better-sqlite3` types `lastInsertRowid` as `number | bigint`. The `as number` cast silently truncates values above 2^53, which can corrupt IDs on large databases.

```ts
// Bad — truncates bigint
id: result.lastInsertRowid as number

// Good — safe coercion
id: Number(result.lastInsertRowid)
```

`Number()` correctly coerces bigint to a JS number. IDs within normal SQLite ranges are safe.

## Problem 2: ApiError `code` field missing from route responses

The shared `ApiError` type requires a `code` field:

```ts
interface ApiError {
  error: string;
  code: "APP_NOT_FOUND" | "SCRAPER_ERROR" | "INVALID_APP_ID" | "INVALID_SNAPSHOT_PARAMS";
}
```

The `isApiError()` type guard checks for both `"error"` and `"code"` keys. If a route omits `code`, the guard fails and the client renders nothing instead of the error message.

```ts
// Bug — missing code field
return NextResponse.json({ error: "Invalid params" }, { status: 400 });

// Fix — include code in every error response
return NextResponse.json(
  { error: "Invalid params", code: "INVALID_SNAPSHOT_PARAMS" },
  { status: 400 }
);
```

## Prevention

- Always use `Number(result.lastInsertRowid)` with better-sqlite3.
- Test every error response path for the `code` field:
  ```ts
  expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  ```
- When adding a new error code, update the `ApiError` union type first, then the route, then the client error messages map.
