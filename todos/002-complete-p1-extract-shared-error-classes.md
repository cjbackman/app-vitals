---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, architecture, typescript, duplication]
dependencies: []
---

# P1: Duplicate error classes across lib files — extract to `lib/store-errors.ts`

## Problem Statement

`AppNotFoundError` and `StoreScraperError` are defined identically (structurally) in both `lib/ios-store.ts` and `lib/android-store.ts`. Only the human-readable message string differs. This creates a hidden `instanceof` identity hazard: the two `AppNotFoundError` classes are different runtime objects. If a future shared handler (Phase 2) imports from the wrong module, `instanceof` checks will silently fail. Any change to the error class structure must be made in two places.

## Findings

- **`lib/ios-store.ts:6-19`** — defines `AppNotFoundError`, `StoreScraperError`
- **`lib/android-store.ts:6-19`** — defines identical classes
- **`app/api/ios/route.ts:4-5`** — imports from `ios-store`
- **`app/api/android/route.ts:4-5`** — imports from `android-store`

Flagged by: kieran-typescript-reviewer (P3), code-simplicity-reviewer (P1), architecture-strategist (P1), pattern-recognition-specialist (P1).

## Proposed Solutions

### Option A: Shared `lib/store-errors.ts` (Recommended)
```ts
// lib/store-errors.ts
export class AppNotFoundError extends Error {
  readonly code = "APP_NOT_FOUND" as const;
  constructor(appId: string, store: "App Store" | "Google Play") {
    super(`App not found in ${store}: ${appId}`);
  }
}

export class StoreScraperError extends Error {
  readonly code = "SCRAPER_ERROR" as const;
  constructor(store: "App Store" | "Google Play", cause: unknown) {
    super(`${store} scraper failed`);
    this.cause = cause;
  }
}
```

Both lib files import from `store-errors.ts`. Both API routes import from `store-errors.ts`. `instanceof` checks continue to work because there is now one class.

### Option B: Keep duplication, add comment
Document the duplication intentionally. Low effort but doesn't fix the identity hazard.

**Recommended:** Option A — small change, high leverage before Phase 2 adds a third store.

## Acceptance Criteria
- [ ] `AppNotFoundError` and `StoreScraperError` defined exactly once in `lib/store-errors.ts`
- [ ] Both lib files import errors from `store-errors.ts`
- [ ] Both API routes import errors from `store-errors.ts`
- [ ] `APP_ID_PATTERN` moved to `lib/store-errors.ts` or `lib/validation.ts` (see todo #008)
- [ ] All tests still pass

## Work Log
- 2026-02-21: Identified by 4 independent review agents in PR #1 review
