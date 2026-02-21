---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, security, validation, input]
dependencies: []
---

# P3: `appId` has no length bound; `parseInt` can overflow on very large numeric IDs

## Problem Statement

Two related input validation gaps:

1. **No length bound** — `APP_ID_PATTERN` validates character class but not length. A valid match could be 100,000 characters, passed to the scraper and URL-encoded in an outbound HTTP request.

2. **`parseInt` overflow** — If a user provides a 17+ digit all-numeric string, `parseInt(appId, 10)` silently rounds to the nearest representable float, potentially looking up a different app's numeric ID than the one supplied.

## Findings

- **`app/api/ios/route.ts:8,12-18`** — no length check before regex test
- **`app/api/android/route.ts:8,12-18`** — same
- **`lib/ios-store.ts:27-28`** — `parseInt(appId, 10)` with no numeric bounds check

## Proposed Solution

```ts
// In both API routes, after length check:
const MAX_APP_ID_LENGTH = 256;
if (!appId || appId.length > MAX_APP_ID_LENGTH || !APP_ID_PATTERN.test(appId)) {
  return NextResponse.json({ error: "Missing or invalid appId parameter", code: "INVALID_APP_ID" }, { status: 400 });
}

// In lib/ios-store.ts, before parseInt:
const MAX_NUMERIC_ID = 9_999_999_999; // App Store IDs are 9-10 digits
if (/^\d+$/.test(appId) && (appId.length > 10 || parseInt(appId, 10) > MAX_NUMERIC_ID)) {
  throw new AppNotFoundError(appId);
}
```

## Acceptance Criteria
- [ ] `appId` longer than 256 characters is rejected with 400 before reaching the scraper
- [ ] Numeric IDs longer than 10 digits are rejected or throw `AppNotFoundError`
- [ ] Tests cover both edge cases

## Work Log
- 2026-02-21: Identified by security-sentinel (F-05, F-06) in PR #1 review
