---
status: pending
priority: p3
issue_id: "065"
tags: [code-review, performance]
dependencies: []
---

# Duplicate Leading-App Snapshot Fetch: AppCard + CompetitorTable

## Problem Statement

`AppCard` fetches up to 30 snapshots for the leading app to render its sparkline. `CompetitorTable` independently fetches snapshots for that same leading app to compute its velocity delta. Both fetches are cache-miss on first page load, hit the same `/api/snapshots?store=...&appId=...` URL, and are issued in the same render cycle. At 2 preset apps, this means the leading app's snapshots are fetched twice per page load with no benefit.

## Findings

- `components/AppCard.tsx` — calls `/api/snapshots?store=...&appId=...` for sparkline
- `components/CompetitorTable.tsx:98` — calls `/api/snapshots?store=...&appId=...` for leading app velocity
- Same URL, same query params — duplicate payload
- Both components mount simultaneously; no shared cache or context
- Performance reviewer noted: "duplicate leading-app snapshot fetch — AppCard + CompetitorTable both fetch same data"

## Proposed Solutions

### Option 1: Add `Cache-Control` first, then revisit

**Approach:** Once todo #062 adds `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` to `/api/snapshots`, the second fetch will be served from the Vercel CDN edge cache with near-zero cost. The duplication becomes economically trivial.

**Pros:** Zero code change to component logic; cache handles it automatically once #062 lands
**Cons:** Still two network round-trips from the browser; second hits CDN but isn't free
**Effort:** 0 (relies on #062)
**Risk:** None

---

### Option 2: Accept current state, add note to CompetitorTable

**Approach:** Leave the two fetches independent but add a comment in `CompetitorTable.tsx` explaining the duplication and noting it's acceptable while CDN caches are in place.

**Pros:** No code change
**Cons:** Slightly wasteful; easy to fix later
**Effort:** 5 minutes
**Risk:** None

---

### Option 3: Lift snapshot data to shared context

**Approach:** Create a React context (or a `useSWR`/`useQuery` deduplicated fetch) that both `AppCard` and `CompetitorTable` consume. Snapshot data is fetched once per app ID and shared.

**Pros:** Single fetch per app; clean separation of data fetching from presentation
**Cons:** Significant refactor; overkill for 2 preset apps; contradicts YAGNI
**Effort:** 2–3 hours
**Risk:** Medium (introduces new data-sharing layer)

---

## Recommended Action

Option 1 for now: once todo #062 adds `Cache-Control`, the CDN cache makes the second fetch free. Revisit Option 3 only if snapshot fetches become a measurable bottleneck with 10+ preset apps.

## Technical Details

**Affected files:**
- `components/AppCard.tsx` — leading-app sparkline fetch
- `components/CompetitorTable.tsx:98` — leading-app velocity fetch

## Acceptance Criteria

- [ ] Duplication acknowledged and tracked
- [ ] `Cache-Control` added (todo #062) to make second fetch cheap
- [ ] If refactored: only one fetch per app ID per page load

## Work Log

### 2026-03-01 - Discovery

**By:** Performance reviewer
