---
status: pending
priority: p3
issue_id: "045"
tags: [code-review, quality, testing, duplication]
dependencies: []
---

# P3: `next/image` jest mock duplicated across two test files

## Problem Statement

The `jest.mock("next/image", ...)` factory is copy-pasted verbatim into two test files. This is inconsistent with how `next/cache` and `server-only` are already handled in this project (via `__mocks__/` module files). If the mock needs updating (e.g. new Next.js props), it must be changed in two places.

## Findings

- **`__tests__/components/AppPicker.test.tsx:7-15`** — `jest.mock("next/image", ...)` factory
- **`__tests__/components/SearchPage.test.tsx:11-24`** — identical factory (slightly extended to also destructure `fill`/`sizes` props)
- Project already uses `__mocks__/` pattern for `next/cache` and `server-only`
- Identified by pattern-recognition-specialist in PR #6 review

## Proposed Solutions

### Option A: Shared `__mocks__/next/image.tsx` file (Recommended)
```tsx
// __mocks__/next/image.tsx
import React from "react";
export default function MockImage({
  fill: _fill,
  sizes: _sizes,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; sizes?: string }) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} />;
}
```
Jest auto-discovers `__mocks__/next/image.tsx` for `next/image` imports. Remove the manual `jest.mock(...)` calls from both test files.

### Option B: Shared test utility
Export a `mockNextImage()` helper from a `__tests__/helpers/mocks.ts` file and call it in `beforeAll`. More explicit but less idiomatic.

**Recommended:** Option A — consistent with the existing `__mocks__/` pattern in this project.

## Acceptance Criteria
- [ ] `next/image` mock defined in exactly one place
- [ ] Both `AppPicker.test.tsx` and `SearchPage.test.tsx` tests continue to pass
- [ ] No manual `jest.mock("next/image", ...)` calls remain in test files

## Work Log
- 2026-02-25: Identified by pattern-recognition-specialist in PR #6 review
