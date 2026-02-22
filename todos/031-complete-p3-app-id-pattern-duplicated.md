---
status: pending
priority: p3
issue_id: "031"
tags: [code-review, code-quality, duplication]
dependencies: []
---

# P3: `APP_ID_PATTERN` and `MAX_APP_ID_LENGTH` duplicated between route files

## Problem Statement

`APP_ID_PATTERN` and `MAX_APP_ID_LENGTH` are declared identically in both `lib/make-store-handler.ts` and `app/api/snapshots/route.ts`. If the pattern changes (e.g., numeric-only iOS IDs need support), one copy will be missed.

## Findings

- **`lib/make-store-handler.ts:5-6`** — original declaration
- **`app/api/snapshots/route.ts:3-4`** — identical copy
- Flagged by Pattern Recognition Specialist and DHH reviewer

## Proposed Solutions

### Option A: Export constants from `lib/make-store-handler.ts`

```ts
// lib/make-store-handler.ts
export const APP_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;
export const MAX_APP_ID_LENGTH = 256;

// app/api/snapshots/route.ts
import { APP_ID_PATTERN, MAX_APP_ID_LENGTH } from "@/lib/make-store-handler";
```

### Option B: Extract to `lib/validation.ts`

Cleaner separation — `make-store-handler.ts` is a factory, not a constants module. But adds a new file for two constants.

**Recommended:** Option A — minimal change; `make-store-handler.ts` already owns these.

## Acceptance Criteria

- [ ] Constants declared in one place only
- [ ] Both route files import from the shared source
- [ ] All tests still pass

## Work Log

- 2026-02-22: Flagged by Pattern Recognition Specialist and DHH reviewer in PR #3 review
