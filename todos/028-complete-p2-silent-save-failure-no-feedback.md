---
status: pending
priority: p2
issue_id: "028"
tags: [code-review, ux, correctness]
dependencies: []
---

# P2: Silent save failure — user gets no feedback when snapshot save fails

## Problem Statement

When `handleSave` catches an error, the button silently resets from "Saving…" to "Save snapshot" with no indication the save failed. The user believes their snapshot was taken when it was not. The component already has state machinery for "Saving…" and "Saved!" states — adding a "Save failed" state is trivial.

## Findings

- **`components/AppCard.tsx:129-131`** — `catch { /* Silently fail */ }`
- The save button has three states (`saving`, `saved`) but no error state
- Flagged by DHH reviewer, Architecture Strategist, Agent-Native Reviewer, and Pattern Recognition Specialist

## Proposed Solutions

### Option A: Add `saveError` state, show transient "Save failed" label (Recommended)

```ts
// components/AppCard.tsx
const [saveError, setSaveError] = useState(false);

// In handleSave catch:
} catch {
  setSaveError(true);
  timerRef.current = setTimeout(() => setSaveError(false), 3000);
}

// Save label:
const saveLabel = saving
  ? "Saving…"
  : saved
  ? "Saved!"
  : saveError
  ? "Save failed"
  : "Save snapshot";
```

Add `"text-red-500"` to the button's className when `saveError` is true.

### Option B: console.error only (no UI change)

Log to console in the catch block. No user visibility but aids development debugging.

**Recommended:** Option A — the user clicked a button and deserves to know if it failed.

## Acceptance Criteria

- [ ] Failed save shows "Save failed" label for ~3 seconds then resets
- [ ] Button styling changes (e.g., red text) when in error state
- [ ] Timer is cleaned up on unmount (use existing `timerRef` pattern)
- [ ] Test added: POST returns non-ok response → "Save failed" appears

## Work Log

- 2026-02-22: Flagged by DHH reviewer, Architecture Strategist, and Agent-Native Reviewer in PR #3 review
