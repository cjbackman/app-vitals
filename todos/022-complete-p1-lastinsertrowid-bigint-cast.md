---
status: pending
priority: p1
issue_id: "022"
tags: [code-review, type-safety, data-integrity]
dependencies: []
---

# P1: `lastInsertRowid as number` silently hides bigint case

## Problem Statement

`better-sqlite3` types `RunResult.lastInsertRowid` as `number | bigint`. The cast `result.lastInsertRowid as number` compiles cleanly but silently corrupts the returned `id` field when the row ID exceeds `Number.MAX_SAFE_INTEGER` (2^53). The correct conversion is `Number(result.lastInsertRowid)`, which handles both the `number` and `bigint` cases honestly.

## Findings

- **`lib/snapshots.ts:21`** — `id: result.lastInsertRowid as number`
- Flagged by both Kieran (TypeScript reviewer) and Data Integrity Guardian

## Proposed Solutions

### Option A: Use `Number()` conversion (Recommended)

```ts
// lib/snapshots.ts:21
id: Number(result.lastInsertRowid),
```

Safe for all practical table sizes, honest about the conversion, satisfies the `number` type without a lie.

### Option B: Keep `as number` with comment

Add a comment explaining the cast is safe below 2^53 rows. Still a type lie — not recommended.

**Recommended:** Option A — one character change, zero risk.

## Acceptance Criteria

- [ ] `result.lastInsertRowid as number` replaced with `Number(result.lastInsertRowid)`
- [ ] TypeScript still compiles cleanly
- [ ] Existing snapshots tests still pass

## Work Log

- 2026-02-22: Flagged by Kieran TypeScript Reviewer and Data Integrity Guardian in PR #3 review
