---
status: pending
priority: p3
issue_id: "020"
tags: [code-review, quality, conventions]
dependencies: []
---

# P3: `preset-apps.ts` uses kebab-case in a PascalCase component directory

## Problem Statement

Every file in `components/` uses PascalCase: `AppCard.tsx`, `AppPicker.tsx`, `AppSearch.tsx`, `SearchPage.tsx`. The new data module is named `preset-apps.ts` in kebab-case, creating an inconsistency that is jarring when reading import statements.

## Findings

- **`components/preset-apps.ts`** — kebab-case in a PascalCase directory
- Imported as `@/components/preset-apps` vs. `@/components/AppPicker`
- Identified by: pattern-recognition-specialist (PR #2 review)

## Proposed Solutions

### Option A: Rename to `PresetApps.ts`
Consistent with the rest of the directory. Update all imports.

```ts
import { PRESET_APPS } from "@/components/PresetApps";
```

### Option B: Move to `lib/preset-apps.ts` with a note that it's client-safe
`lib/` currently holds server-only modules. Either add a comment clarifying this file is an exception, or create a separate `data/` directory.

### Option C: Leave as-is
Kebab-case is conventional for non-component modules in many Next.js projects. The inconsistency is minor.

**Recommended:** Option A — one rename, zero behaviour change, consistent with existing conventions.

## Acceptance Criteria
- [ ] The file name matches the casing convention of its directory
- [ ] All imports updated

## Work Log
- 2026-02-21: Identified by pattern-recognition-specialist in PR #2 review
