---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, ux, i18n]
dependencies: []
---

# P3: `formatPrice` ignores the `currency` field — always displays `$`

## Problem Statement

`AppCard.tsx`'s `formatPrice` function hard-codes `$` for paid apps, ignoring the `currency` field that `AppPrice` carries. An app priced at €2.99 in EUR displays as `$2.99`.

## Findings

- **`components/AppCard.tsx:28-31`**:
```ts
function formatPrice(price: AppData["price"]): string {
  if (price.type === "free") return "Free";
  return `$${price.amount.toFixed(2)}`;  // currency field ignored
}
```

- **`types/app-data.ts:2-3`** — `AppPrice` includes `currency: string` on paid type

## Proposed Solution

```ts
function formatPrice(price: AppData["price"]): string {
  if (price.type === "free") return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
  }).format(price.amount);
}
```

## Acceptance Criteria
- [ ] Paid apps display the correct currency symbol based on the `currency` field
- [ ] Free apps still display "Free"
- [ ] Test covers a non-USD currency case

## Work Log
- 2026-02-21: Identified by kieran-typescript-reviewer (P3) in PR #1 review
