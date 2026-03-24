# Brainstorm: Migrate from cron-job.org to GitHub Actions

**Date:** 2026-03-24
**Status:** Ready for planning

## What We're Building

Replace cron-job.org with a GitHub Actions workflow as the scheduler for weekly app snapshots. The workflow calls the existing Vercel `/api/cron/snapshot` endpoint via `curl` — same architecture, different trigger.

## Why This Approach

- **Version-controlled schedule** — the cron config lives in the repo, not an external dashboard
- **Fewer moving parts** — eliminates a third-party dependency (cron-job.org)
- **Manual trigger** — `workflow_dispatch` replaces cron-job.org's "Execute now" button
- **Free** — GitHub Actions free tier handles a weekly job easily
- **Minimal change** — the endpoint, auth, and snapshot logic are untouched

## Key Decisions

1. **Trigger only, not runner** — GitHub Actions sends `curl` to Vercel; it does NOT run the snapshot logic directly. Vercel remains the execution environment.
2. **Same schedule** — Monday 06:00 UTC (`cron: '0 6 * * 1'`).
3. **Dual triggers** — `schedule` (weekly) + `workflow_dispatch` (manual).
4. **Secret management** — `CRON_SECRET` stored as a GitHub Actions repository secret.
5. **Lightweight workflow** — no checkout, no Node.js setup. Just `curl` on an `ubuntu-latest` runner.
6. **Failure detection** — workflow fails if the endpoint returns non-2xx or reports snapshot errors in the JSON response.

## What Changes

| Item | Action |
|------|--------|
| `.github/workflows/snapshot.yml` | Create new workflow file |
| GitHub repo settings | Add `CRON_SECRET` as a repository secret |
| cron-job.org | Remove the scheduled job (manual step) |
| `README.md` | Update to reference GitHub Actions instead of cron-job.org |

## Open Questions

None — scope is well-defined.
