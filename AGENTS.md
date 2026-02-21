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

### Current Phase

MVP — fetching and displaying basic app metadata. No analytics, no auth, no DB yet.

### Patterns to Follow

- Next.js App Router conventions (`app/` directory, server components by default)
- API routes in `app/api/` for data fetching from store APIs
- Co-locate tests with source files (`*.test.ts` / `*.test.tsx`)
- Keep components small and single-purpose

## When Researching

- Check `docs/solutions/` for documented past solutions before implementing
- Check `docs/brainstorms/` for prior design decisions on a feature
- Check `docs/specs/` for technical specifications

## Common Commands

```bash
npm run dev       # Start dev server
npm run test      # Run test suite
npm run build     # Production build
npm run lint      # Lint check
```

_(Update these as the project is scaffolded)_
