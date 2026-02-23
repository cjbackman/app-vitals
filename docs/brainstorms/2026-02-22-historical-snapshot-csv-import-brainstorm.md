---
date: 2026-02-22
topic: historical-snapshot-csv-import
---

# Historical Snapshot CSV Import

## What We're Building

A CSV import feature that lets users seed the local `snapshots` database with historical data. Users collect past ratings/review counts from any public source (AppSliced, Wayback Machine, AppFollow free pages) and upload a CSV file. The app validates and inserts the rows as historical `Snapshot` records, making sparklines show real trends immediately.

## Why This Approach

Three options were explored:
1. **CSV import** — simple, source-agnostic, zero scraping risk
2. **Wayback Machine scraper** — automated but fragile HTML parsing and inconsistent coverage
3. **Hybrid** — best of both, but most to build and maintain

CSV import wins on YAGNI. The user gets months of history in one import; the code reuses the existing `Snapshot` schema exactly; there are no ToS concerns and nothing to break when store page layouts change.

## Key Decisions

- **CSV format:** `store, app_id, saved_at, score, review_count, min_installs`
  Matches the existing `Snapshot` type. `min_installs` is optional (Android only).
- **Deduplication:** Skip rows where `(store, app_id, saved_at)` already exists — silently or with a count reported back.
- **Validation:** Row-level errors reported in the response; valid rows still insert (partial success).
- **UI placement:** Dedicated Import page or modal, not inline in the app card. Keeps the main lookup flow clean.
- **Scope:** Bulk insert only. No edit/delete of historical rows for now (YAGNI).

## Open Questions

- Should `saved_at` accept just a date (`2025-08-01`) or require full ISO 8601? Full ISO is cleaner but date-only is more spreadsheet-friendly.
- Max row limit per import? 1 000 rows is a sensible starting cap.
- Show per-row errors inline in the UI, or return a summary (`10 inserted, 2 skipped, 1 invalid`)?

## Next Steps

→ `/workflows:plan` for implementation details
