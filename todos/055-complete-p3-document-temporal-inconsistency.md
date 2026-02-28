---
status: complete
priority: p3
issue_id: "055"
tags: [code-review, documentation, architecture]
dependencies: []
---

# P3: Document temporal inconsistency between `leadingData` (prop) and `rows` (internal fetch)

## Problem Statement

`CompetitorTable` has two data sources with different latencies: `leadingData` arrives via prop from `SearchPage`'s fetch, while `rows` are fetched internally by the component. There is a window where they may be out of sync — e.g., `leadingData` updates to a new preset while `rows` still contains the old competitor data. The "vs you" columns show `—` during this window (correct, safe fallback), but this behavior is implicit. A comment would prevent future maintainers from treating the inconsistency as a bug or trying to "fix" it with unnecessary synchronization logic.

## Findings

- `components/CompetitorTable.tsx:14` — `leadingData` arrives as a prop (timed by SearchPage)
- `components/CompetitorTable.tsx:43` — `rows` are fetched internally (independent timing)
- Architecture-strategist identified this as the most notable design tension in the split responsibility
- The `—` fallback when `leadingScore` or `leadingReviews` is null (lines 125-132) correctly handles the inconsistency window
- No crash or incorrect data is shown — but the design decision is undocumented

## Proposed Solutions

### Option A: Add a comment to the `leadingData` prop JSDoc (Recommended)
In the `CompetitorTableProps` interface, extend the existing JSDoc:

```typescript
interface CompetitorTableProps {
  store: "ios" | "android";
  /** The preset currently selected as the leading app. */
  leadingPreset: PresetApp;
  /**
   * Current live data for the leading app (null while loading or on error).
   * Note: leadingData (from SearchPage's fetch) and rows (fetched internally)
   * may resolve at different times. The "vs you" columns show — whenever
   * either value is null, preventing a stale comparison from being displayed.
   */
  leadingData: AppData | null;
  /** Competitor presets to show in the table. */
  competitors: PresetApp[];
}
```

**Pros:** Co-located with the relevant prop, explains the design intent
**Cons:** Slightly longer interface definition
**Effort:** Trivial
**Risk:** None

### Option B: No comment
Accept that the behavior is implied by the render logic.

**Pros:** No change
**Cons:** Future maintainer may add unnecessary synchronization or treat the window as a bug

## Acceptance Criteria
- [ ] The `leadingData` prop comment (or a nearby comment) documents that `leadingData` and `rows` may temporarily be out of sync
- [ ] The comment explains why this is safe (the `—` fallback)

## Work Log
- 2026-02-28: Identified by architecture-strategist in competitor table code review
