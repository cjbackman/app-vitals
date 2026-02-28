---
status: complete
priority: p2
issue_id: "048"
tags: [code-review, quality, react]
dependencies: []
---

# P2: `key={preset.iosId}` on Android table rows is semantically wrong

## Problem Statement

`CompetitorTable.tsx` renders `<tr key={preset.iosId}>` for competitor rows regardless of the `store` prop. When `store === "android"`, the key should be `preset.androidId` (or `preset[appIdKey]`). The current code works only because every `PresetApp` has both IDs and they happen to be unique across the preset list — but it is semantically incorrect and will become a real bug if an Android-only preset is ever added.

## Findings

- `components/CompetitorTable.tsx:142` — `<tr key={preset.iosId}` used in both iOS and Android table renders
- `appIdKey` is already computed on line 48 (`store === "ios" ? "iosId" : "androidId"`) and is available in the render loop
- React uses `key` for reconciliation identity; using the wrong ID makes the intent opaque and could cause reconciliation bugs if IDs diverge
- `AppPicker.tsx:22` uses `key={preset.iosId}` correctly because it is store-agnostic (picks a preset, not a store-specific row)
- Identified by kieran-typescript-reviewer and pattern-recognition-specialist

## Proposed Solutions

### Option A: Use `preset[appIdKey]` (Recommended)
Change line 142 from:
```tsx
<tr key={preset.iosId} className="border-b border-gray-50 last:border-0">
```
to:
```tsx
<tr key={preset[appIdKey]} className="border-b border-gray-50 last:border-0">
```

`appIdKey` is already in scope — this is a one-character-range fix.

**Pros:** Semantically correct, self-documenting, works for Android-only presets
**Cons:** None
**Effort:** Tiny
**Risk:** None — same values for current presets, correct semantics going forward

### Option B: Use `preset.androidId` in the Android branch
Would require conditional logic or restructuring the render. Option A is simpler.

## Acceptance Criteria
- [ ] Row keys in the iOS table use `preset.iosId` (or `preset[appIdKey]` when `store === "ios"`)
- [ ] Row keys in the Android table use `preset.androidId` (or `preset[appIdKey]` when `store === "android"`)
- [ ] All tests pass

## Work Log
- 2026-02-28: Identified by kieran-typescript-reviewer and pattern-recognition-specialist in competitor table code review
