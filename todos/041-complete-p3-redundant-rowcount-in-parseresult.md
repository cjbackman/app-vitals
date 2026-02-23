---
status: pending
priority: p3
issue_id: "041"
tags: [code-review, cleanup, pr-4]
dependencies: []
---

# P3: `rowCount` is a redundant derived field in `ParseResult`

## Problem Statement

`ParseResult`'s success branch includes `rowCount: number`, but this is always equal to `rows.length`. The field is computed at the return site (`rowCount: rows.length`) and consumed only once in the render (`{parseResult.rowCount} row...`). Using `parseResult.rows.length` instead eliminates the redundant derived value from the type.

## Findings

- **`components/ImportPage.tsx:18`** — `rowCount: number` in `ParseResult` type definition
- **`components/ImportPage.tsx:52`** — `, rowCount: rows.length` in the return statement
- **`components/ImportPage.tsx:156`** — `{parseResult.rowCount}` in JSX
- Code simplicity reviewer: flagged as redundant derived state in a type (P2 in that agent's terms, P3 overall)

## Proposed Solutions

### Option A: Remove `rowCount` from the type — Recommended

```typescript
// Before:
type ParseResult =
  | { ok: true; rows: ParsedRow[]; rowCount: number }
  | { ok: false; error: string };

// After:
type ParseResult =
  | { ok: true; rows: ParsedRow[] }
  | { ok: false; error: string };
```

```typescript
// Before:
return { ok: true, rows, rowCount: rows.length };

// After:
return { ok: true, rows };
```

```tsx
// Before:
{parseResult.rowCount} row{parseResult.rowCount !== 1 ? "s" : ""}

// After:
{parseResult.rows.length} row{parseResult.rows.length !== 1 ? "s" : ""}
```

**Pros:** Type is simpler, no derived state in return value, -2 LOC
**Cons:** None
**Effort:** Minimal
**Risk:** None — purely additive simplification, no behaviour change

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `components/ImportPage.tsx` lines 18, 52, 156
- **Test update:** The test `"shows row count after a valid file is selected"` checks `/2 rows ready to import/` — no change needed if the text render is correct

## Acceptance Criteria

- [ ] `ParseResult` type no longer has `rowCount` field
- [ ] Row count still displays correctly in the UI
- [ ] All 10 ImportPage tests still pass

## Work Log

- 2026-02-23: Created from PR #4 code review — code simplicity reviewer

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
