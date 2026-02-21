---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, performance, caching, http]
dependencies: []
---

# P2: API route responses have no Cache-Control headers — CDN can't cache them

## Problem Statement

`NextResponse.json(data)` in both API routes returns no `Cache-Control` header. The server-side `unstable_cache` has a 1-hour TTL, but the HTTP response is uncacheable by browsers and CDNs. Every client request hits a serverless function invocation, even when the data is warm in the Next.js cache. With `Cache-Control: s-maxage=3600`, Vercel's Edge Network could serve warm responses without touching the function at all.

## Findings

- **`app/api/ios/route.ts:22`** — `return NextResponse.json(data)` — no Cache-Control
- **`app/api/android/route.ts:22`** — same

## Proposed Solutions

### Option A: Add Cache-Control to success responses (Recommended)
```ts
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=60",
  },
});
```

Aligns CDN TTL (3600s) with `unstable_cache` TTL. `stale-while-revalidate=60` allows serving slightly stale data while the cache refreshes in the background.

### Option B: Do nothing for MVP
Acceptable at low traffic. Revisit when Vercel function invocation costs become visible.

**Recommended:** Option A — trivial change, meaningful impact at any traffic level.

## Acceptance Criteria
- [ ] Successful API responses include `Cache-Control: public, s-maxage=3600, stale-while-revalidate=60`
- [ ] Error responses (4xx, 5xx) do NOT include `Cache-Control` (errors should not be cached)
- [ ] CDN correctly caches successful app metadata responses

## Work Log
- 2026-02-21: Identified by performance-oracle (P2) in PR #1 review
