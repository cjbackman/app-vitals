---
status: pending
priority: p2
issue_id: "027"
tags: [code-review, correctness, api-contract]
dependencies: []
---

# P2: Snapshot API error responses missing `code` field — breaks ApiError contract

## Problem Statement

`ApiError` in `types/app-data.ts` requires a `code` field. The `isApiError()` type guard checks for this field. All snapshot API error responses currently omit `code`, so `isApiError()` returns `false` for snapshot errors. Client code cannot distinguish snapshot errors from valid data using the established pattern.

## Findings

- **`app/api/snapshots/route.ts:25`** — `{ error: "Missing or invalid store/appId parameters" }` — no `code`
- **`app/api/snapshots/route.ts:39`** — `{ error: "Invalid JSON body" }` — no `code`
- **`app/api/snapshots/route.ts:43`** — `{ error: "Body must be an object" }` — no `code`
- **`app/api/snapshots/route.ts:51`** — `{ error: "Missing or invalid required fields..." }` — no `code`
- **`types/app-data.ts:40`** — `ApiError.code` is a required field
- Flagged by Pattern Recognition Specialist and Agent-Native Reviewer

## Proposed Solutions

### Option A: Add a snapshot-specific code and include it in all error responses (Recommended)

```ts
// types/app-data.ts — extend the code union
export interface ApiError {
  error: string;
  code: "APP_NOT_FOUND" | "SCRAPER_ERROR" | "INVALID_APP_ID" | "INVALID_SNAPSHOT_PARAMS";
}

// app/api/snapshots/route.ts — add code to each error
{ error: "Missing or invalid store/appId parameters", code: "INVALID_SNAPSHOT_PARAMS" }
{ error: "Invalid JSON body", code: "INVALID_SNAPSHOT_PARAMS" }
{ error: "Body must be an object", code: "INVALID_SNAPSHOT_PARAMS" }
{ error: "Missing or invalid required fields...", code: "INVALID_SNAPSHOT_PARAMS" }
```

### Option B: Reuse existing codes

Use `INVALID_APP_ID` for input validation errors, `SCRAPER_ERROR` for server errors. No new union member. Slightly misleading semantically but consistent with existing codes.

**Recommended:** Option A — cleaner contract; adding one union member is low-cost.

## Acceptance Criteria

- [ ] All error responses from `/api/snapshots` include a `code` field
- [ ] `isApiError()` returns `true` for snapshot error responses
- [ ] `ApiError` union extended or existing codes reused consistently
- [ ] Existing tests updated to check `code` in error responses

## Work Log

- 2026-02-22: Flagged by Pattern Recognition Specialist and Agent-Native Reviewer in PR #3 review
