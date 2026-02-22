---
status: pending
priority: p3
issue_id: "030"
tags: [code-review, testing, accessibility]
dependencies: []
---

# P3: `data-testid` wrapper div in SnapshotHistory deforms DOM for test convenience

## Problem Statement

The Android-only Installs sparkline is wrapped in a `<div data-testid="sparkline-installs">` whose sole purpose is to give tests a handle. But `aria-label="Installs trend"` is already present on the SVG itself. The test should query by `aria-label` (better — tests accessibility) instead of `data-testid` (worse — adds a production DOM node for test-only purposes).

## Findings

- **`components/SnapshotHistory.tsx:83-86`** — `<div data-testid="sparkline-installs">` wrapper
- **`__tests__/components/SnapshotHistory.test.tsx:52`** — `getByTestId("sparkline-installs")`
- `aria-label="Installs trend"` already exists on the SVG (`SnapshotHistory.tsx:50`)
- Flagged by DHH reviewer

## Proposed Solutions

### Option A: Remove wrapper div, update test to use aria-label (Recommended)

```tsx
// components/SnapshotHistory.tsx — remove the div wrapper
{store === "android" && installs.length > 0 && (
  <Sparkline data={installs} label="Installs" />
)}

// __tests__/components/SnapshotHistory.test.tsx:52
expect(screen.getByLabelText("Installs trend")).toBeInTheDocument();
```

The `getByLabelText("Installs trend")` assertion already exists at line 53 — line 52 (`getByTestId`) is now redundant.

## Acceptance Criteria

- [ ] `<div data-testid="sparkline-installs">` wrapper removed from SnapshotHistory
- [ ] Test uses `getByLabelText("Installs trend")` instead of `getByTestId`
- [ ] All SnapshotHistory tests still pass

## Work Log

- 2026-02-22: Flagged by DHH reviewer in PR #3 review
