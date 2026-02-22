---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, quality, reliability]
dependencies: []
---

# P3: `PRESET_APPS[0]` crashes silently if array is empty

## Problem Statement

`SearchPage.tsx` reads `const DEFAULT = PRESET_APPS[0]` at module level, then immediately accesses `DEFAULT.iosId` and `DEFAULT.androidId` in `useState` initialisers. If `PRESET_APPS` is ever empty, this throws a `TypeError` at module initialisation time, crashing the entire page with no graceful error. TypeScript does not catch this with standard `strict` settings.

## Findings

- **`components/SearchPage.tsx:15`** — `const DEFAULT = PRESET_APPS[0]`
- **`components/SearchPage.tsx:18-19`** — `useState(DEFAULT.iosId)` / `useState(DEFAULT.androidId)`
- TypeScript's `noUncheckedIndexedAccess` (opt-in) would catch this; `strict: true` does not
- Identified by: architecture-strategist + pattern-recognition-specialist (PR #2 review)

## Proposed Solutions

### Option A: Runtime assertion (clear error message)
```ts
const DEFAULT = PRESET_APPS[0];
if (!DEFAULT) throw new Error("PRESET_APPS must not be empty — add at least one preset.");
```

### Option B: Non-null assertion with comment (minimal, explicit assumption)
```ts
// PRESET_APPS always has at least one entry; update this file if removing presets.
const DEFAULT = PRESET_APPS[0]!;
```

### Option C: Enable `noUncheckedIndexedAccess` in tsconfig.json
Catches this and all similar patterns at compile time. May require fixing other indexed accesses across the codebase.

**Recommended:** Option B — one character change, makes the assumption visible without adding runtime overhead.

## Acceptance Criteria
- [ ] Accessing `DEFAULT.iosId` cannot silently produce a `TypeError`
- [ ] Either TypeScript or a runtime check surfaces the problem if `PRESET_APPS` is emptied

## Work Log
- 2026-02-21: Identified by architecture-strategist + pattern-recognition-specialist in PR #2 review
