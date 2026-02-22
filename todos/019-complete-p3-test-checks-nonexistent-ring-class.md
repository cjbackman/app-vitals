---
status: pending
priority: p3
issue_id: "019"
tags: [code-review, testing, quality]
dependencies: []
---

# P3: AppPicker test asserts `ring-2` class that doesn't exist in the component

## Problem Statement

`AppPicker.test.tsx` test 5 checks `expect(btn.className).not.toContain("ring-2")`. The component's active state uses `border-blue-400 bg-blue-50` — there is no `ring-2` anywhere in `AppPicker.tsx`. The assertion always trivially passes regardless of the component's actual behaviour. It catches nothing.

Additionally, the test duplicates the `aria-pressed=false` assertion already present in test 4, making it fully redundant.

## Findings

- **`__tests__/components/AppPicker.test.tsx:48-53`** — checks `ring-2` (absent from component); duplicates test 4
- **`components/AppPicker.tsx:25-26`** — active uses `border-blue-400`, not `ring-2`
- Identified by: pattern-recognition-specialist + code-simplicity-reviewer (PR #2 review)

## Proposed Solutions

### Option A: Remove test 5 entirely
Test 4 already covers the `aria-pressed=false` case. Test 5 adds nothing.

### Option B: Replace className check with the actual inactive class
```ts
it("does not apply active styling when selected preset is null", () => {
  render(<AppPicker selectedPreset={null} onSelect={jest.fn()} />);
  const btn = screen.getByRole("button", { name: babbel.name });
  expect(btn).not.toHaveClass("border-blue-400");
  expect(btn).not.toHaveClass("bg-blue-50");
});
```

**Recommended:** Option A — remove the redundant test. `aria-pressed` is the semantic contract worth testing; Tailwind class names are implementation details.

## Acceptance Criteria
- [ ] No test asserts the presence or absence of a Tailwind class that is not used in the component
- [ ] Each test case covers a distinct behaviour

## Work Log
- 2026-02-21: Identified by pattern-recognition-specialist in PR #2 review
