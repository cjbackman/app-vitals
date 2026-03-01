# App Vitals

Fetch and analyse App Store and Google Play Store metadata. Compare ratings, reviews, and key metrics against competitor apps. Tracks weekly snapshots automatically.

## Getting Started

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The local dev database (`file:./data/snapshots.db`) is created automatically on first request — no Turso account needed locally.

## Features

- Search any app by ID across App Store and Google Play
- Competitor comparison table (preset apps: Babbel, Duolingo)
- Weekly automated snapshots via cron job
- Snapshot history sparklines with brand colours

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Turso (libSQL) — local SQLite in dev, remote in production
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | `file:./data/snapshots.db` for local, `libsql://…` for production |
| `TURSO_AUTH_TOKEN` | Required for remote Turso databases |
| `CRON_SECRET` | Bearer token for `POST /api/cron/snapshot` — generate with `openssl rand -hex 32` |
