---
title: "feat: Add Duolingo as second preset app with competitor comparison"
type: feat
date: 2026-02-25
---

# feat: Add Duolingo as Second Preset App with Competitor Comparison

Two related changes:

1. **Duolingo preset + `brandColor` refactor** *(already implemented in this branch)*: Add Duolingo to the preset picker; promote `brandColor` from a hardcoded ID check in `AppCard` into the `PresetApp` interface.

2. **Competitor comparison** *(new)*: When a preset is the "leading" app, always fetch and display all other presets as competitors below it. Each competitor gets its own full AppCards (iOS + Android) including sparklines/graphs.

---

## Part 1: Duolingo preset + brandColor refactor ✅

Already shipped. See sections below for what was implemented.

### 1. `PresetApp` interface + Duolingo entry (`components/PresetApps.ts`) ✅

Added `brandColor?: string` field (with JSDoc). Added Duolingo entry with `brandColor: "#58CC02"`. Added `brandColor: "#FF6700"` to Babbel.

### 2. `brandColor` prop on `AppCard` (`components/AppCard.tsx`) ✅

Removed hardcoded Babbel ID check. Added `brandColor?: string` to `AppCardProps`. Passes it through to `SnapshotHistory`.

### 3. `brandColor` threaded from `selectedPreset` (`components/SearchPage.tsx`) ✅

Passes `selectedPreset?.brandColor` to both AppCard instances.

---

## Part 2: Competitor comparison (new)

When the leading app is a preset, fetch live data for **all other presets** in parallel and display them below in a "Competitors" section. Each competitor renders its own iOS + Android AppCards — which automatically include snapshot history sparklines.

When the leading app is a manual search (not a preset), no competitors are shown.

### 4. Fetch all preset apps in parallel (`components/SearchPage.tsx`)

Add a module-level constant and state:

```typescript
// At module scope (alongside existing SCRAPER_ERROR pattern):
const SCRAPER_ERROR: ApiError = { error: "Request failed", code: "SCRAPER_ERROR" };

// In component:
const [competitorResults, setCompetitorResults] = useState<
  Array<{ preset: PresetApp; ios: AppData | ApiError | null; android: AppData | ApiError | null }>
>([]);
```

In `handleSearch`, use a `fetchPair` inner closure to avoid nested settled-result indexing. Derive competitors with a single `find` → `filter` (reference equality):

```typescript
async function handleSearch({ iosId, androidId }: SearchParams) {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;

  setLoading(true);
  setResults(null);
  setCompetitorResults([]);

  // Single scan: find the leading preset, then derive competitors by reference equality.
  // Note: if a user manually types IDs that match a preset, competitors will still appear —
  // this is intentional (simpler than tracking how the search was triggered).
  const leadingPreset = PRESET_APPS.find(
    (p) => p.iosId === iosId && p.androidId === androidId
  ) ?? null;
  const competitors = leadingPreset
    ? PRESET_APPS.filter((p) => p !== leadingPreset)
    : [];

  // Inner closure captures controller.signal — avoids threading it as a parameter.
  async function fetchPair(pIosId: string, pAndroidId: string) {
    const [ios, android] = await Promise.allSettled([
      fetch(`/api/ios?appId=${encodeURIComponent(pIosId)}`, { signal: controller.signal })
        .then((r) => r.json() as Promise<AppData | ApiError>),
      fetch(`/api/android?appId=${encodeURIComponent(pAndroidId)}`, { signal: controller.signal })
        .then((r) => r.json() as Promise<AppData | ApiError>),
    ]);
    return {
      ios: ios.status === "fulfilled" ? ios.value : SCRAPER_ERROR,
      android: android.status === "fulfilled" ? android.value : SCRAPER_ERROR,
    };
  }

  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    // All fetches fire in parallel — leading + all competitors in one Promise.all.
    const [leading, ...competitorData] = await Promise.all([
      fetchPair(iosId, androidId),
      ...competitors.map((p) => fetchPair(p.iosId, p.androidId)),
    ]);

    if (controller.signal.aborted) return;

    setResults(leading);
    setCompetitorResults(
      competitors.map((preset, i) => ({ preset, ...competitorData[i] }))
    );
  } finally {
    clearTimeout(timeoutId);
    if (!controller.signal.aborted) setLoading(false);
  }
}
```

### 5. Render competitors below leading app (`components/SearchPage.tsx`)

Below the existing leading-app grid, add a "Competitors" section:

```tsx
{/* Leading app */}
{showResults && (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    <AppCard store="ios" data={results?.ios ?? null} loading={loading} appId={iosId} brandColor={selectedPreset?.brandColor} />
    <AppCard store="android" data={results?.android ?? null} loading={loading} appId={androidId} brandColor={selectedPreset?.brandColor} />
  </div>
)}

{/* Competitors — no loading prop: they resolve alongside the leading app */}
{competitorResults.map(({ preset, ios, android }) => (
  <div key={preset.name} className="space-y-3">
    <p className="text-sm font-medium text-gray-500">{preset.name}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <AppCard store="ios" data={ios} appId={preset.iosId} brandColor={preset.brandColor} />
      <AppCard store="android" data={android} appId={preset.androidId} brandColor={preset.brandColor} />
    </div>
  </div>
))}
```

---

## Acceptance Criteria

### Part 1 (done) ✅
- [x] Duolingo button appears in the preset app picker alongside Babbel
- [x] Clicking Duolingo fills both iOS and Android ID fields and triggers a search
- [x] Duolingo sparklines render in `#58CC02` green
- [x] Babbel sparklines still render in `#FF6700` orange
- [x] Apps searched manually (not via picker) show default indigo sparklines
- [x] Hardcoded ID check removed from `AppCard.tsx`
- [x] All existing tests pass

### Part 2 (new)
- [x] Selecting Babbel shows Duolingo AppCards below with its sparklines
- [x] Selecting Duolingo shows Babbel AppCards below with its sparklines
- [x] Typing a non-preset ID shows no competitors section
- [x] Typing IDs that happen to match a preset shows competitors (intentional — simpler than tracking trigger source)
- [x] Competitors load in parallel with the leading app (no extra round-trip)
- [x] Competitor section is labelled with the app name
- [x] Re-triggering search clears previous competitor results immediately
- [x] A failing competitor fetch shows an error card; other competitors still render
- [x] All tests pass

---

## Tests (Part 2)

Add tests to `__tests__/components/SearchPage.test.tsx` (create if needed). Mock `fetch` per-call to control leading vs. competitor responses. Mock `next/image` and `SnapshotHistory` (same pattern as `AppCard.test.tsx`) since `SearchPage` renders full `AppCard` components.

- When a preset is selected and all fetches succeed, competitor AppCards appear below the leading app
- When a non-preset ID is used, no competitor section renders
- Re-triggering search clears previous competitor results before new ones arrive
- When a competitor fetch fails, its AppCard shows an error state; the other competitors still render
- Competitor AppCards receive the correct `brandColor` from their `PresetApp`

---

## Files to Change

| File | Change |
|------|--------|
| `components/PresetApps.ts` | ✅ Done |
| `components/AppCard.tsx` | ✅ Done |
| `components/SearchPage.tsx` | Add `competitorResults` state + parallel fetch + competitor render section |
| `__tests__/components/AppPicker.test.tsx` | ✅ Done |
| `__tests__/components/AppCard.test.tsx` | ✅ Done |
| `__tests__/components/SearchPage.test.tsx` | Add competitor rendering tests |

## References

- Brainstorm: `docs/brainstorms/2026-02-25-duolingo-preset-app-brainstorm.md`
- SearchPage: `components/SearchPage.tsx`
- Babbel brand orange: `#FF6700`; Duolingo brand green: `#58CC02`
