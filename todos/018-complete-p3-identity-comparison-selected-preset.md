---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, quality, reliability]
dependencies: []
---

# P3: `preset === selectedPreset` uses object identity — fragile assumption

## Problem Statement

`AppPicker` computes `isActive = preset === selectedPreset` using object identity. This works because both sides reference elements from the same `PRESET_APPS` module singleton. However, the assumption is invisible and will silently break if `PRESET_APPS` is ever spread, filtered, or re-derived — resulting in no button being highlighted without any error.

## Findings

- **`components/AppPicker.tsx:15`** — `const isActive = preset === selectedPreset`
- Object identity is correct today (module-level const, same reference), but undocumented
- Would silently break if `PRESET_APPS` is reconstructed (e.g., `[...PRESET_APPS]`) or if selection state is ever serialised/deserialised
- Identified by: architecture-strategist + pattern-recognition-specialist (PR #2 review)

## Proposed Solutions

### Option A: Value comparison (safest)
```tsx
// AppPicker.tsx
const isActive =
  selectedPreset !== null &&
  preset.iosId === selectedPreset.iosId &&
  preset.androidId === selectedPreset.androidId;
```

### Option B: Add a comment explaining the identity assumption (minimal)
```tsx
// Identity comparison is safe: both sides are references into the PRESET_APPS
// module singleton. If PRESET_APPS is ever reconstructed, switch to value comparison.
const isActive = preset === selectedPreset;
```

**Recommended:** Option A — 2 extra lines, eliminates the class of bugs entirely.

## Acceptance Criteria
- [ ] Active preset detection does not depend on object identity
- OR the identity assumption is explicitly documented with a warning

## Work Log
- 2026-02-21: Identified by pattern-recognition-specialist + architecture-strategist in PR #2 review
