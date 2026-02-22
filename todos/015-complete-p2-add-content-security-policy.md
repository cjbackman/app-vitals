---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, security, headers]
dependencies: []
---

# P2: No Content-Security-Policy header

## Problem Statement

`next.config.ts` sets three good security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) but no `Content-Security-Policy`. CSP is the primary browser defence against XSS and data injection. Without it, any future XSS vector has no independent browser-level fallback.

## Findings

- **`next.config.ts:14-19`** — three headers configured, CSP absent
- Identified by: security-sentinel (PR #2 review)

## Proposed Solutions

### Option A: Strict CSP with nonce (ideal for Next.js App Router)
```ts
// next.config.ts headers()
{ key: "Content-Security-Policy", value: [
  "default-src 'self'",
  "img-src 'self' https://*.mzstatic.com https://play-lh.googleusercontent.com data:",
  "script-src 'self' 'nonce-{nonce}'",  // requires nonce injection
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
].join("; ") }
```

### Option B: Permissive starting point (acceptable for personal tool)
```ts
{ key: "Content-Security-Policy", value: [
  "default-src 'self'",
  "img-src 'self' https://*.mzstatic.com https://play-lh.googleusercontent.com data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join("; ") }
```

**Recommended:** Option B for now. `unsafe-inline` is needed for Next.js hydration scripts without nonce configuration. A personal tool with no auth or user data is low-risk; starting with Option B and tightening later is pragmatic.

## Acceptance Criteria
- [ ] `Content-Security-Policy` header present in all responses
- [ ] `img-src` allows both Apple CDN and Google Play CDN domains
- [ ] No browser console CSP violations on the main page

## Work Log
- 2026-02-21: Identified by security-sentinel in PR #2 review
