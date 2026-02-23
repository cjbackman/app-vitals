---
status: pending
priority: p2
issue_id: "037"
tags: [code-review, security, performance, pr-4]
dependencies: []
---

# P2: No request body size limit before parsing JSON

## Problem Statement

`POST /api/snapshots/bulk` calls `await request.json()` unconditionally. Node buffers the entire body into memory before the row-count check runs. A request with `{"rows": [<100MB of JSON>]}` will be fully buffered and parsed before the `b.rows.length > MAX_ROWS` guard fires. For a local single-user tool this is not an active attack surface, but it is inconsistent with the defensive validation posture the rest of the route clearly intends.

The expected body size for a max-valid import (1000 rows, all fields) is approximately 150–200KB. A reasonable guard is 1MB (5× headroom).

## Findings

- **`app/api/snapshots/bulk/route.ts:26`** — `body = await request.json()` with no prior size check
- Performance agent flagged this as P2 for a local tool

## Proposed Solutions

### Option A: Content-Length header check — Recommended

```typescript
// app/api/snapshots/bulk/route.ts, before request.json()
const contentLength = request.headers.get("content-length");
if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
  return NextResponse.json(
    { error: "Request body too large (max 1 MB)", code: "INVALID_SNAPSHOT_PARAMS" },
    { status: 413 }
  );
}
```

**Pros:** Simple, consistent with existing validation style, zero dependencies
**Cons:** `Content-Length` can be absent (chunked encoding) or spoofed — best-effort only
**Effort:** Small
**Risk:** Low

### Option B: Skip — acceptable for local tool

Document the known gap and move on. The row count guard is the effective practical limit.

**Pros:** Zero change
**Cons:** Unbounded memory allocation possible in theory
**Effort:** None
**Risk:** Acceptable for single-user local tool

## Recommended Action

_[To be filled during triage]_

## Technical Details

- **Affected files:** `app/api/snapshots/bulk/route.ts` line 26
- **Test:** Optional — add a test that a request with `Content-Length: 2000000` gets a 413

## Acceptance Criteria

- [ ] A request with Content-Length > 1MB is rejected with 413 before body is parsed
- [ ] Valid imports (< 1MB) still work

## Work Log

- 2026-02-23: Created from PR #4 code review — performance oracle (P2)

## Resources

- PR: https://github.com/cjbackman/app-vitals/pull/4
