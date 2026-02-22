---
status: pending
priority: p3
issue_id: "034"
tags: [code-review, testing, quality]
dependencies: []
---

# P3: SQL-string-asserting tests couple to implementation, not behaviour

## Problem Statement

Two tests in `__tests__/lib/snapshots.test.ts` assert that `db.prepare` was called with specific SQL substrings. These tests verify implementation details rather than observable output, provide false confidence (they pass even if the LIMIT is removed and replaced with `.slice()`), and make safe refactoring harder.

## Findings

- **`__tests__/lib/snapshots.test.ts:54-61`** — "calls db.prepare with an INSERT statement" — redundant with the adjacent "returns a Snapshot with correct fields" test
- **`__tests__/lib/snapshots.test.ts:126-131`** — "calls db.prepare with a SELECT LIMIT 30 query" — `stringContaining("LIMIT 30")` passes even if LIMIT is semantically broken
- Flagged by Simplicity Reviewer

## Proposed Solutions

### Option A: Delete both SQL-assertion tests (Recommended)

The behavioral tests adjacent to each ("returns a Snapshot with correct fields", "returns an array of Snapshot objects") already fail if the underlying SQL is wrong. The SQL-string tests add no additional coverage.

### Option B: Replace with behavioral tests

Add a test that provides >30 mock rows and asserts only 30 are returned. This actually tests the LIMIT behavior rather than the SQL text.

**Recommended:** Option B for the LIMIT test (real behavioral value), Option A for the INSERT test (already covered).

## Acceptance Criteria

- [ ] "calls db.prepare with an INSERT statement" test deleted (covered by behavioral test)
- [ ] "calls db.prepare with a SELECT LIMIT 30 query" either deleted or replaced with a behavioral test asserting max 30 results
- [ ] All remaining tests pass

## Work Log

- 2026-02-22: Flagged by Simplicity Reviewer in PR #3 review
