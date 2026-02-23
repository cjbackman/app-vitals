---
status: pending
priority: p2
issue_id: "039"
tags: [code-review, correctness, ux, pr-4]
dependencies: []
---

# P2: CSV BOM not stripped — Excel-exported files fail header validation

## Problem Statement

`parseCsv` in `ImportPage.tsx` compares the first line directly against `EXPECTED_HEADERS`. Excel (and some other CSV exporters) prepend a UTF-8 Byte Order Mark (`\uFEFF`) to the file. A BOM-prefixed file produces a header of `"\uFEFFstore,app_id,saved_at,..."` which does not equal `"store,app_id,saved_at,..."`. The user sees "Invalid headers" with no explanation. This is a common stumbling block for users exporting from Excel.

## Findings

- **`components/ImportPage.tsx:25`** — `const header = lines[0].trim().replace(/\r$/, "")` — no BOM removal
- Data integrity agent: confirmed Excel and some exporters prepend `\uFEFF` to CSV files
- Pattern recognition agent: flagged as common CSV gotcha

## Proposed Solutions

### Option A: Strip BOM before parsing — Recommended

```typescript
function parseCsv(text: string): ParseResult {
  // Strip UTF-8 BOM that Excel and some exporters prepend.
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.trim().split("\n");
  // ... rest of parser unchanged
}
```

**Pros:** One-line fix, zero dependencies, handles all BOM-prefixed exports
**Cons:** None
**Effort:** Minimal
**Risk:** Very low — BOM stripping is a well-understood, reversible operation

### Option B: Improve the error message instead

Keep the current parser but change the error to include a hint:

```typescript
return {
  ok: false,
  error: `Invalid headers. Expected:\n${EXPECTED_HEADERS}\n\nNote: If exported from Excel, try saving as "CSV UTF-8 (no BOM)".`,
};
```

**Pros:** Guides the user, no parsing change
**Cons:** Does not fix the underlying issue — user still has to re-export
**Effort:** Minimal
**Risk:** None

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `components/ImportPage.tsx` — `parseCsv` function
- **Test to add:**
  ```typescript
  it("parses a BOM-prefixed CSV correctly", async () => {
    const bomCsv = "\uFEFF" + VALID_CSV;
    render(<ImportPage />);
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    await act(async () => { await userEvent.upload(input, makeFile(bomCsv)); });
    expect(await screen.findByText(/2 rows ready to import/)).toBeInTheDocument();
  });
  ```

## Acceptance Criteria

- [ ] A CSV file with a leading UTF-8 BOM parses correctly (does not show "Invalid headers")
- [ ] A valid CSV without BOM continues to parse correctly
- [ ] Existing tests pass

## Work Log

- 2026-02-23: Created from PR #4 code review — data integrity guardian (P2)

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
