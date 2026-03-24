---
title: "feat: Migrate cron scheduling from cron-job.org to GitHub Actions"
type: feat
date: 2026-03-24
---

# feat: Migrate cron scheduling from cron-job.org to GitHub Actions

## Overview

Replace cron-job.org with a GitHub Actions workflow that `curl`s the existing Vercel `/api/cron/snapshot` endpoint on a weekly schedule. No application code changes — just a new workflow file, a README update, and GitHub secret configuration.

## Motivation

- Version-control the schedule (currently configured in an external dashboard)
- Eliminate a third-party dependency
- `workflow_dispatch` replaces cron-job.org's "Execute now" button

## Proposed Solution

A single workflow file `.github/workflows/snapshot.yml` with two triggers (`schedule` + `workflow_dispatch`). The workflow runs `curl` against the deployed endpoint, parses the JSON response, and fails if any snapshots failed.

## Acceptance Criteria

- [x] `.github/workflows/snapshot.yml` exists and is valid
- [x] Workflow fires on `schedule` (Monday 06:00 UTC) and `workflow_dispatch`
- [x] Workflow authenticates with `CRON_SECRET` from GitHub secrets
- [x] Workflow hits the production URL from `DEPLOY_URL` GitHub secret
- [x] Workflow fails on non-2xx HTTP status
- [x] Workflow fails if response JSON has `failed > 0`
- [x] Workflow logs the full JSON response body
- [x] Curl uses `--max-time 90` (60s Vercel maxDuration + 30s buffer)
- [x] Workflow uses `permissions: {}` (no repo access needed)
- [x] `README.md` updated to mention GitHub Actions as the scheduler
- [ ] Manual `workflow_dispatch` test succeeds end-to-end

## Implementation

### Step 1: Create `.github/workflows/snapshot.yml`

```yaml
name: Weekly Snapshot

on:
  schedule:
    - cron: "0 6 * * 1"  # Monday 06:00 UTC
  workflow_dispatch:

permissions: {}

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger snapshot
        env:
          DEPLOY_URL: ${{ secrets.DEPLOY_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
        run: |
          RESPONSE=$(curl --silent --max-time 90 --write-out "\n%{http_code}" \
            -X POST "${DEPLOY_URL}/api/cron/snapshot" \
            -H "Authorization: Bearer ${CRON_SECRET}")

          HTTP_CODE=$(echo "$RESPONSE" | tail -1)
          BODY=$(echo "$RESPONSE" | sed '$d')

          echo "HTTP status: $HTTP_CODE"
          echo "Response: $BODY"

          if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
            echo "::error::Endpoint returned HTTP $HTTP_CODE"
            exit 1
          fi

          FAILED=$(echo "$BODY" | jq -r '.failed // 0')
          if [ "$FAILED" -gt 0 ]; then
            echo "::error::$FAILED snapshot(s) failed"
            echo "$BODY" | jq -r '.errors[]' 2>/dev/null
            exit 1
          fi

          echo "All snapshots saved successfully."
```

### Step 2: Add GitHub repository secrets

| Secret | Value | Source |
|--------|-------|--------|
| `CRON_SECRET` | Same value as in Vercel env vars | `openssl rand -hex 32` |
| `DEPLOY_URL` | Production Vercel URL (e.g. `https://app-vitals.vercel.app`) | Vercel dashboard |

### Step 3: Update `README.md`

Update the "Weekly automated snapshots via cron job" line and the environment variables table to reference GitHub Actions.

### Step 4: Test with `workflow_dispatch`

Trigger manually from the Actions tab before the first scheduled Monday to verify end-to-end.

### Step 5: Decommission cron-job.org

Disable the cron-job.org scheduled job **after** confirming the GitHub Actions workflow succeeds. Do this before the next Monday to avoid duplicate snapshots.

## Dependencies & Risks

- **Risk:** `CRON_SECRET` mismatch between GitHub and Vercel → silent 401. **Mitigation:** test with `workflow_dispatch` first.
- **Risk:** Duplicate snapshots if both schedulers fire in the same week. **Mitigation:** decommission cron-job.org before the next Monday.
- **Risk:** GitHub Actions schedule can be delayed up to 15 minutes during high load. **Mitigation:** acceptable for a weekly job.

## References

- Brainstorm: `docs/brainstorms/2026-03-24-github-actions-cron-migration-brainstorm.md`
- Cron endpoint: `app/api/cron/snapshot/route.ts`
- Cron tests: `__tests__/api/cron/snapshot.test.ts`
- Original deployment plan: `docs/plans/2026-02-28-feat-vercel-turso-cron-deployment-plan.md`
