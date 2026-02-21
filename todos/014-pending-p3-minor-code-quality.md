---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, code-quality, typescript, dx]
dependencies: ["002"]
---

# P3: Minor code quality improvements (5 small items)

## Problem Statement

A collection of small, low-effort improvements identified across multiple agents.

## Findings

### 1. `setLoading(false)` not in `finally` block
**`components/SearchPage.tsx:51`** — `Promise.allSettled` never rejects, so `setLoading(false)` is always reached today. But if the fetch logic is ever refactored to use `Promise.all` or adds pre-flight logic, loading could get stuck. Use `try/finally`.

### 2. `SearchParams` interface re-inlined in SearchPage instead of reused
**`components/SearchPage.tsx:17-23`** — `handleSearch` redeclares `{ iosId: string; androidId: string }` inline instead of importing `SearchParams` from `AppSearch.tsx`. If the interface changes, both places need updating.

### 3. `fetch*` vs `get*` convention undocumented
**`lib/ios-store.ts:21,62`**, **`lib/android-store.ts:21,58`** — The `fetch*` (uncached) / `get*` (cached) naming convention is coherent but not documented. New contributors won't know which to call from routes. Add a JSDoc comment.

### 4. Missing comment in `ios-store.ts` explaining `raw.updated` is already ISO
**`lib/ios-store.ts:56`** — Android has a comment explaining Unix ms → ISO conversion. iOS has no comment explaining `raw.updated` is already ISO 8601. The asymmetry is subtle and could lead a maintainer to "fix" it incorrectly.

### 5. Error 404 response reflects raw `appId` in message body
**`app/api/ios/route.ts:24-27`**, **`app/api/android/route.ts:24-27`** — `err.message` (which includes the user-supplied `appId`) is returned in the JSON response. While the input is validated, reflecting user input in responses is a habit worth breaking. Use a static message in the response; log `err.message` server-side.

## Proposed Fixes

1. Wrap `Promise.allSettled` in `try/finally` in `SearchPage.tsx`
2. Export `SearchParams` from `AppSearch.tsx`; import in `SearchPage.tsx`
3. Add JSDoc to `fetchIosApp`/`getIosApp` (and Android equivalents) explaining the `fetch*`/`get*` pattern
4. Add comment at `lib/ios-store.ts:56`: `// raw.updated is already an ISO 8601 string from the iTunes API`
5. Replace `{ error: err.message, ... }` with `{ error: "App not found", ... }` in route 404 handlers; keep `err.message` in server-side log only

## Acceptance Criteria
- [ ] `setLoading(false)` is in a `finally` block
- [ ] `SearchParams` is exported and reused across both components
- [ ] JSDoc comments explain the `fetch*`/`get*` naming convention
- [ ] `raw.updated` comment added to `ios-store.ts`
- [ ] 404 response body uses a static error message

## Work Log
- 2026-02-21: Identified by kieran-typescript-reviewer, pattern-recognition-specialist, security-sentinel in PR #1 review
