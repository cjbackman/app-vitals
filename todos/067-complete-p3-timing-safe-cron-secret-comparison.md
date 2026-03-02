---
status: complete
priority: p3
issue_id: "067"
tags: [code-review, security]
dependencies: []
---

# Timing-Safe CRON_SECRET Comparison

## Problem Statement

`app/api/cron/snapshot/route.ts` compares the `Authorization` header against `CRON_SECRET` using `===` (JavaScript string equality). String equality short-circuits on the first mismatched character — an attacker can time requests to infer the secret one character at a time (timing attack). This is a low-severity issue in practice (requires many precisely timed requests), but is trivially fixed with `crypto.timingSafeEqual`.

## Findings

- `app/api/cron/snapshot/route.ts` — `if (authHeader !== \`Bearer ${process.env.CRON_SECRET}\`)` (string equality)
- `===` short-circuits; characters before the first mismatch are processed, rest are skipped
- Timing difference is small (~nanoseconds) but statistical attacks are feasible with enough samples
- Security sentinel flagged as hardening recommendation
- Standard fix: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`

## Proposed Solutions

### Option 1: Replace `===` with `crypto.timingSafeEqual`

**Approach:**
```typescript
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// In route handler:
const secret = process.env.CRON_SECRET ?? "";
const provided = authHeader?.replace("Bearer ", "") ?? "";
if (!safeCompare(provided, secret)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Note: length comparison must also be constant-time. The `a.length !== b.length` check above leaks length — use `timingSafeEqual` with padded buffers if length must also be hidden (not necessary for most secrets).

**Pros:** Eliminates timing oracle; standard hardening practice
**Cons:** Marginal complexity increase; Node `crypto` import needed
**Effort:** 15 minutes
**Risk:** None

---

### Option 2: Accept current risk

**Approach:** Leave the `===` comparison. Timing attacks require many controlled requests from the same network path — Vercel cron jobs are invoked by Vercel's own infrastructure, not by arbitrary external clients.

**Pros:** No code change
**Cons:** Technically vulnerable; not idiomatic for secret comparison
**Effort:** 0
**Risk:** Very low in practice

---

## Recommended Action

Option 1 — it is a one-line change and eliminates the class of vulnerability entirely. Low effort, good practice.

## Technical Details

**Affected files:**
- `app/api/cron/snapshot/route.ts` — Authorization check

## Acceptance Criteria

- [ ] `Authorization` header compared with `crypto.timingSafeEqual`
- [ ] No early-exit on length mismatch (or length comparison is also constant-time)
- [ ] Existing cron tests still pass

## Work Log

### 2026-03-01 - Discovery

**By:** Security sentinel
