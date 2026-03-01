# App Vitals

A web app for fetching and analysing App Store and Google Play Store metadata — ratings, reviews, and competitive analysis.

## Stack

- **Frontend/Backend:** Next.js (React) with App Router
- **Database:** Turso (libSQL) via `@libsql/client` — `file:` URL locally, `libsql://` in production
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library

## Philosophy: Compounding Engineering

Each unit of work should make the next easier. Follow the workflow:

1. **Brainstorm** (`/workflows:brainstorm`) — explore WHAT to build
2. **Plan** (`/workflows:plan`) — design HOW to build it
3. **Work** (`/workflows:work`) — implement from the plan
4. **Review** (`/workflows:review`) — verify quality
5. **Compound** (`/workflows:compound`) — document learnings in `docs/solutions/`

## Working Agreement

- **Commits:** Never commit without explicit user approval. Always show the diff and ask first.
- **Branches:** Create a feature branch for non-trivial changes. Stay on the current branch unless directed otherwise.
- **Tests:** Write tests alongside features — not after. Test-first when building new behaviour.
- **Scope:** YAGNI. Build only what is needed now. No speculative abstractions.
- **Safety:** Do not delete files or run destructive commands without confirmation.
- **Over-engineering:** Avoid. Three similar lines beat a premature abstraction. No helper utilities for one-off operations.

## Directory Structure

```
app-vitals/
├── __tests__/          # Jest tests (mirrors app/components/lib structure)
├── app/                # Next.js App Router (pages + API routes)
├── components/         # React UI components
├── lib/                # Server-only business logic + DB access
├── types/              # Shared TypeScript types
├── docs/
│   ├── brainstorms/    # Output from /workflows:brainstorm
│   ├── plans/          # Output from /workflows:plan
│   └── solutions/      # Documented solved problems (/workflows:compound)
├── CLAUDE.md           # This file
├── AGENTS.md           # Agent-specific instructions
└── README.md
```

## Key Learnings

_Populated as we build. Run `/workflows:compound` after solving a tricky problem._
