---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# P2: `r.json()` returns untyped `any` at client fetch boundary

## Problem Statement

`SearchPage.tsx` calls `fetch(...).then(r => r.json())` without a type assertion. `r.json()` returns `Promise<any>`, so `fetches[0].value` is `any`. This is then assigned to `Results.ios: AppData | ApiError | null` via TypeScript's implicit coercion — the compiler accepts it without complaint, but there's no runtime validation. An unexpected shape (e.g. an HTML error page from the platform) would pass through to `AppCard` and potentially throw at render time.

## Findings

- **`components/SearchPage.tsx:29-37`** — `fetch(...).then(r => r.json())` without type assertion or `r.ok` check

## Proposed Solutions

### Option A: Type assertion at parse boundary (Minimal)
```ts
fetch(`/api/ios?appId=${encodeURIComponent(iosId)}`)
  .then(r => r.json() as Promise<AppData | ApiError>)
```

Communicates intent, gives compile-time safety downstream, zero runtime overhead.

### Option B: Check `r.ok` before parsing (More robust)
```ts
.then(async r => {
  if (!r.ok && r.headers.get("content-type")?.includes("json") === false) {
    return { error: "Request failed", code: "SCRAPER_ERROR" } as ApiError;
  }
  return r.json() as Promise<AppData | ApiError>;
})
```

Handles the case where the platform returns a non-JSON 502 (HTML error page) — prevents a `SyntaxError` from unhandled JSON parse failure.

**Recommended:** Option B. The `r.ok` check is a common best practice that costs 3 lines.

## Acceptance Criteria
- [ ] `r.json()` return value is explicitly typed as `Promise<AppData | ApiError>` at both fetch call sites
- [ ] Non-JSON error responses don't cause unhandled promise rejections
- [ ] TypeScript compiler sees typed values downstream of the fetch

## Work Log
- 2026-02-21: Identified by kieran-typescript-reviewer (P2) in PR #1 review
