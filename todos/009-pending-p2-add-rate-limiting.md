---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, security, reliability, rate-limiting]
dependencies: []
---

# P2: No rate limiting on API routes — abuse can exhaust scraper quota

## Problem Statement

Both `/api/ios` and `/api/android` accept unlimited requests without throttling. Scrapers call Apple iTunes API and Google Play directly. An attacker can scan distinct app IDs (each a cache miss, each a live scraper call) to exhaust outbound request quota or trigger IP-based rate limiting from Apple/Google, causing legitimate requests to fail.

## Findings

- **`app/api/ios/route.ts`** — no rate limiting
- **`app/api/android/route.ts`** — no rate limiting
- No `middleware.ts` present in project

## Proposed Solutions

### Option A: Next.js middleware with in-memory limiter (Single instance)
```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const requestCounts = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export const config = { matcher: ["/api/ios", "/api/android"] };

export function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.reset) {
    requestCounts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return NextResponse.next();
  }
  if (entry.count >= MAX_REQUESTS) {
    return NextResponse.json({ error: "Too many requests", code: "SCRAPER_ERROR" }, { status: 429 });
  }
  entry.count++;
  return NextResponse.next();
}
```

### Option B: Upstash Redis rate limiter (Multi-instance, production-grade)
Use `@upstash/ratelimit` for distributed rate limiting across Vercel function instances. Requires Upstash Redis setup.

### Option C: CDN/platform layer (No code)
Configure rate limiting at Vercel (via Firewall rules) or Cloudflare. Zero code change.

**Recommended:** Option C for MVP (configure at hosting layer). Option B when moving to production scale.

## Acceptance Criteria
- [ ] Some form of rate limiting exists for `/api/ios` and `/api/android`
- [ ] Rate-limited responses return 429 with an `ApiError`-shaped body
- [ ] Legitimate users are not impacted under normal usage patterns

## Work Log
- 2026-02-21: Identified by security-sentinel (P2) in PR #1 review
