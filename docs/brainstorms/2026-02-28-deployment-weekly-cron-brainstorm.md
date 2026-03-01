---
date: 2026-02-28
topic: deployment-weekly-cron
---

# Deployment + Weekly Cron Sync

## What We're Building

Deploy app-vitals to production with a weekly automated snapshot sync of all
preset apps (leading app + competitors), for both App Store and Google Play.
The stack should be free, require no credit card, and stay as simple as possible.

## Why This Approach

**Vercel + Turso + cron-job.org**

Three free services, each doing one thing:

- **Vercel** — hosts the Next.js app. Zero-config, free Hobby tier, no credit card.
- **Turso** — hosted SQLite (libSQL). Free tier is generous (9GB, 1B rows read/month).
  Schema and queries stay identical to the current better-sqlite3 setup; only
  `lib/db.ts` needs to swap the client.
- **cron-job.org** — free external cron. Hits `/api/cron/snapshot?secret=xxx`
  once a week (Monday 09:00 UTC or similar). No platform lock-in, easy to
  trigger manually for testing.

Alternatives considered:
- **Fly.io + SQLite on disk** — zero code changes to storage, but requires a
  credit card (even for free allowance). Ruled out.
- **Render + Turso** — free, no card, but cold starts on cron ping (~30s).
  Acceptable for weekly jobs, but Vercel is faster and better DX for Next.js.

## Key Decisions

- **Storage client:** Replace `better-sqlite3` with `@libsql/client` (Turso's
  JS client). SQL queries and schema are unchanged; only the connection setup
  in `lib/db.ts` changes.
- **Cron endpoint:** `GET /api/cron/snapshot` protected by a shared secret
  (`CRON_SECRET` env var). Returns a JSON summary of how many snapshots were
  saved and any per-app errors.
- **Sync scope:** All preset apps defined in `components/PresetApps.tsx` — both
  iOS and Android IDs for each preset. The cron iterates over them, fetches
  current metadata, and calls `saveSnapshot()` for each.
- **Error handling:** Per-app failures are logged and included in the response
  but don't abort the whole run (same `Promise.allSettled` pattern used in
  CompetitorTable).
- **Vercel cron vs external:** Vercel Cron (via `vercel.json`) requires a Pro
  plan for sub-daily schedules; weekly works on Hobby but ties us to Vercel's
  scheduler. cron-job.org is platform-agnostic and easier to test manually.
  External trigger chosen.

## Open Questions

- Should the cron endpoint also accept a `POST` for manual triggers from the
  UI? (Nice-to-have, not blocking.)
- Do we need a `CRON_SECRET` rotation strategy, or is a static secret in env
  vars sufficient for now? (Static is fine at this scale.)
- Turso free tier uses a remote DB; latency for reads is higher than local
  SQLite. Will this be noticeable in the UI? (Probably not — snapshot reads
  are infrequent and the data is small.)

## Next Steps

→ `/workflows:plan` to design the implementation:
1. Migrate `lib/db.ts` from better-sqlite3 to @libsql/client
2. Add `/api/cron/snapshot` route
3. Deploy to Vercel + provision Turso DB
4. Configure cron-job.org
