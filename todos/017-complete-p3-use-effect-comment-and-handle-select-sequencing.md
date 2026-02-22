---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, quality, documentation]
dependencies: []
---

# P3: `useEffect` eslint-disable unexplained; `handleSelect` sequencing undocumented

## Problem Statement

`SearchPage.tsx` has two related documentation gaps that make the intent unclear to a future reader:

1. `// eslint-disable-line react-hooks/exhaustive-deps` silences the linter without explaining *why* the stale closure is safe. The safety relies on `handleSearch` reading only its arguments (never component state), which is non-obvious.

2. `handleSelect` calls `setIosId`/`setAndroidId` (async state updates) then immediately calls `handleSearch` with explicit IDs. A reader may assume `handleSearch` uses the just-set state values and wonder why it isn't stale. The explicit argument passing is the key, but it's not documented.

## Findings

- **`components/SearchPage.tsx:81-83`** — eslint-disable with minimal explanation
- **`components/SearchPage.tsx:73-77`** — `handleSelect` state-then-search pattern
- Identified by: pattern-recognition-specialist + architecture-strategist (PR #2 review)

## Proposed Solutions

```ts
// SearchPage.tsx — improved comments

async function handleSearch({ iosId, androidId }: SearchParams) {
  // Uses only its arguments, never reads component state — safe for stale-closure contexts.
  ...
}

function handleSelect(preset: PresetApp) {
  setIosId(preset.iosId);     // schedules re-render (async)
  setAndroidId(preset.androidId);
  // Pass IDs directly — state setters above haven't flushed yet.
  handleSearch({ iosId: preset.iosId, androidId: preset.androidId });
}

useEffect(() => {
  // Runs once on mount to auto-search the default preset.
  // handleSearch omitted from deps intentionally: it only uses its arguments (not state),
  // so the mounted closure is safe to use for the lifetime of this effect.
  handleSearch({ iosId: DEFAULT.iosId, androidId: DEFAULT.androidId });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

## Acceptance Criteria
- [ ] The eslint-disable comment explains why the stale closure is safe
- [ ] `handleSelect` has a comment clarifying the explicit-argument pattern

## Work Log
- 2026-02-21: Identified by pattern-recognition-specialist in PR #2 review
