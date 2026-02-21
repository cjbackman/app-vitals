---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, security, performance, images]
dependencies: []
---

# P2: Remove `unoptimized` from app icons — configure `images.remotePatterns`

## Problem Statement

`AppCard.tsx` uses `unoptimized` on `next/image` because the icon URLs are external CDN URLs not whitelisted in `next.config.ts`. This has two problems:
1. **Security:** `unoptimized` bypasses Next.js's image proxy, sending raw scraper-returned URLs directly to browsers with no origin enforcement.
2. **Performance:** Apple returns icons up to 512×512px; display size is 64×64. Full-resolution images are 5–10x larger than needed (~40–80KB vs ~4–8KB per icon).

## Findings

- **`components/AppCard.tsx:115`** — `unoptimized` prop
- **`next.config.ts`** — no `images.remotePatterns` configuration

## Proposed Solutions

### Option A: Configure remotePatterns (Recommended)
```ts
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["app-store-scraper", "google-play-scraper"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mzstatic.com" },           // Apple CDN
      { protocol: "https", hostname: "play-lh.googleusercontent.com" }, // Google Play CDN
    ],
  },
};
```

Then remove `unoptimized` from `AppCard.tsx`. Next.js will resize to 64×64, convert to WebP, and cache at `/_next/image`.

### Option B: Keep `unoptimized`, add URL origin validation
Keep the current behaviour but add the URL validation from todo #001. Doesn't fix the performance issue.

**Recommended:** Option A.

## Acceptance Criteria
- [ ] `images.remotePatterns` configured for Apple and Google CDN hostnames
- [ ] `unoptimized` prop removed from `AppCard.tsx`
- [ ] App icons load as WebP at correct 64×64 display size
- [ ] Build passes with no image domain errors

## Work Log
- 2026-02-21: Identified by security-sentinel (P2) and performance-oracle (P2) in PR #1 review
