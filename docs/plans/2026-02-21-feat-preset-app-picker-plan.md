---
title: "feat: Preset App Picker"
type: feat
date: 2026-02-21
---

# feat: Preset App Picker

Clickable app icon shortcuts that auto-fill both store IDs and trigger a lookup immediately — no more typing bundle IDs. Babbel is the default and runs on page load.

## Problem Statement

The current UI requires knowing and typing the iOS App Store ID and Android package name by hand. For a personal tool tracking a fixed set of apps, this friction is unnecessary. A quick-pick row of known apps makes the common case instant.

## Proposed Solution

Add an `AppPicker` strip above the search form. Each entry shows the app's icon and name as a clickable button. Selecting one fills both ID fields and fires the lookup automatically. The currently selected preset is highlighted. Babbel is pre-selected and auto-searched on page load.

## Acceptance Criteria

- [x] A horizontal row of preset app buttons renders above the manual input fields
- [x] Each button shows the app icon (via `next/image`, 40×40) and the app name
- [x] Clicking a preset fills both `iosId` and `androidId` inputs and immediately triggers the lookup
- [x] The active preset is visually highlighted (`ring-2 ring-blue-500`) and has `aria-pressed="true"`; all others have `aria-pressed="false"`
- [x] Babbel is pre-selected on initial mount and its lookup fires automatically (inputs pre-filled)
- [x] Manually editing either ID field deselects the active preset (no highlighted button); the other field is left as-is
- [x] Re-clicking the already-active preset is a no-op (no loading flash, no duplicate fetch)
- [x] If a preset icon URL fails (404), the image is hidden and a 40×40 gray placeholder renders instead
- [x] The manual text inputs still work independently (existing behaviour preserved)
- [x] Tests cover: preset selection fills inputs + calls `onSearch`, `aria-pressed` reflects active state, no preset highlighted when IDs don't match any entry

## Technical Approach

### State

`iosId` and `androidId` state moves from `AppSearch` up to `SearchPage`. **`selectedPreset` is not stored as state** — it is derived:

```ts
const selectedPreset = PRESET_APPS.find(
  (p) => p.iosId === iosId && p.androidId === androidId
) ?? null;
```

This eliminates a synchronisation problem: editing either input field automatically deselects the preset because the values no longer match. No manual clearing needed.

**Component tree (after):**
```
SearchPage  ← owns iosId, androidId, loading, results
├── AppPicker  ← receives derivedSelectedPreset; calls onSelect(preset)
├── AppSearch  ← controlled: receives value + onChange for each field
└── AppCard × 2
```

### Preset data

A small static array at `components/preset-apps.ts` — **not** `lib/`, which is reserved for server-only modules with `import 'server-only'` and `unstable_cache`. Placing client-accessible static data there would break the established convention.

```ts
// components/preset-apps.ts
export interface PresetApp {
  name: string;
  iosId: string;       // numeric App Store ID (e.g. "829587759")
  androidId: string;   // Google Play package name
  iconUrl: string;     // Apple CDN URL — see note below
}

export const PRESET_APPS: PresetApp[] = [
  {
    name: "Babbel",
    iosId: "829587759",
    androidId: "com.babbel.mobile.android.en",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/.../100x100bb.jpg",
    // ^ Fetch once: https://itunes.apple.com/lookup?id=829587759 → artworkUrl100
    // If the URL breaks (Apple rotates CDN paths on icon updates), re-fetch and paste.
  },
];
```

> The `**.mzstatic.com` hostname is already whitelisted in `next.config.ts:7`.

### AppPicker component

```tsx
// components/AppPicker.tsx
"use client";
import Image from "next/image";
import { PRESET_APPS, type PresetApp } from "@/components/preset-apps";

interface AppPickerProps {
  selectedPreset: PresetApp | null;
  onSelect: (preset: PresetApp) => void;
}

export default function AppPicker({ selectedPreset, onSelect }: AppPickerProps) {
  return (
    <div role="group" aria-label="Quick-pick app" className="flex gap-3 overflow-x-auto">
      {PRESET_APPS.map((preset) => {
        const isActive = preset === selectedPreset;
        return (
          <button
            key={preset.iosId}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(preset)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
              ${isActive ? "ring-2 ring-blue-500 border-blue-300" : "border-gray-200 hover:border-gray-300"}`}
          >
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-100">
              <Image
                src={preset.iconUrl}
                alt=""           {/* decorative — button text provides the name */}
                fill
                className="object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <span className="text-xs text-gray-700">{preset.name}</span>
          </button>
        );
      })}
    </div>
  );
}
```

### SearchPage changes

1. Lift `iosId`, `androidId` state from `AppSearch`; initialise directly to Babbel's values (avoids a blank-then-filled flash)
2. Derive `selectedPreset` (no extra state)
3. Use `useRef` for the `AbortController` to enable abort-on-new-click (prevents stale results from a slow previous fetch)
4. `handleSelect`: no-op if preset already active; otherwise set IDs and call `handleSearch`
5. `useEffect` fires the initial Babbel search on mount only:

```tsx
const abortRef = useRef<AbortController | null>(null);

const [iosId, setIosId] = useState(PRESET_APPS[0].iosId);
const [androidId, setAndroidId] = useState(PRESET_APPS[0].androidId);

const selectedPreset = PRESET_APPS.find(
  (p) => p.iosId === iosId && p.androidId === androidId
) ?? null;

async function handleSearch({ iosId, androidId }: SearchParams) {
  abortRef.current?.abort();                   // cancel any in-flight request
  const controller = new AbortController();
  abortRef.current = controller;
  setLoading(true);
  setResults(null);
  // ... fetch using controller.signal (existing logic)
}

function handleSelect(preset: PresetApp) {
  if (preset === selectedPreset) return;       // re-click is a no-op
  setIosId(preset.iosId);
  setAndroidId(preset.androidId);
  handleSearch({ iosId: preset.iosId, androidId: preset.androidId });
}

useEffect(() => {
  // Auto-search the default preset on mount.
  // handleSearch is intentionally omitted from deps: this must run once only.
  // The function reference is stable within a single mount lifecycle.
  handleSearch({ iosId: PRESET_APPS[0].iosId, androidId: PRESET_APPS[0].androidId });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

> **React 18 Strict Mode note:** In development, Strict Mode double-invokes effects. The second invocation aborts the first via `abortRef`, so the user sees one clean result, not two. This is correct behaviour.

### AppSearch changes

Make it a controlled component so preset selections are reflected in the inputs:

```tsx
interface AppSearchProps {
  iosId: string;
  androidId: string;
  onIosIdChange: (v: string) => void;
  onAndroidIdChange: (v: string) => void;
  onSearch: (params: SearchParams) => void;
  loading: boolean;
}
```

## Files

| File | Change |
|---|---|
| `components/preset-apps.ts` | New — `PRESET_APPS` constant + `PresetApp` type (not in `lib/`) |
| `components/AppPicker.tsx` | New — picker UI component |
| `components/SearchPage.tsx` | Lift state, derive `selectedPreset`, `useRef` for abort, auto-search on mount |
| `components/AppSearch.tsx` | Make controlled (remove internal state, add `value`/`onChange` props) |
| `__tests__/components/AppPicker.test.tsx` | New — unit tests |
| `__tests__/components/AppSearch.test.tsx` | New — unit tests for controlled behaviour |

## References

- `components/AppSearch.tsx:17-18` — state to lift
- `components/SearchPage.tsx:13` — where state moves to
- `next.config.ts:7` — Apple CDN already whitelisted
- `lib/ios-store.ts:22` — confirms numeric IDs are accepted
- iTunes lookup for icon URL: `https://itunes.apple.com/lookup?id=829587759`

## Review Findings Applied

- **`selectedPreset` derived not stored** — eliminates sync bug (architecture-strategist)
- **`components/preset-apps.ts` not `lib/`** — `lib/` is server-only convention (architecture-strategist)
- **`useRef` for AbortController** — prevents stale results on concurrent preset clicks (spec-flow-analyzer)
- **Re-click is no-op** — avoids disruptive loading flash (spec-flow-analyzer)
- **`aria-pressed` on buttons** — accessible selection state (spec-flow-analyzer)
- **Icon `onError` fallback** — handles 404 Apple CDN URLs (spec-flow-analyzer)
- **Strict Mode double-fire** — handled by abort-on-new-call pattern (spec-flow-analyzer)
- **State initialised to Babbel directly** — no blank flash before `useEffect` fires (spec-flow-analyzer)
- **`useEffect` has explanatory comment** — not just a lint suppression (architecture-strategist)
