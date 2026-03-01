# Agent Instructions

This repository contains **App Vitals** — a Next.js web app that fetches and analyses App Store and Google Play Store metadata.

## Working Agreement

- **Branching:** Feature branch for any non-trivial change. Reuse the current branch if already on the right one.
- **Safety:** Never delete files or overwrite uncommitted changes without asking.
- **Testing:** Tests are written alongside features. Run the test suite after any logic change.
- **Commits:** Do not commit without explicit user instruction.
- **Scope:** Follow YAGNI. Only build what is asked for now.

## Project Context

### Domain

- **App Store data:** Ratings, review counts, version history, developer info (Apple App Store)
- **Google Play data:** Same categories from Google Play Store
- **Competitive analysis:** Compare an app's metrics against selected competitor apps
- **Snapshot history:** Weekly automated snapshots saved to Turso (libSQL)

### Current State

MVP shipped. Core features working: app search, competitor table, weekly cron snapshots, sparkline history charts.

### Patterns to Follow

- Next.js App Router conventions (`app/` directory, server components by default)
- API routes in `app/api/` for data fetching — lib functions for business logic
- Tests in `__tests__/` mirroring the source structure (`api/`, `components/`, `lib/`)
- `export const runtime = "nodejs"` on all routes that use Node.js-only packages
- DB access via `lib/db.ts` (`getDb()`) — async `@libsql/client` API, never `better-sqlite3`
- Preset app config lives in `lib/preset-apps.ts` (not `components/`)

## When Researching

- Check `docs/solutions/` for documented past solutions before implementing
- Check `docs/brainstorms/` for prior design decisions on a feature
- Check `docs/plans/` for implementation plans

## Common Commands

```bash
npm run dev     # Start dev server (requires .env.local — copy from .env.example)
npm test        # Run test suite
npm run build   # Production build
npm run lint    # Lint check
```
