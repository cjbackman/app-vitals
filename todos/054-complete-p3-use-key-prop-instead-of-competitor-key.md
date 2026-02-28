---
status: complete
priority: p3
issue_id: "054"
tags: [code-review, architecture, react]
dependencies: []
---

# P3: Use `key` prop on CompetitorTable instances to replace the `competitorKey` useMemo pattern

## Problem Statement

`CompetitorTable` uses a `useMemo`-derived `competitorKey` string as a stable proxy for the `competitors` array in its `useEffect` dependency array. This adds complexity — a derived variable, a `useMemo`, an `eslint-disable` suppression — that can be replaced by the idiomatic React pattern: using a `key` prop on the component instances in `SearchPage`. When `key` changes, React fully remounts the component, resetting state and triggering the effect with a clean closure.

## Findings

- `components/CompetitorTable.tsx:48-52` — `competitorKey` useMemo:
  ```typescript
  const appIdKey = store === "ios" ? "iosId" : "androidId";
  const competitorKey = useMemo(
    () => competitors.map((c) => c[appIdKey]).join(","),
    [competitors, appIdKey]
  );
  ```
- `components/SearchPage.tsx:140-151` — no `key` prop on CompetitorTable instances
- Architecture-strategist flagged this as the idiomatic React approach for "reset component state when identity changes"
- If `key` handles the reset, `useEffect` deps become just `[store]` and the lint suppression disappears

## Proposed Solutions

### Option A: Add `key` to CompetitorTable in SearchPage (Recommended)

In `components/SearchPage.tsx`, add `key` props:
```tsx
<CompetitorTable
  key={`ios-${selectedPreset.iosId}`}
  store="ios"
  leadingPreset={selectedPreset}
  leadingData={leadingIos}
  competitors={competitors}
/>
<CompetitorTable
  key={`android-${selectedPreset.androidId}`}
  store="android"
  leadingPreset={selectedPreset}
  leadingData={leadingAndroid}
  competitors={competitors}
/>
```

Then in `CompetitorTable.tsx`, remove:
- `appIdKey` const (lines 48)
- `competitorKey` useMemo (lines 49-52)
- `eslint-disable` comment (line 80)

Change `useEffect` deps to `[store]` only, and use `store === "ios" ? "iosId" : "androidId"` inside the effect directly.

**Pros:** Simpler component internals, explicit reset semantics, no lint suppression needed, idiomatic React
**Cons:** Component fully remounts on preset change (brief visual reset — rows go back to `null`/dashes), state reset is more aggressive than in-place re-fetch
**Effort:** Small
**Risk:** Low — behavior is equivalent; the brief loading flash is acceptable (and currently happens anyway since `setRows` resets to `null` at the top of the effect)

### Option B: Keep `competitorKey` but add explanation comment (see todo 053)
Minimal fix — document why the pattern exists without restructuring.

**Pros:** No structural change
**Cons:** Retains the complexity
**Effort:** Trivial

## Acceptance Criteria
- [ ] `CompetitorTable` instances in `SearchPage` have store-specific `key` props
- [ ] `competitorKey` useMemo is removed from `CompetitorTable`
- [ ] `useEffect` deps no longer require `eslint-disable`
- [ ] All tests pass

## Work Log
- 2026-02-28: Identified by architecture-strategist in competitor table code review
