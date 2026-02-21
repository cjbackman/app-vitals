---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# P2: Replace fragile `"code" in data` discriminant with a type guard or tagged union

## Problem Statement

`AppCard.tsx` uses `"code" in data` to distinguish `ApiError` from `AppData`. This is a structural duck-type check, not a proper discriminated union. If `AppData` ever gains a field named `code` (e.g., a country code, promo code, content rating code), this check silently misfires and all app data would render as error state. TypeScript won't catch this.

## Findings

- **`components/AppCard.tsx:84`** — `if ("code" in data) {`
- **`types/app-data.ts`** — no explicit discriminant field on `AppData` or `ApiError`

Flagged by: kieran-typescript-reviewer (P2), architecture-strategist (P2), pattern-recognition-specialist (P2).

## Proposed Solutions

### Option A: Named type guard function (Quick fix)
```ts
// types/app-data.ts
export function isApiError(value: AppData | ApiError): value is ApiError {
  return "error" in value && "code" in value;
}
```

Use in `AppCard.tsx`:
```ts
if (isApiError(data)) { ... }
```

### Option B: Tagged union discriminant (Recommended for longevity)
Add a `kind` field to both types:
```ts
export interface AppData {
  kind: "app";
  // ... existing fields
}

export interface ApiError {
  kind: "error";
  // ... existing fields
}
```

Update route handlers to include `kind: "app"` in success responses. Use `data.kind === "error"` in `AppCard.tsx`. TypeScript narrows correctly and the check is immune to future field additions.

**Recommended:** Option A for a quick fix now; Option B before the type is consumed by more than 2 components.

## Acceptance Criteria
- [ ] Discriminant check in `AppCard.tsx` is not based solely on `"code" in data`
- [ ] TypeScript correctly narrows `AppData | ApiError` in both branches
- [ ] If tagged union approach: API routes include the `kind` field in responses
- [ ] All existing tests pass

## Work Log
- 2026-02-21: Identified by 3 independent review agents in PR #1 review
