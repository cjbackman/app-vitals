---
date: 2026-02-23
topic: csv-bom-strip-excel
category: ui-bugs
tags: [csv, bom, excel, parsing, file-upload]
symptoms:
  - "CSV exported from Excel shows 'Invalid headers' error even though headers look correct"
  - "Header comparison fails for files from Mac Numbers, LibreOffice, or Windows Excel"
module: import-page
---

# Strip UTF-8 BOM Before Parsing CSV Headers

## Problem

Excel and many other spreadsheet apps prepend a UTF-8 Byte Order Mark (`\uFEFF`, 3 bytes: `EF BB BF`) to CSV files. This character is invisible in most text editors. When a client-side CSV parser compares the first line to an expected header string:

```typescript
if (header !== "store,app_id,saved_at,...") // fails for BOM-prefixed files
```

…the comparison fails because the actual value is `"\uFEFFstore,app_id,saved_at,..."`. The user sees "Invalid headers" with no explanation.

## Fix

Strip the BOM at the very beginning of parsing, before any other processing:

```typescript
function parseCsv(text: string): ParseResult {
  // Strip UTF-8 BOM that Excel and some exporters prepend.
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.trim().split("\n");
  // ... rest of parser unchanged
}
```

## Test

```typescript
it("parses a BOM-prefixed CSV correctly (Excel export)", async () => {
  const bomCsv = "\uFEFF" + VALID_CSV;
  render(<ImportPage />);
  const input = screen.getByLabelText("CSV file") as HTMLInputElement;
  await act(async () => { await userEvent.upload(input, makeFile(bomCsv)); });
  expect(await screen.findByText(/2 rows ready to import/)).toBeInTheDocument();
});
```

## Prevention

Always strip BOM before processing any user-uploaded text file. The pattern `/^\uFEFF/` matches only the leading BOM and does not affect file content.
