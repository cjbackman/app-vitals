---
status: pending
priority: p3
issue_id: "043"
tags: [code-review, cleanup, pr-4]
dependencies: []
---

# P3: `SCRAPER_ERROR` is wrong error code for a DB write failure

## Problem Statement

The catch block in `POST /api/snapshots/bulk` returns `code: "SCRAPER_ERROR"` on DB failure. This code exists in the codebase for scraper route failures and is used by `isApiError()` guards on the client. Reusing it for a DB import failure couples unrelated failure domains and makes log filtering misleading — a search for `SCRAPER_ERROR` would surface both scraper and import DB failures together. It also misleads any future agent or client that inspects the `code` field.

## Findings

- **`app/api/snapshots/bulk/route.ts:150`** — `{ error: "Failed to import snapshots", code: "SCRAPER_ERROR" }`
- Security agent, simplicity agent, data integrity agent all noted this
- `SCRAPER_ERROR` is defined/used in scraper routes — unrelated to CSV import

## Proposed Solutions

### Option A: Use a more appropriate generic code — Recommended

```typescript
return NextResponse.json(
  { error: "Failed to import snapshots", code: "IMPORT_ERROR" },
  { status: 500 }
);
```

**Pros:** Semantically accurate, easy to grep/filter
**Cons:** New code that client code doesn't yet special-case (same as current — client shows the error string, not the code)
**Effort:** Minimal
**Risk:** Very low — client renders `error` string, not `code`

### Option B: Keep `SCRAPER_ERROR` as a generic server-error signal

Both codes mean "server-side failure" to the client. The distinction matters only for logging/monitoring.

**Pros:** Zero change
**Cons:** Semantic inconsistency, misleading logs
**Effort:** None
**Risk:** Low for current usage, increases tech debt

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `app/api/snapshots/bulk/route.ts` line 150
- **Test update:** `__tests__/api/snapshots-bulk.test.ts` line 203 checks `.code === "SCRAPER_ERROR"` — update to `"IMPORT_ERROR"` if Option A is chosen

## Acceptance Criteria

- [ ] DB failure response uses a code that does not include "SCRAPER"
- [ ] The existing "returns 500 with SCRAPER_ERROR when DB throws" test is updated to match
- [ ] All other tests pass

## Work Log

- 2026-02-23: Created from PR #4 code review — security sentinel + code simplicity reviewer + data integrity guardian

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
