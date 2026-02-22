---
status: pending
priority: p3
issue_id: "033"
tags: [code-review, correctness, react]
dependencies: []
---

# P3: `useEffect` in AppCard depends on `data` object identity instead of `appId`

## Problem Statement

`AppCard`'s snapshot fetch effect lists `data` as a dependency. This fires the effect whenever the parent passes a new object reference, even for the same app. Because `SearchPage` sets `results` to `null` before each search, every lookup triggers the effect twice (once on null, once on real data). If metadata is ever auto-refreshed, the effect fires on every refresh cycle regardless of whether the app changed.

The intent is "fetch snapshot history when the app identity changes" — `appId` is the correct signal.

## Findings

- **`components/AppCard.tsx:99`** — `}, [store, appId, data]`
- The guard `if (!appId || !data || isApiError(data))` inside the effect correctly handles all loading states
- Architecture Strategist and Performance Oracle both flagged this
- Currently safe due to AbortController; the risk is latent

## Proposed Solutions

### Option A: Remove `data` from dependency array (Recommended)

```ts
// components/AppCard.tsx
}, [store, appId]); // eslint-disable-line react-hooks/exhaustive-deps
```

The effect's guard inside (`if (!appId || !data || isApiError(data))`) still handles the case where data hasn't loaded yet. The effect fires once per `(store, appId)` pair change.

Add an ESLint disable comment since `data` is used inside the effect but deliberately excluded from deps (it's a guard, not a trigger).

### Option B: Keep current deps, add a comment

Document the double-fire behavior. Simpler change but doesn't fix the latent issue.

**Recommended:** Option A.

## Acceptance Criteria

- [ ] `data` removed from `useEffect` dependency array
- [ ] Snapshot history still loads correctly on app search
- [ ] Snapshot history still clears when `data` is null/error (via the guard inside the effect)
- [ ] ESLint disable comment added with explanation

## Work Log

- 2026-02-22: Flagged by Architecture Strategist and Performance Oracle in PR #3 review
