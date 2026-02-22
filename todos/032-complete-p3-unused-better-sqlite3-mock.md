---
status: pending
priority: p3
issue_id: "032"
tags: [code-review, testing, cleanup]
dependencies: []
---

# P3: `__mocks__/better-sqlite3.ts` is unused dead code

## Problem Statement

`__mocks__/better-sqlite3.ts` exports a `MockDatabase` factory and several mock functions that no test file imports or relies on. All tests mock at higher layers (`@/lib/db` or `@/lib/snapshots`). The file drifts silently from the real better-sqlite3 API and creates a misleading impression that tests exercise the DB layer through better-sqlite3.

## Findings

- **`__mocks__/better-sqlite3.ts`** — `mockGet` (lines 4) is exported but better-sqlite3's `.get()` is never called by this codebase
- `snapshots.test.ts` mocks `@/lib/db` directly, not `better-sqlite3`
- `api/snapshots.test.ts` mocks `@/lib/snapshots` directly
- Flagged by Kieran TypeScript Reviewer, Simplicity Reviewer, and Pattern Recognition Specialist

## Proposed Solutions

### Option A: Delete the file (Recommended)

```bash
rm __mocks__/better-sqlite3.ts
```

The DB layer is correctly tested by mocking `@/lib/db`. The `__mocks__` directory convention only activates when a test calls `jest.mock("better-sqlite3")` with no factory — no test does this.

### Option B: Add a comment explaining why it exists

Document it as scaffolding for future integration tests. Keeps the file but prevents confusion.

**Recommended:** Option A — YAGNI. Delete unused code.

## Acceptance Criteria

- [ ] `__mocks__/better-sqlite3.ts` deleted
- [ ] `grep -r 'jest.mock.*better-sqlite3' __tests__/` returns no results (confirms nothing depended on it)
- [ ] All tests still pass

## Work Log

- 2026-02-22: Flagged by Kieran, Simplicity Reviewer, and Pattern Recognition Specialist in PR #3 review
