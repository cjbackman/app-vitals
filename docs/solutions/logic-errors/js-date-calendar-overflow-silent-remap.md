---
date: 2026-02-23
topic: js-date-calendar-overflow
category: logic-errors
tags: [date-validation, sqlite, normalization, data-integrity]
symptoms:
  - "Invalid dates like 2025-02-29 pass validation and get stored with the wrong date"
  - "Users report data attributed to the wrong day or month"
  - "UNIQUE constraint skips silently after a date overflow remaps the dedup key"
module: snapshots-bulk-import
---

# JavaScript Date Constructor Silently Overflows Calendar Boundaries

## Problem

`new Date("2025-02-29T00:00:00.000Z").getTime()` returns a **valid** timestamp (not `NaN`). JavaScript's `Date` constructor silently rolls over to the next valid date — February 29 on a non-leap year becomes March 1. Validating with only `Number.isNaN(d.getTime())` passes these invalid dates through.

Downstream effects:
- The row is stored with the **wrong** `saved_at` date
- If a legitimate row for the remapped date already exists, the UNIQUE constraint fires and the corrupt row is silently skipped — the user sees a "skipped" count increment with no explanation

## Root Cause

`isNaN(date.getTime())` only catches completely unparseable strings. Calendar overflow is not an error to the JavaScript engine — it normalises silently.

## Fix

Round-trip check: after parsing, verify the UTC components match the original input:

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
      d.getUTCMonth() + 1 !== month ||  // getUTCMonth() is 0-indexed
      d.getUTCDate() !== day
    ) {
      return null;
    }
    return d.toISOString();
  }
  return null;
}
```

## Tests to Add

```typescript
it("returns null for Feb 29 on a non-leap year", () => {
  expect(normalizeSavedAt("2025-02-29")).toBeNull();
});
it("returns null for Nov 31", () => {
  expect(normalizeSavedAt("2025-11-31")).toBeNull();
});
it("accepts Feb 29 on a leap year", () => {
  expect(normalizeSavedAt("2024-02-29")).toBe("2024-02-29T00:00:00.000Z");
});
```

## Prevention

Always use a round-trip check when validating date-only strings. Never rely solely on `isNaN(date.getTime())` for calendar validity.
