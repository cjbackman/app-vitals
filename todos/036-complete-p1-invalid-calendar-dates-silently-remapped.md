---
status: pending
priority: p1
issue_id: "036"
tags: [code-review, data-integrity, correctness, pr-4]
dependencies: []
---

# P1: Invalid calendar dates silently remapped to a different date

## Problem Statement

`normalizeSavedAt` validates date strings by calling `Number.isNaN(d.getTime())` after constructing a `Date`. JavaScript's `Date` constructor silently overflows calendar boundaries rather than returning `NaN`. For example, `"2025-02-29"` (Feb 29 on a non-leap year) produces `2025-03-01T00:00:00.000Z` — a valid timestamp. The validator passes it and the row is stored with the wrong date. The user's CSV said February, the DB records March.

```
normalizeSavedAt("2025-02-29") → "2025-03-01T00:00:00.000Z"  // WRONG: should return null
normalizeSavedAt("2025-11-31") → "2025-12-01T00:00:00.000Z"  // WRONG: should return null
```

Secondary consequence: the silently-remapped date becomes the dedup key. If a legitimate `2025-03-01` row already exists, the corrupt row is silently skipped (`skipped++`). The user has no way to know the skip was caused by a date overflow, not a true duplicate.

## Findings

- **`app/api/snapshots/bulk/route.ts:7–21`** — `normalizeSavedAt` uses only `Number.isNaN(d.getTime())` to validate date-only strings
- **`__tests__/api/snapshots-bulk.test.ts`** — no test covers non-existent calendar dates like `2025-02-29`
- Data integrity agent: confirmed via `node -e` that `new Date("2025-02-29T00:00:00.000Z").toISOString()` returns `"2025-03-01T00:00:00.000Z"`

## Proposed Solutions

### Option A: Round-trip check on day/month/year — Recommended

After parsing, verify the parsed UTC components match the original input:

```typescript
export function normalizeSavedAt(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const d = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(d.getTime()) ||
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() + 1 !== month ||
      d.getUTCDate() !== day
    ) {
      return null;
    }
    return d.toISOString();
  }
  return null;
}
```

**Pros:** Minimal change, pure fix, no new dependencies
**Cons:** None
**Effort:** Small
**Risk:** Low — only affects the date-only branch; full ISO strings are unchanged

### Option B: Regex pre-check the day range

Reject any date-only string where the day segment > 31 or month > 12 before parsing. Does not catch month-specific overflow (Feb 29–31, Apr/Jun/Sep/Nov 31).

**Pros:** Simpler than Option A
**Cons:** Incomplete — still misses Feb 30, Apr 31, etc.
**Effort:** Small
**Risk:** Medium — leaves gap for month-specific bad dates

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `app/api/snapshots/bulk/route.ts` (normalizeSavedAt), `__tests__/api/snapshots-bulk.test.ts`
- **New test cases to add:**
  ```typescript
  it("returns null for Feb 29 on a non-leap year", () => {
    expect(normalizeSavedAt("2025-02-29")).toBeNull();
  });
  it("returns null for Nov 31", () => {
    expect(normalizeSavedAt("2025-11-31")).toBeNull();
  });
  ```

## Acceptance Criteria

- [ ] `normalizeSavedAt("2025-02-29")` returns `null`
- [ ] `normalizeSavedAt("2025-11-31")` returns `null`
- [ ] `normalizeSavedAt("2024-02-29")` returns `"2024-02-29T00:00:00.000Z"` (2024 is a leap year)
- [ ] Existing tests still pass

## Work Log

- 2026-02-23: Created from PR #4 code review — data integrity guardian (P1) + pattern recognition specialist

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
