---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, caching, correctness]
dependencies: []
---

# P2: `country` param not forwarded in API route calls — future cache key bug

## Problem Statement

Both API routes call `getIosApp(appId)` / `getAndroidApp(appId)` without passing `country`. The `country` parameter defaults to `"us"` inside the wrapped function. `unstable_cache` derives its per-call cache key from the arguments passed at the call site — since only `appId` is passed, the country is invisible to the key. If country support is ever added to the routes, two different countries for the same app ID will collide to the same cache entry, silently serving stale data.

Currently the app is functionally correct (always US). This is a latent bug that becomes active the moment someone adds `?country=gb` support.

## Findings

- **`app/api/ios/route.ts:21`** — `getIosApp(appId)` — country never forwarded
- **`app/api/android/route.ts:21`** — `getAndroidApp(appId)` — same
- **`lib/ios-store.ts:23`** — `country = "us"` default exists but is never overridden
- **`lib/android-store.ts:22`** — same

## Proposed Solutions

### Option A: Forward country explicitly now (Recommended)
Read `country` from the query string with a default:
```ts
// app/api/ios/route.ts
const country = request.nextUrl.searchParams.get("country") ?? "us";
// Validate: only allow known ISO codes or whitelist "us" for now
const data = await getIosApp(appId, country);
```

This makes the cache key `[appId, country]` and makes the intent explicit. The UI doesn't need to send `country` — the default still applies — but the cache slot now correctly reflects the country in use.

### Option B: Remove `country` param from lib functions entirely
Remove the `country` parameter from `fetchIosApp` and `fetchAndroidApp` until the feature is actually built. Hardcode `"us"` inside the functions. Simpler, YAGNI-correct.

### Option C: Add a comment only
Document the limitation in both lib files. No code change. Defers the risk.

**Recommended:** Option B (YAGNI) or Option A if country support is planned soon.

## Acceptance Criteria
- [ ] Either: `country` is forwarded explicitly through the call chain, or
- [ ] `country` parameter is removed from lib functions until needed
- [ ] A comment explains the caching behavior relative to `country`

## Work Log
- 2026-02-21: Identified by performance-oracle (P1) and kieran-typescript-reviewer (P1) in PR #1 review. Downgraded to P2 because current behavior is correct (US-only).
