---
status: pending
priority: p1
issue_id: "057"
tags: [code-review, data-integrity, quality]
dependencies: []
---

# `saveSnapshot` Stores "Varies with device" — Poisons `isRelease` Logic

## Problem Statement

`saveSnapshot` requires `version: string` (non-optional). Android apps with device-dependent APKs return `"Varies with device"` from the scraper. If the version changes from `"Varies with device"` to a real version string (or vice versa), `isRelease` would incorrectly fire as `true` — a false release event. The `isRelease` null guards correctly handle `null`, but they do not handle the sentinel string.

## Findings

- `lib/snapshots.ts:11` — `version: string` is required in `saveSnapshot` opts
- `app/api/cron/snapshot/route.ts:28` — `version: data.version` passed directly, no normalization
- `types/app-data.ts` — `AppData.version` is typed as `string`; scrapers return `"Varies with device"` for Android multi-APK apps
- `isRelease` guards in `getSnapshots`: both-null guard prevents false positives at migration boundary, but does not handle the sentinel string — `"Varies with device" !== "2.0"` would trigger `isRelease: true`
- The `isRelease` test for "Varies with device" in `__tests__/lib/snapshots.test.ts` only tests equal strings (both `"Varies with device"`) — does not test the transition case from real version to sentinel

## Proposed Solutions

### Option 1: Normalize `"Varies with device"` to `null` in the cron route

**Approach:**
```typescript
// app/api/cron/snapshot/route.ts
version: data.version === "Varies with device" ? null : data.version,
```
Also make `version` optional in the `saveSnapshot` opts type:
```typescript
opts: { score: number; reviewCount: number; version: string | null; minInstalls?: number }
```

**Pros:** Cleanest fix; `isRelease` null guards already handle `null` correctly; minimal surface change
**Cons:** Requires updating `saveSnapshot` signature to accept `null`
**Effort:** 20 minutes
**Risk:** Low

---

### Option 2: Normalize inside `saveSnapshot`

**Approach:** Accept `string` but internally normalize before storing:
```typescript
const version = opts.version === "Varies with device" ? null : opts.version;
```

**Pros:** Centralizes normalization; callers don't need to know about the sentinel
**Cons:** Hides domain logic inside the lib; harder to test in isolation
**Effort:** 15 minutes
**Risk:** Low

---

## Recommended Action

Option 1 — keep `saveSnapshot` simple, normalize at the boundary where the external data enters (cron route). Add test for the transition case.

## Technical Details

**Affected files:**
- `app/api/cron/snapshot/route.ts:28`
- `lib/snapshots.ts:8–13` (opts type)
- `__tests__/lib/snapshots.test.ts` — add transition test case
- `__tests__/api/cron/snapshot.test.ts` — update for new signature

## Acceptance Criteria

- [ ] `"Varies with device"` stored as `null` in the DB
- [ ] `isRelease` does not fire when version transitions between `"Varies with device"` and a real version string
- [ ] Test added: snapshot pair where one has `"Varies with device"` and next has a real version → `isRelease: false`
- [ ] All existing tests pass

## Work Log

### 2026-03-01 - Discovery

**By:** TypeScript reviewer, Data integrity reviewer

**Findings:**
- `"Varies with device"` sentinel can cause false `isRelease` on version transitions
- Null guards don't cover this case
- Existing test only covers equal-string case (both `"Varies with device"`)
