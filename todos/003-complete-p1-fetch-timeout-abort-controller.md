---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, performance, reliability, ux]
dependencies: []
---

# P1: No fetch timeout or AbortController — loading spinner can hang indefinitely

## Problem Statement

The client-side `Promise.allSettled` in `SearchPage.tsx` has no timeout. The scraper calls on the server have no timeout either (`app-store-scraper` and `google-play-scraper` do not set bounded timeouts by default). The full chain — browser → API route → scraper → Apple/Google — can hang for the entire serverless function timeout (10–60 seconds depending on Vercel plan). During a hang, the loading spinner runs indefinitely with no user feedback or escape.

## Findings

- **`components/SearchPage.tsx:27-38`** — `Promise.allSettled` with no `AbortController` or timeout
- **`app/api/ios/route.ts`** — no `maxDuration` export, no server-side timeout
- **`app/api/android/route.ts`** — same

At scale: concurrent hung requests hold open function slots proportional to concurrency.

## Proposed Solutions

### Option A: AbortController with timeout (Recommended)
```ts
// components/SearchPage.tsx
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000);

try {
  const fetches = await Promise.allSettled([
    iosId ? fetch(`/api/ios?appId=${encodeURIComponent(iosId)}`, { signal: controller.signal }).then(r => r.json()) : Promise.resolve(null),
    androidId ? fetch(`/api/android?appId=${encodeURIComponent(androidId)}`, { signal: controller.signal }).then(r => r.json()) : Promise.resolve(null),
  ]);
  // ... result mapping
} finally {
  clearTimeout(timeoutId);
  setLoading(false);
}
```

Also add to both API route files:
```ts
export const maxDuration = 15; // Next.js route segment config — caps serverless function runtime
```

### Option B: Client timeout only, no server cap
Abort the client fetch after 10s. Server function still runs to completion but browser shows error. Simpler but wastes server resources.

**Recommended:** Option A — both client and server bounds.

## Acceptance Criteria
- [ ] Client fetch is aborted after a configurable timeout (default 10s)
- [ ] `setLoading(false)` is called in a `finally` block regardless of timeout
- [ ] User sees an error card (SCRAPER_ERROR) on timeout, not an infinite spinner
- [ ] Both API route files export `maxDuration` to cap serverless runtime
- [ ] Tests cover the timeout/abort path

## Work Log
- 2026-02-21: Identified by performance-oracle agent (P1) in PR #1 review
