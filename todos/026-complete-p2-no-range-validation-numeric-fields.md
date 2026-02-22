---
status: pending
priority: p2
issue_id: "026"
tags: [code-review, security, data-integrity, input-validation]
dependencies: []
---

# P2: No range/finite validation on numeric fields in POST /api/snapshots

## Problem Statement

`typeof value === "number"` is `true` for `NaN`, `Infinity`, and `-Infinity`. The POST handler validates type but not range. A caller can submit `score: -999` or `reviewCount: Infinity` — both pass validation and reach the DB. `Infinity` serializes to `null` via `JSON.stringify`, causing silent data corruption. `NaN` becomes SQL NULL. Both produce visually wrong sparklines with no error.

## Findings

- **`app/api/snapshots/route.ts:52-57`** — only `typeof` check, no `isFinite` or bounds check
- Flagged by Security Sentinel (M1) and Agent-Native Reviewer

## Proposed Solutions

### Option A: Add isFinite + range bounds (Recommended)

```ts
// app/api/snapshots/route.ts — replace the current validation block
if (
  !isValidStore(b.store) ||
  !isValidAppId(b.appId) ||
  typeof b.score !== "number" || !Number.isFinite(b.score) || b.score < 0 || b.score > 5 ||
  typeof b.reviewCount !== "number" || !Number.isFinite(b.reviewCount) || b.reviewCount < 0 ||
  (b.minInstalls !== undefined && (
    typeof b.minInstalls !== "number" || !Number.isFinite(b.minInstalls) || b.minInstalls < 0
  ))
) {
  return NextResponse.json(
    { error: "Missing or invalid required fields: store, appId, score (0-5), reviewCount (≥0)", code: "INVALID_APP_ID" },
    { status: 400 }
  );
}
```

### Option B: Zod schema validation

Use `zod` to parse the body. Adds a dependency; overkill for one endpoint.

**Recommended:** Option A — explicit guards, no new dependencies.

## Acceptance Criteria

- [ ] `score` is validated as finite and within `[0, 5]`
- [ ] `reviewCount` is validated as finite and `>= 0`
- [ ] `minInstalls` (when present) is validated as finite and `>= 0`
- [ ] Tests added for invalid values: `NaN`, `Infinity`, `-1` score
- [ ] Valid boundary values (`score: 0`, `score: 5`) still accepted

## Work Log

- 2026-02-22: Flagged by Security Sentinel (M1) in PR #3 review
