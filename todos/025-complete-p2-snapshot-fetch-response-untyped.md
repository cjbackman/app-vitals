---
status: pending
priority: p2
issue_id: "025"
tags: [code-review, type-safety, correctness]
dependencies: []
---

# P2: Snapshot fetch response is untyped before calling `setSnapshots`

## Problem Statement

`r.json()` returns `Promise<unknown>`. In two places in `AppCard`, the result flows directly into `setSnapshots(d)` with no type assertion or runtime guard. If the API returns an error object instead of an array (e.g., on a 500), `setSnapshots` receives a non-array and `SnapshotHistory` will crash when mapping over it.

## Findings

- **`components/AppCard.tsx:94-96`** — history fetch: `r.json().then((d) => setSnapshots(d))`
- **`components/AppCard.tsx:124-125`** — post-save re-fetch: `res.json()` assigned to `updated`, passed to `setSnapshots(updated)` with no guard
- Flagged by Kieran TypeScript Reviewer and Security Sentinel

## Proposed Solutions

### Option A: Type assertion + Array.isArray guard (Recommended)

```ts
// History fetch (AppCard.tsx ~line 94)
.then((r) => r.ok ? r.json() as Promise<Snapshot[]> : Promise.reject(r))
.then((d) => Array.isArray(d) ? setSnapshots(d) : setSnapshots([]))
.catch(() => {});

// Post-save path — after fix from todo-023, only one call remains:
const saved: Snapshot = await res.json() as Snapshot;
setSnapshots((prev) => [...prev, saved].slice(-30));
```

### Option B: Type assertion only (minimal change)

```ts
.then((r) => r.json() as Promise<Snapshot[]>)
.then((d) => setSnapshots(d))
```

Silences TypeScript but still doesn't guard against non-array responses at runtime.

**Recommended:** Option A — adds a runtime guard for the history fetch path. The POST path is addressed by fixing todo-023 first.

## Acceptance Criteria

- [ ] History fetch checks `r.ok` before consuming body
- [ ] Result is guarded with `Array.isArray` before calling `setSnapshots`
- [ ] Type assertion `as Snapshot[]` present at the fetch boundary
- [ ] No runtime crash when API returns an error object instead of array

## Work Log

- 2026-02-22: Flagged by Kieran TypeScript Reviewer and Security Sentinel in PR #3 review
