---
status: pending
priority: p3
issue_id: "046"
tags: [code-review, architecture, scalability, documentation]
dependencies: []
---

# P3: Fetch-all-competitors strategy needs an explicit architectural decision record

## Problem Statement

`SearchPage.handleSearch` fetches all non-leading presets in parallel on every search. At N=2 this is 4 concurrent scraper requests. The strategy scales linearly: N=10 → 20 concurrent scraper requests + 20 snapshot requests from AppCard effects. There is no cap, lazy loading, or pagination. This is acceptable for the current preset count but will need revisiting as `PRESET_APPS` grows.

## Findings

- **`components/SearchPage.tsx:68-79`** — `Promise.allSettled` fans out to all competitors simultaneously
- Scraper requests (via `/api/ios`, `/api/android`) hit external Apple/Google APIs; rate limiting risk at scale
- Each competitor `AppCard` also independently fires `/api/snapshots` GETs (untracked by `SearchPage`)
- Identified by architecture-strategist and performance-oracle in PR #6 review

| N presets | Scraper fetches | Snapshot fetches | Total concurrent |
|-----------|----------------|-----------------|-----------------|
| 2 (now)   | 4              | 4               | 8               |
| 5         | 10             | 10              | 20              |
| 10        | 20             | 20              | 40              |

## Proposed Solutions

### Option A: Add a code comment in SearchPage (Quick)
Document the trade-off inline at the `Promise.allSettled` call site so future developers understand the scaling assumption.

### Option B: Create `docs/solutions/` entry
Write a proper solution doc that captures the decision, the scaling table, and the future trigger point (e.g. "revisit when N > 5").

### Option C: Add a soft cap + lazy-load competitors
Limit `competitors` to the first N-1 presets, or load competitor data on scroll into view (Intersection Observer). More complex but bounded request count.

**Recommended:** Option A now (one comment), Option B if the preset list grows past 4.

## Acceptance Criteria
- [ ] The scaling trade-off is documented in at least one place (code comment or solution doc)
- [ ] A clear trigger is defined for when to revisit the strategy (e.g. N > 5 presets)

## Work Log
- 2026-02-25: Identified by architecture-strategist and performance-oracle in PR #6 review
