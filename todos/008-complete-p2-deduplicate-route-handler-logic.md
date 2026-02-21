---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, duplication, architecture]
dependencies: ["002"]
---

# P2: Duplicate API route handler logic — extract shared handler factory

## Problem Statement

`app/api/ios/route.ts` and `app/api/android/route.ts` are ~95% identical. The only differences are the imported getter function and the log prefix string. The `APP_ID_PATTERN` regex, validation block, error handling branches, and HTTP status codes are all copy-pasted. Any change to error handling (new error code, different status, logging format) must be made in two places.

## Findings

- **`app/api/ios/route.ts:8`** — `APP_ID_PATTERN = /^[a-zA-Z0-9._-]+$/` (duplicate)
- **`app/api/android/route.ts:8`** — identical regex
- Both routes: identical 43-line error handling structure

## Proposed Solutions

### Option A: Shared handler factory (Recommended)
```ts
// lib/make-store-handler.ts
import { AppNotFoundError, StoreScraperError, APP_ID_PATTERN } from "@/lib/store-errors";

export function makeStoreHandler(
  fetcher: (appId: string) => Promise<AppData>,
  logPrefix: string
) {
  return async function GET(request: NextRequest) {
    const appId = request.nextUrl.searchParams.get("appId");
    if (!appId || !APP_ID_PATTERN.test(appId)) {
      return NextResponse.json({ error: "Missing or invalid appId parameter", code: "INVALID_APP_ID" }, { status: 400 });
    }
    try {
      return NextResponse.json(await fetcher(appId));
    } catch (err) {
      if (err instanceof AppNotFoundError)
        return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
      if (err instanceof StoreScraperError) {
        console.error(`[${logPrefix}] scraper error:`, err.cause);
        return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
      }
      console.error(`[${logPrefix}] unexpected error:`, err);
      return NextResponse.json({ error: "Unexpected error", code: "SCRAPER_ERROR" }, { status: 502 });
    }
  };
}
```

Each route becomes 3 lines:
```ts
// app/api/ios/route.ts
import { makeStoreHandler } from "@/lib/make-store-handler";
import { getIosApp } from "@/lib/ios-store";
export const GET = makeStoreHandler(getIosApp, "api/ios");
```

### Option B: Keep duplication, add comment
Document the routes are intentionally parallel. Defer extraction until a third route is added.

**Recommended:** Option A — depends on todo #002 (shared errors) being done first. If a third store is not imminent, Option B is acceptable per YAGNI.

## Acceptance Criteria
- [ ] `APP_ID_PATTERN` defined once (in `lib/store-errors.ts` or `lib/validation.ts`)
- [ ] Route handler error logic has a single implementation
- [ ] Both route files remain as thin wrappers calling the shared handler
- [ ] All API route tests still pass

## Work Log
- 2026-02-21: Identified by code-simplicity-reviewer (P2) and pattern-recognition-specialist (P2) in PR #1 review
