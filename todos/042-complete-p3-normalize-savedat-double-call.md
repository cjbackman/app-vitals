---
status: pending
priority: p3
issue_id: "042"
tags: [code-review, cleanup, correctness, pr-4]
dependencies: []
---

# P3: `normalizeSavedAt` called twice per row with non-null assertion hiding risk

## Problem Statement

In `POST /api/snapshots/bulk`, `normalizeSavedAt` is called once during validation (to check for `null`) and a second time during insertion — where the result is assumed non-null via `!`. The function is currently pure and deterministic so both calls return the same value. However, the `!` assertion permanently disables TypeScript's null-safety check on line 135. If `normalizeSavedAt` is ever changed to return `null` in a new edge case that the validation loop wasn't updated to cover, the `!` forces `null` into `stmt.run()`, causing a SQLite `NOT NULL` constraint error that surfaces as a generic 500 response.

## Findings

- **`app/api/snapshots/bulk/route.ts:86`** — `normalizeSavedAt(r.savedAt) === null` in validation loop (result discarded)
- **`app/api/snapshots/bulk/route.ts:135`** — `normalizeSavedAt(row.savedAt as string)!` in insert loop (non-null assertion)
- Performance agent, data integrity agent, simplicity agent all flagged this

## Proposed Solutions

### Option A: Collect pre-validated rows during validation pass — Recommended

```typescript
// Replace the raw `rows` loop with a typed validated array
type ValidatedRow = {
  store: string;
  appId: string;
  savedAt: string;  // already normalized ISO string
  score: number;
  reviewCount: number;
  minInstalls: number | null;
};

const validatedRows: ValidatedRow[] = [];
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  // ... existing object/null check ...
  const r = row as Record<string, unknown>;
  // ... existing store/appId/score/reviewCount/minInstalls checks ...

  const savedAt = normalizeSavedAt(r.savedAt as string);
  if (savedAt === null) {
    return NextResponse.json(
      { error: `row ${i + 1}: invalid savedAt`, code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }
  validatedRows.push({
    store: r.store as string,
    appId: r.appId as string,
    savedAt,
    score: r.score as number,
    reviewCount: r.reviewCount as number,
    minInstalls: (r.minInstalls as number | undefined) ?? null,
  });
}

// Insert loop uses validatedRows directly — no second normalizeSavedAt, no !
for (const row of validatedRows) {
  const result = stmt.run(row.store, row.appId, row.savedAt, row.score, row.reviewCount, row.minInstalls);
  result.changes === 1 ? inserted++ : skipped++;
}
```

**Pros:** Eliminates double call, removes `!` assertion, type-safe, clearer data flow
**Cons:** Adds a local type; ~10 lines of rearrangement
**Effort:** Small
**Risk:** Low — same logic, better typed

### Option B: Keep double-call, add a comment

Add a comment explaining both calls are intentional and the function is pure:

```typescript
// Already validated above — normalizeSavedAt is pure; non-null assertion is safe.
const savedAt = normalizeSavedAt(row.savedAt as string)!;
```

**Pros:** Zero structural change
**Cons:** `!` still present; comment may become stale
**Effort:** Minimal
**Risk:** Low today, fragile long-term

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `app/api/snapshots/bulk/route.ts` lines 86 and 135
- **Tests:** No test changes needed — tests already cover correct normalization

## Acceptance Criteria

- [ ] `normalizeSavedAt` called at most once per row in the insert path
- [ ] No non-null assertion (`!`) on `normalizeSavedAt` result in the insert loop
- [ ] All 23 route tests still pass

## Work Log

- 2026-02-23: Created from PR #4 code review — performance oracle + data integrity guardian + simplicity reviewer

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
