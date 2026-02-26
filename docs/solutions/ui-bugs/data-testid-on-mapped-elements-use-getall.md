---
title: "data-testid on mapped elements requires getAllByTestId, not getByTestId"
date: 2026-02-26
category: ui-bugs
module: SearchPage tests
tags: [testing, react-testing-library, data-testid, mapped-elements, rtl]
symptoms:
  - Tests pass with 1 competitor but break silently when a second is added
  - "Found multiple elements with the same testid" error after adding a preset
---

# `data-testid` on Mapped Elements — Use `getAllByTestId`

## Problem

Placing `data-testid="competitor-section"` inside a `.map()` call produces one element per iteration with the same testid. React Testing Library's `getByTestId` and `queryByTestId` throw if more than one element matches. Tests that use these pass at N=1 competitor but break the moment a second preset is added.

```tsx
// SearchPage.tsx — N competitors → N elements with the same testid
{competitorResults.map(({ preset, ios, android }) => (
  <div key={preset.iosId} data-testid="competitor-section" ...>
```

```ts
// Breaks at N=2
expect(screen.getByTestId("competitor-section")).toBeInTheDocument();    // throws
expect(screen.queryByTestId("competitor-section")).not.toBeInTheDocument(); // throws
```

## Fix

Use the `*All*` variants everywhere the testid may appear on multiple elements:

```ts
// "Is at least one present?"
expect(screen.getAllByTestId("competitor-section")[0]).toBeInTheDocument();

// OR more idiomatically — just check the array has elements
expect(screen.getAllByTestId("competitor-section").length).toBeGreaterThan(0);

// "Are none present?"
expect(screen.queryAllByTestId("competitor-section")).toHaveLength(0);
```

## Alternative: Wrap the whole list, not each item

If you need a single testid for the entire competitors section, place it on a wrapper outside the map:

```tsx
<div data-testid="competitors-container">
  {competitorResults.map(({ preset, ios, android }) => (
    <div key={preset.iosId} className="space-y-3">
      ...
    </div>
  ))}
</div>
```

Then `getByTestId("competitors-container")` and `queryByTestId("competitors-container")` work safely — there is exactly one element.

## Rule of Thumb

- `data-testid` inside `.map()` → always use `getAllByTestId` / `queryAllByTestId`
- `data-testid` on a singleton wrapper → safe to use `getByTestId` / `queryByTestId`

## Files

- `components/SearchPage.tsx` — `data-testid="competitor-section"` inside `competitorResults.map()`
- `__tests__/components/SearchPage.test.tsx` — updated to use `getAllByTestId` / `queryAllByTestId`

## References

- PR #6 review: pattern-recognition-specialist and architecture-strategist findings
