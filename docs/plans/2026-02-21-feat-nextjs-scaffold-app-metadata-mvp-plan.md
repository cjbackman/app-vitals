---
title: "feat: Next.js Scaffold + App Metadata MVP"
type: feat
date: 2026-02-21
brainstorm: docs/brainstorms/2026-02-21-app-vitals-initial-brainstorm.md
reviewed_by: [dhh-rails-reviewer, kieran-typescript-reviewer, code-simplicity-reviewer]
---

# feat: Next.js Scaffold + App Metadata MVP

## Overview

Scaffold the Next.js app and implement Phase 1: fetch and display basic metadata for an app from both the Apple App Store and Google Play Store. A user enters an App Store bundle ID and a Google Play package name, and the app fetches and displays side-by-side metadata (name, rating, review count, version, developer, icon, price).

---

## Proposed Solution

A Next.js 14+ App Router app with:

- Two API routes (one per store) that call scraper packages server-side
- A single-page UI with a form for entering app IDs and a results display
- Plain `useState` + `fetch` + `Promise.allSettled` for client-side data fetching (no SWR)
- `unstable_cache` to cache scraper responses (1 hour TTL) to avoid rate limiting

No database, no auth, no accounts for this phase.

---

## Technical Considerations

### Scraper Packages

| Package | Store | Notes |
|---|---|---|
| `app-store-scraper` | Apple App Store | No built-in TS types — must write own `.d.ts` |
| `google-play-scraper` | Google Play | Has `@types/google-play-scraper` on DefinitelyTyped |

Both are **Node.js only** — they cannot run in browser or Edge Runtime. Must be used in API routes only (not client components).

### Key Field Mappings

| Display field | iOS (`app-store-scraper`) | Android (`google-play-scraper`) |
|---|---|---|
| Name | `title` | `title` |
| Rating | `score` | `score` |
| Review count | `reviews` (written reviews) | `ratings` (total ratings — different from `reviews`) |
| Version | `version` (reliable) | `version` (often "Varies with device") |
| Developer | `developer` | `developer` |
| Icon | `icon` | `icon` |
| Price | `price` (number) | `price` (number) |
| Last updated | `updated` (ISO string) | `updated` (Unix ms timestamp — must convert) |

> **Android note:** `ratings` is total rating count; `reviews` is written reviews count. The plan uses `ratings` for the "review count" display field to match iOS's `reviews` scale.

### App ID Formats

- **App Store:** bundle ID (`com.netflix.Netflix`) or numeric ID (`553834731`). Use bundle ID.
- **Google Play:** package name only (`com.netflix.mediaclient`).
- **Important:** iOS and Android IDs for the same app are often different (e.g., Netflix above).
- **Validation:** Both IDs must match `/^[a-zA-Z0-9._-]+$/` — validate in the API route before hitting the scraper.

### Caching Strategy

Export two functions per store: an uncached function (for testing) and a cached wrapper:

```ts
// lib/ios-store.ts
export async function fetchIosApp(appId: string, country = 'us'): Promise<AppData> {
  // pure scraper call + mapping — no cache
}

export const getIosApp = unstable_cache(fetchIosApp, ['ios-app'], { revalidate: 3600 });
```

Cache key = `[store, appId, country]`. 1-hour TTL. Tests call `fetchIosApp` directly (no Next.js infrastructure needed).

### Rate Limiting & Reliability Risks

- Scrapers may break if Apple/Google redesign their store pages (no official API).
- Cloud IP addresses (Vercel, AWS) may get blocked faster than residential IPs.
- Mitigation for MVP: cache aggressively, return graceful error states per card in UI.

### Server / Client Component Boundaries

| File | Type | Reason |
|---|---|---|
| `app/page.tsx` | Server Component | No interactivity; composes client components |
| `components/AppSearch.tsx` | **Client Component** (`'use client'`) | Has form state |
| `components/AppCard.tsx` | Server Component | Pure props, no state |
| `app/api/ios/route.ts` | Server (Route Handler) | Calls scraper via lib |
| `app/api/android/route.ts` | Server (Route Handler) | Calls scraper via lib |
| `lib/ios-store.ts` | Server only (`import 'server-only'`) | Calls scraper |
| `lib/android-store.ts` | Server only (`import 'server-only'`) | Calls scraper |

`page.tsx` handles search state and fetch logic. Since it's a Server Component, the stateful parts (form inputs, fetch on submit) are extracted into a `'use client'` wrapper within the page or into `AppSearch.tsx`.

> **Pattern:** `page.tsx` renders `<AppSearch onSearch={...} />`. Because `onSearch` is a callback, the fetch logic and results state live in a client boundary. The simplest approach: make a thin `'use client'` `SearchPage` component that owns state, rendered from the Server Component `page.tsx`.

---

## File Structure

```
app-vitals/
├── app/
│   ├── api/
│   │   ├── ios/
│   │   │   └── route.ts          # GET /api/ios?appId=com.example.App
│   │   └── android/
│   │       └── route.ts          # GET /api/android?appId=com.example.app
│   ├── page.tsx                  # Server Component — renders <SearchPage />
│   ├── layout.tsx
│   └── globals.css
├── components/                   # All UI components at project root (not inside app/)
│   ├── SearchPage.tsx            # 'use client' — owns search state + fetch logic
│   ├── AppSearch.tsx             # Form: two inputs + submit button
│   └── AppCard.tsx               # Displays metadata for one app (or error state)
├── lib/
│   ├── ios-store.ts              # iOS scraper wrapper (server-only, cached)
│   └── android-store.ts          # Android scraper wrapper (server-only, cached)
├── types/
│   ├── app-data.ts               # Shared AppData type + AppPrice + ApiError
│   └── app-store-scraper.d.ts   # Hand-written type declarations for app-store-scraper
├── __tests__/
│   ├── lib/
│   │   ├── ios-store.test.ts     # Tests for fetchIosApp (field mapping, updatedAt normalisation)
│   │   └── android-store.test.ts # Tests for fetchAndroidApp (field mapping, updatedAt normalisation)
│   └── components/
│       └── AppCard.test.tsx      # Tests AppCard error state rendering
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Shared Types

```ts
// types/app-data.ts

export type AppPrice =
  | { type: 'free' }
  | { type: 'paid'; amount: number; currency: string };

export interface AppData {
  title: string;
  /** Absolute URL to the app icon image */
  icon: string;
  score: number;           // 0–5
  reviewCount: number;
  /** Current version string. May be "Varies with device" for Android. Do not parse as semver. */
  version: string;
  developer: string;
  price: AppPrice;
  /** ISO 8601 string — safe across the JSON boundary */
  updatedAt: string;
  /** Fully-qualified URL to the app's store page */
  storeUrl: string;
  store: 'ios' | 'android';
}

export interface ApiError {
  error: string;
  code: 'APP_NOT_FOUND' | 'SCRAPER_ERROR' | 'INVALID_APP_ID';
}
```

**Key decisions vs. original plan:**
- `updatedAt: string` not `Date` — `Date` objects silently become strings across the JSON boundary; TypeScript won't catch the mismatch
- `price: AppPrice` discriminated union — prevents accidentally rendering `$0.00` for free apps
- `ApiError` with `code` field — lets `AppCard` show a specific message per error type

---

## API Route Error Handling

| Condition | HTTP status | `code` |
|---|---|---|
| Missing or malformed `appId` param | `400` | `INVALID_APP_ID` |
| App not found in that store/country | `404` | `APP_NOT_FOUND` |
| Scraper network failure or internal error | `502` | `SCRAPER_ERROR` |

The lib wrappers should throw typed errors so the route handler can distinguish them:

```ts
// lib/ios-store.ts
export class AppNotFoundError extends Error {
  readonly code = 'APP_NOT_FOUND' as const;
}
export class StoreScraperError extends Error {
  readonly code = 'SCRAPER_ERROR' as const;
}
```

---

## Client-Side Fetch Pattern

No SWR. Plain `fetch` + `Promise.allSettled` in `SearchPage.tsx`:

```ts
// components/SearchPage.tsx
'use client'

async function handleSearch({ iosId, androidId }: { iosId: string; androidId: string }) {
  setLoading(true);
  const [ios, android] = await Promise.allSettled([
    fetch(`/api/ios?appId=${encodeURIComponent(iosId)}`).then(r => r.json()),
    fetch(`/api/android?appId=${encodeURIComponent(androidId)}`).then(r => r.json()),
  ]);
  setResults({
    ios: ios.status === 'fulfilled' ? ios.value : { error: 'Failed', code: 'SCRAPER_ERROR' },
    android: android.status === 'fulfilled' ? android.value : { error: 'Failed', code: 'SCRAPER_ERROR' },
  });
  setLoading(false);
}
```

`AppSearch.tsx` calls `onSearch({ iosId, androidId })` — object arg, not two positional strings (prevents swap bugs).

---

## Acceptance Criteria

### Functional

- [x] User can enter an iOS bundle ID (e.g. `com.spotify.client`) and Android package name (e.g. `com.spotify.music`) into a form
- [x] Submitting the form fetches metadata from both stores and displays results side-by-side
- [x] Each result card shows: app name, icon, rating (star score), review count, current version, developer name, and price (`Free` or `$X.XX`)
- [x] If one store lookup fails, the other still displays — errors are shown per-card with a message matching the `code` (not found vs. scraper error)
- [x] `updatedAt` displays correctly for both stores (normalised to ISO string in the lib wrapper)
- [x] Results are cached for 1 hour — repeated lookups of the same app ID do not re-hit the scraper

### Technical

- [x] Scraper packages listed in `serverExternalPackages` in `next.config.ts`
- [x] `import 'server-only'` in both lib files
- [x] API routes validate `appId` with `/^[a-zA-Z0-9._-]+$/` before calling scraper
- [x] API routes return `400` / `404` / `502` as appropriate with typed `ApiError` body
- [x] `AppSearch.tsx` is marked `'use client'`; `AppCard.tsx` is a Server Component
- [x] `fetchIosApp` and `fetchAndroidApp` are exported uncached for direct testing
- [x] `updatedAt` normalisation logic is covered by unit tests
- [x] `AppCard` error state rendering is covered by a component test
- [x] `npm run build` passes with no TypeScript errors
- [x] `npm run test` passes

### Non-functional

- [ ] No API keys or secrets required for MVP
- [ ] Works on local `npm run dev`

---

## Implementation Tasks

1. Scaffold: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias='@/*'`
2. Install: `npm install app-store-scraper google-play-scraper` + `npm install -D @types/google-play-scraper`
3. Configure `next.config.ts` with `serverExternalPackages: ['app-store-scraper', 'google-play-scraper']`
4. Write `types/app-store-scraper.d.ts` (fields: `title`, `icon`, `score`, `reviews`, `version`, `developer`, `price`, `currency`, `updated`, `url`, `appId`)
5. Write `types/app-data.ts` (`AppData`, `AppPrice`, `ApiError`)
6. Write `lib/ios-store.ts` — `fetchIosApp` (pure) + `getIosApp` (cached); typed errors
7. Write `lib/android-store.ts` — `fetchAndroidApp` (pure) + `getAndroidApp` (cached); typed errors
8. Write `app/api/ios/route.ts` — validate, call `getIosApp`, map errors to status codes
9. Write `app/api/android/route.ts` — same pattern
10. Write `components/AppCard.tsx` — renders `AppData` or `ApiError`
11. Write `components/AppSearch.tsx` (`'use client'`) — form with `onSearch({ iosId, androidId })`
12. Write `components/SearchPage.tsx` (`'use client'`) — owns state, calls fetch, renders two `AppCard`s
13. Update `app/page.tsx` to render `<SearchPage />`
14. Write `__tests__/lib/ios-store.test.ts` — mock scraper, test field mapping + `updatedAt` normalisation
15. Write `__tests__/lib/android-store.test.ts` — same for Android (including Unix ms → ISO conversion)
16. Write `__tests__/components/AppCard.test.tsx` — test error state renders
17. Smoke test with `com.spotify.client` / `com.spotify.music`

---

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Scraper breaks due to store page change | Medium | Cache responses; check GitHub issues before starting |
| Cloud IP blocked by Apple/Google | Low (MVP scale) | Acceptable for now; revisit at production scale |
| `app-store-scraper` has no TS types | Certain | Write `types/app-store-scraper.d.ts` in task 4 |
| Android `version` field unreliable | High | Display as-is; no semver parsing |
| `unstable_cache` requires serialisable return | Certain | `AppData` uses `string` for `updatedAt` — safe |

---

## References

- Brainstorm: `docs/brainstorms/2026-02-21-app-vitals-initial-brainstorm.md`
- `app-store-scraper` npm: https://www.npmjs.com/package/app-store-scraper
- `google-play-scraper` npm: https://www.npmjs.com/package/google-play-scraper
- Next.js `serverExternalPackages`: https://nextjs.org/docs/app/api-reference/next-config-js/serverExternalPackages
- Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
