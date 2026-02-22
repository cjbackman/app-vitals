---
status: pending
priority: p2
issue_id: "023"
tags: [code-review, performance, correctness]
dependencies: []
---

# P2: Post-save double fetch — redundant GET after POST

## Problem Statement

`AppCard.handleSave` fires a POST to `/api/snapshots` and then immediately fires a GET to re-fetch all snapshots for the same app. This is wasteful: the POST already returns the newly saved `Snapshot` at status 201. The re-fetch round-trip adds 40–200ms per save, and it contradicts a design decision in `lib/snapshots.ts` to avoid a second DB read in `saveSnapshot`.

## Findings

- **`components/AppCard.tsx:106-125`** — POST followed by GET
- **`app/api/snapshots/route.ts:64`** — POST returns the full `Snapshot` object at 201
- Flagged by DHH reviewer and Performance Oracle

## Proposed Solutions

### Option A: Use POST response, append locally (Recommended)

```ts
// components/AppCard.tsx — handleSave
const res = await fetch("/api/snapshots", { method: "POST", ... });
const saved: Snapshot = await res.json();
setSnapshots((prev) => [...prev, saved].slice(-30));
// Remove the subsequent GET fetch entirely
```

One network call instead of two. The local state is updated optimistically and stays in sync.

### Option B: Keep the re-fetch but parallelise

Fire POST and GET concurrently. Still wastes a request but hides the latency. More complex.

**Recommended:** Option A — simpler, faster, consistent with the `saveSnapshot` design intent.

## Acceptance Criteria

- [ ] `handleSave` makes exactly one network call (the POST)
- [ ] Snapshot list is updated by appending the saved snapshot returned from the POST
- [ ] "Saved!" feedback still appears correctly
- [ ] Existing save tests still pass

## Work Log

- 2026-02-22: Flagged by DHH reviewer and Performance Oracle in PR #3 review
