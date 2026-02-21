# App Vitals

A web app for fetching and analysing App Store and Google Play Store metadata — ratings, reviews, and competitive analysis.

## Stack

- **Frontend/Backend:** Next.js (React) with App Router
- **Styling:** TBD (decide when first UI is built)
- **Testing:** Jest + React Testing Library (frontend), API route tests as needed

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
├── docs/
│   ├── brainstorms/    # Output from /workflows:brainstorm
│   ├── solutions/      # Documented solved problems (/workflows:compound)
│   └── specs/          # Technical specifications
├── src/                # Next.js app source (created when scaffolded)
├── CLAUDE.md           # This file
├── AGENTS.md           # Agent-specific instructions
└── README.md
```

## Key Learnings

_Populated as we build. Run `/workflows:compound` after solving a tricky problem._
