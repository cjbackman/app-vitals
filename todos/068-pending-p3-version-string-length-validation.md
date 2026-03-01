---
status: pending
priority: p3
issue_id: "068"
tags: [code-review, security, quality]
dependencies: []
---

# Validate `version` String Length Before Saving to DB

## Problem Statement

`lib/snapshots.ts:saveSnapshot` writes the `version` field directly to the database with no length validation. An unusually long string (either from a malformed scraper response or a future Android `"Varies with device"` variant) would be stored as-is. SQLite TEXT columns have no implicit length limit, so there is no DB-side guard either. This could waste storage and cause display issues.

## Findings

- `lib/snapshots.ts` — `version` accepted as `string | undefined` from caller, stored as-is
- `app/api/cron/snapshot/route.ts` — passes raw `data.version` from scraper response without sanitization
- Android `"Varies with device"` (a known malformed value) is handled by todo #057 — but other long strings are possible
- TypeScript reviewer flagged: "unvalidated version string length"
- Typical App Store / Play Store version strings are 1–20 characters (e.g., `"2.1.0"`, `"10.3.1 (Build 5421)"`)

## Proposed Solutions

### Option 1: Truncate at save boundary

**Approach:**
```typescript
// lib/snapshots.ts
const MAX_VERSION_LEN = 50;

function normalizeVersion(v: string | undefined | null): string | null {
  if (!v || v === "Varies with device") return null;
  return v.slice(0, MAX_VERSION_LEN);
}
```

Apply in `saveSnapshot` before inserting. This guards against arbitrarily long strings without hard-rejecting valid short ones.

**Pros:** Defensive; no DB schema change needed; version display is rarely longer than 50 chars
**Cons:** Silently truncates; caller doesn't know the version was abnormal
**Effort:** 10 minutes
**Risk:** None

---

### Option 2: Log a warning on unexpectedly long versions

**Approach:** Same truncation but also `console.warn("version string truncated", { appId, version })` so that future monitoring can catch malformed scraper responses.

**Pros:** Truncation + visibility
**Cons:** Minimal extra noise in production logs
**Effort:** 10 minutes
**Risk:** None

---

### Option 3: Accept current state (YAGNI)

**Approach:** Once todo #057 normalizes `"Varies with device"` to null, the most common malformed value is handled. Real version strings from both stores are consistently short.

**Pros:** No code change
**Cons:** No guard against future long strings
**Effort:** 0
**Risk:** Very low

---

## Recommended Action

Option 3 for now — after todo #057 is resolved, the risk is minimal. Add length validation if a malformed version is observed in production logs.

## Technical Details

**Affected files:**
- `lib/snapshots.ts` — `saveSnapshot` function
- `app/api/cron/snapshot/route.ts` — optional validation at call site

## Acceptance Criteria

- [ ] `version` string truncated (or rejected) if longer than N characters before DB insert
- [ ] `"Varies with device"` normalised to `null` (todo #057 dependency)
- [ ] Tests cover boundary cases

## Work Log

### 2026-03-01 - Discovery

**By:** TypeScript reviewer
