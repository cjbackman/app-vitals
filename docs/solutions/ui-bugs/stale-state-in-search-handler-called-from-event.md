---
title: "Don't read component state inside a handler called from a state setter — derive from function args"
date: 2026-02-26
category: logic-errors
module: SearchPage
tags: [react, state, async, handleSearch, handleSelect, derived-state]
symptoms:
  - Competitor cards don't appear when selecting a preset via AppPicker
  - Derived values computed from state are wrong when state hasn't re-rendered yet
---

# Don't Read Component State Inside a Handler Called From a State Setter

## Problem

`SearchPage` derives `selectedPreset` from state at render time. When `handleSelect` is called (user clicks an AppPicker button), it:

1. Calls `setIosId(preset.iosId)` and `setAndroidId(preset.androidId)`
2. Immediately calls `handleSearch({ iosId: preset.iosId, androidId: preset.androidId })`

State updates from step 1 are batched and not applied until the next render. So when `handleSearch` runs in step 2, `iosId`/`androidId` state still hold the *old* values, meaning `selectedPreset` (derived from state) is still the *old* preset (or null).

If `handleSearch` had used `selectedPreset` to derive competitors, it would compute the wrong competitor set — or no competitors at all.

## Root Cause

```ts
// selectedPreset is derived from state at render time
const selectedPreset = PRESET_APPS.find(
  (p) => p.iosId === iosId && p.androidId === androidId
) ?? null;

function handleSelect(preset: PresetApp) {
  setIosId(preset.iosId);       // queued — not applied yet
  setAndroidId(preset.androidId); // queued — not applied yet
  handleSearch({ iosId: preset.iosId, androidId: preset.androidId });
  // selectedPreset is still the OLD value at this point
}
```

## Fix

Inside `handleSearch`, re-derive the leading preset from the **function arguments**, not from the component state:

```ts
async function handleSearch({ iosId, androidId }: SearchParams) {
  // Re-derives from function args rather than selectedPreset — state may not have
  // flushed yet when called from handleSelect.
  const leadingPreset =
    PRESET_APPS.find((p) => p.iosId === iosId && p.androidId === androidId) ?? null;
  const competitors = leadingPreset
    ? PRESET_APPS.filter((p) => p !== leadingPreset)
    : [];
  // ...
}
```

This looks like a duplicate `find` (since `selectedPreset` is the same expression at the component level), but it is intentional. The two names are also semantically distinct: `selectedPreset` is a UI concept (which button is highlighted), `leadingPreset` is a search-logic concept (which app we're fetching for).

## Rule of Thumb

If a handler is ever called synchronously after a `setX(value)` call with `value` as one of its inputs, that handler must receive `value` as an explicit argument — not read it back from state.

## Files

- `components/SearchPage.tsx` — `handleSelect`, `handleSearch`, `selectedPreset` derivation

## References

- PR #6 review: code-simplicity-reviewer initially suggested merging the two `find` calls, but this would introduce a bug. Clarified in review synthesis.
