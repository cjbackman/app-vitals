---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, security, headers]
dependencies: []
---

# P3: Missing HTTP security headers (CSP, X-Frame-Options, etc.)

## Problem Statement

`next.config.ts` configures no security headers. The app is missing `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. These are low-effort, high-value hardening measures.

## Findings

- **`next.config.ts`** — only `serverExternalPackages`, no `headers()` function

## Proposed Solution

```ts
// next.config.ts
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "img-src 'self' https://*.mzstatic.com https://play-lh.googleusercontent.com",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "connect-src 'self'",
          ].join("; "),
        },
      ],
    },
  ];
},
```

Note: `style-src 'unsafe-inline'` is required for Tailwind's inline styles until a nonce-based CSP is implemented.

## Acceptance Criteria
- [ ] `X-Frame-Options: DENY` header present on all responses
- [ ] `X-Content-Type-Options: nosniff` header present
- [ ] `Content-Security-Policy` header configured (at minimum blocking `default-src`)
- [ ] Build passes and app functions correctly with headers applied

## Work Log
- 2026-02-21: Identified by security-sentinel (P3) in PR #1 review
