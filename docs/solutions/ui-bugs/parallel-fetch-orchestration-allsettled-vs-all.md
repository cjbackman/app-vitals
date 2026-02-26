---
title: "Use Promise.allSettled at outer orchestration level to prevent silent total failure"
date: 2026-02-26
category: logic-errors
module: SearchPage
tags: [fetch, promise, error-handling, resilience, competitor-comparison]
symptoms:
  - All competitor results disappear on an unexpected JS exception inside fetchPair
  - Single failing fetch wipes all results despite inner allSettled guards
---

# Use `Promise.allSettled` at the Outer Orchestration Level

## Problem

When fanning out multiple async operations in `Promise.all`, an unexpected rejection from any single operation silences all others. Inner `Promise.allSettled` guards only protect against predictable failures (network errors, non-200 responses). An unexpected JS exception that escapes the inner guards — JSON parse failure, type error, bug — rejects the outer `Promise.all` and drops every result.

In `SearchPage.handleSearch`, the leading app fetch and all competitor fetches were orchestrated with `Promise.all`. If any single `fetchPair` call threw unexpectedly, both `results` and `competitorResults` would remain null/empty with no user feedback.

## Root Cause

Asymmetry between inner and outer error boundaries:

```ts
// fetchPair uses allSettled internally — handles network errors gracefully
async function fetchPair(...): Promise<Results> {
  const [ios, android] = await Promise.allSettled([...]);
  return { ios: ios.status === "fulfilled" ? ios.value : SCRAPER_ERROR, ... };
}

// But outer level used all — one unexpected rejection wipes everything
const [leading, ...competitorData] = await Promise.all([  // ← wrong
  fetchPair(iosId, androidId),
  ...competitors.map((p) => fetchPair(p.iosId, p.androidId)),
]);
```

## Fix

Use `Promise.allSettled` at the outer level and handle each settled result individually. Also zip the preset into the competitor tuple inline — this eliminates the fragile parallel-index pattern where `competitors[i]` must stay aligned with `competitorData[i]`:

```ts
const [leadingSettled, ...competitorSettled] = await Promise.allSettled([
  fetchPair(iosId, androidId),
  // Each competitor carries its preset inline — no index arithmetic needed
  ...competitors.map(async (p): Promise<CompetitorResult> => ({
    preset: p,
    ...(await fetchPair(p.iosId, p.androidId)),
  })),
]);

setResults(
  leadingSettled.status === "fulfilled"
    ? leadingSettled.value
    : { ios: SCRAPER_ERROR, android: SCRAPER_ERROR }
);
setCompetitorResults(
  competitorSettled.map((settled, i) =>
    settled.status === "fulfilled"
      ? settled.value
      : { preset: competitors[i]!, ios: SCRAPER_ERROR, android: SCRAPER_ERROR }
  )
);
```

## Pattern

**Inner `allSettled`**: handles expected partial failures within a logical unit (one API of a pair failing).
**Outer `allSettled`**: handles unexpected failures between independent units (one competitor's entire fetch exploding).

Use `Promise.all` at the outer level only when you want fail-fast behaviour and there is no meaningful partial result to display.

## Files

- `components/SearchPage.tsx` — `handleSearch`, `fetchPair`

## References

- PR #6 review: performance-oracle, security-sentinel findings
