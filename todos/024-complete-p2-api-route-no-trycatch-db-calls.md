---
status: pending
priority: p2
issue_id: "024"
tags: [code-review, reliability, error-handling]
dependencies: []
---

# P2: No try/catch around DB calls in snapshots API routes

## Problem Statement

`GET /api/snapshots` and `POST /api/snapshots` call `getSnapshots()` and `saveSnapshot()` without any try/catch. If `better-sqlite3` throws (e.g., DB file corrupted, disk full, schema migration needed), the exception propagates unhandled through Next.js and produces a 500 with a raw stack trace instead of a clean JSON error response.

## Findings

- **`app/api/snapshots/route.ts:31`** — `getSnapshots(store, appId)` uncaught
- **`app/api/snapshots/route.ts:64`** — `saveSnapshot(...)` uncaught
- Flagged by Kieran TypeScript Reviewer, Data Integrity Guardian, and Pattern Recognition Specialist

## Proposed Solutions

### Option A: Wrap each handler body in try/catch (Recommended)

```ts
// app/api/snapshots/route.ts
export async function GET(request: NextRequest) {
  // ... validation ...
  try {
    const snapshots = getSnapshots(store, appId);
    return NextResponse.json(snapshots);
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve snapshots", code: "SCRAPER_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // ... validation ...
  try {
    const snapshot = saveSnapshot(store, appId, score, reviewCount, minInstalls);
    return NextResponse.json(snapshot, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to save snapshot", code: "SCRAPER_ERROR" },
      { status: 500 }
    );
  }
}
```

### Option B: Wrap in a shared error boundary helper

Extract a `withDbErrorHandling` wrapper. Premature abstraction for two call sites.

**Recommended:** Option A — minimal, consistent with the rest of the codebase.

## Acceptance Criteria

- [ ] Both GET and POST handlers catch DB errors and return `{ error, code }` JSON at 500
- [ ] Test added for POST handler failure (when `saveSnapshot` throws)
- [ ] Test added for GET handler failure (when `getSnapshots` throws)

## Work Log

- 2026-02-22: Flagged by Kieran TypeScript Reviewer and Data Integrity Guardian in PR #3 review
