---
status: complete
priority: p3
issue_id: "053"
tags: [code-review, quality, documentation]
dependencies: []
---

# P3: `eslint-disable react-hooks/exhaustive-deps` comment in CompetitorTable needs a "why"

## Problem Statement

`CompetitorTable.tsx` suppresses the `react-hooks/exhaustive-deps` lint rule without explaining why the non-exhaustive dep array is intentional. A future developer could remove the suppression and add `competitors` back to the array, breaking the stable-dependency pattern and causing re-fetches on every parent render.

## Findings

- `components/CompetitorTable.tsx:80-81`:
  ```typescript
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, competitorKey]);
  ```
  The suppression hides that `competitors` and `appIdKey` are intentionally omitted — `competitorKey` is their stable string proxy
- The existing comment on line 47 (`// Stable dependency: join of IDs rather than array reference.`) is on `competitorKey`, not on the `useEffect` — it may not be read as the explanation for the lint suppression
- `components/SearchPage.tsx:84` has the same pattern but with an inline comment that is visible right at the suppression: `// eslint-disable-line react-hooks/exhaustive-deps` — also bare
- Identified by kieran-typescript-reviewer, pattern-recognition-specialist, architecture-strategist

## Proposed Solutions

### Option A: Add explanation inline with the suppression (Recommended)
Replace:
```typescript
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, competitorKey]);
```
With:
```typescript
    // competitors is intentionally excluded: competitorKey is its stable string proxy (see line 49).
    // appIdKey is excluded: derived from store, which is already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, competitorKey]);
```

**Pros:** Future-proof, explanation is co-located with the suppression
**Cons:** 2 extra comment lines
**Effort:** Trivial
**Risk:** None

### Option B: Use `key` prop on CompetitorTable in SearchPage (see todo 054)
If `key={selectedPreset.iosId}` is added to CompetitorTable instances in SearchPage, the `competitorKey` machinery can be removed entirely and `useEffect` deps become just `[store]` — eliminating the suppression.

## Acceptance Criteria
- [ ] The `eslint-disable` suppression in `CompetitorTable.tsx` has an explanation comment directly above it
- [ ] The explanation states which values are omitted and why

## Work Log
- 2026-02-28: Identified by multiple reviewers in competitor table code review
