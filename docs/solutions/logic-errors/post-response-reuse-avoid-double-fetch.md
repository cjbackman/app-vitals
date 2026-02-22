---
title: Use POST response body directly — avoid re-fetching after save
date: 2026-02-22
category: logic-errors
module: AppCard
tags: [fetch, react, nextjs, api, mutation, performance]
symptoms:
  - Two network requests fired after clicking Save
  - Unnecessary GET after POST
---

# Use POST response body directly — avoid re-fetching after save

## Problem

After a successful POST the client ignored the response body and issued a separate GET to reload the saved data. This doubles network round-trips for no benefit.

## Fix

The POST route already returns the fully-formed object at 201. Read it directly and update local state:

```ts
const res = await fetch("/api/snapshots", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
});
if (!res.ok) throw new Error("Save failed");
const snapshot = await res.json() as Snapshot;
setSnapshots((prev) => [...prev, snapshot].slice(-30));
```

No follow-up GET needed.

## Prevention

Design POST routes to return the created/updated resource. Clients should consume the response body rather than re-fetching. Only fetch separately when the POST response is intentionally minimal (e.g. `204 No Content`).
