---
status: pending
priority: p3
issue_id: "040"
tags: [code-review, cleanup, pr-4]
dependencies: []
---

# P3: Unused `inputRef` dead code in ImportPage

## Problem Statement

`ImportPage.tsx` declares `const inputRef = useRef<HTMLInputElement>(null)` and attaches it to the file input as `ref={inputRef}`, but never reads or calls the ref anywhere in the component. There is no programmatic reset, focus, or value inspection. This is dead code that imports `useRef` unnecessarily.

## Findings

- **`components/ImportPage.tsx:3`** — `useRef` imported
- **`components/ImportPage.tsx:60`** — `const inputRef = useRef<HTMLInputElement>(null)`
- **`components/ImportPage.tsx:142`** — `ref={inputRef}` on the file input
- Code simplicity reviewer: flagged as dead code (P1 in that agent's terms, P3 overall)

## Proposed Solutions

### Option A: Remove the ref entirely — Recommended

```tsx
// Remove from import:
import { useState } from "react";  // remove useRef

// Remove declaration:
// const inputRef = useRef<HTMLInputElement>(null);  <-- delete

// Remove from JSX:
<input
  id="csv-file"
  type="file"
  accept=".csv"
  onChange={handleFile}
  // ref={inputRef}  <-- delete
  className="..."
/>
```

**Pros:** 3 lines removed, cleaner
**Cons:** None — if a programmatic reset is needed in the future, the ref can be re-added
**Effort:** Minimal
**Risk:** None

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `components/ImportPage.tsx` lines 3, 60, 142

## Acceptance Criteria

- [ ] `useRef` removed from import if it was the only usage
- [ ] `inputRef` declaration and `ref={inputRef}` JSX prop removed
- [ ] All 10 ImportPage tests still pass

## Work Log

- 2026-02-23: Created from PR #4 code review — code simplicity reviewer

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
