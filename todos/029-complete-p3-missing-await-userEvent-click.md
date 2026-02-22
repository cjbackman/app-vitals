---
status: pending
priority: p3
issue_id: "029"
tags: [code-review, testing]
dependencies: []
---

# P3: Missing `await` on `userEvent.click` in AppCard save test

## Problem Statement

`@testing-library/user-event` v14 returns a Promise from `userEvent.click()`. The test at line 165 omits the `await`, meaning the click event may not fully flush before the `waitFor` assertion. The test passes by luck due to the retry loop — but this is a hidden timing dependency.

## Findings

- **`__tests__/components/AppCard.test.tsx:165`** — `userEvent.click(button);` without `await`
- Flagged by Kieran TypeScript Reviewer

## Proposed Solutions

### Option A: Add `await` (Recommended)

```ts
// __tests__/components/AppCard.test.tsx
await userEvent.click(button);
```

One word fix.

## Acceptance Criteria

- [ ] `userEvent.click` is awaited in the "shows Saving…" test
- [ ] Test still passes

## Work Log

- 2026-02-22: Flagged by Kieran TypeScript Reviewer in PR #3 review
