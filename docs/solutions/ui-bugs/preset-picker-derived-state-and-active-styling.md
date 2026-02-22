---
title: "Preset App Picker: Derived State, AbortController, and Active-State Styling"
category: ui-bugs
tags: [react, nextjs, derived-state, abort-controller, tailwind, jest, server-only, useeffect]
symptoms:
  - "Button can't be clicked even though onClick is wired"
  - "Active button shows double border / chunky ring"
  - "Preset deselection doesn't happen when editing inputs"
  - "Search triggers with stale state after selecting preset"
  - "In-flight requests not cancelled when quickly switching presets"
  - "PRESET_APPS import fails or causes server-only errors"
  - "next/image causes test failures in jsdom"
module: AppPicker
date: 2026-02-22
---

# Preset App Picker: Derived State, AbortController, and Active-State Styling

A horizontal row of clickable app icon buttons that fill the iOS/Android ID inputs and trigger a search. Babbel is the default and auto-searches on mount.

## Problem

Two bugs appeared during implementation:

**Bug 1 — Button was unclickable.** Clicking the Babbel button did nothing: no loading state, no search. The UI appeared to respond visually (hover styles worked) but no fetch was triggered.

**Bug 2 — Double border on active button.** The active button showed a chunky double-border frame rather than a clean highlight.

## Root Cause

**Bug 1:** `handleSelect` contained an early-return guard:

```ts
if (preset === selectedPreset) return;
```

`selectedPreset` was derived via `PRESET_APPS.find()`, which returns the same object reference that lives in the `PRESET_APPS` array. The guard compared by object identity (`===`), so Babbel was always considered "already selected" — even on the very first click. The function returned immediately every time.

**Bug 2:** The active button className applied both `ring-2 ring-blue-500` and `border-blue-300` simultaneously. Tailwind renders both, producing a visible double-frame.

## Solution

**Bug 1:** Remove the guard entirely. Re-clicking a preset is harmless — it triggers a duplicate fetch which the `AbortController` cancels cleanly before the new request begins.

**Bug 2:** Use only `border-blue-400 bg-blue-50` for the active state. Drop `ring-2` from the button entirely. One border mechanism, one visual outcome.

## Key Patterns

### Derived state — no `selectedPreset` state variable

```ts
const selectedPreset: PresetApp | null =
  PRESET_APPS.find((p) => p.iosId === iosId && p.androidId === androidId) ?? null;
```

Computing `selectedPreset` from the existing `iosId`/`androidId` state eliminates a sync bug: editing either input field deselects the preset automatically because the derived value no longer matches any preset entry. No extra `setState` call required.

### Value comparison for preset matching — not object identity

```ts
const isActive =
  selectedPreset !== null &&
  preset.iosId === selectedPreset.iosId &&
  preset.androidId === selectedPreset.androidId;
```

Comparing field values (not `===` references) means the check works correctly regardless of how the objects were constructed or where they came from.

### Pass IDs explicitly — do not read from state after `setState`

```ts
function handleSelect(preset: PresetApp) {
  setIosId(preset.iosId);
  setAndroidId(preset.androidId);
  // State setters are async — the iosId/androidId closure still holds old values here.
  // Pass the new values directly instead of reading from state.
  handleSearch({ iosId: preset.iosId, androidId: preset.androidId });
}
```

### `AbortController` in `useRef` — not `useState`

```tsx
const abortRef = useRef<AbortController | null>(null);

async function handleSearch({ iosId, androidId }: SearchParams) {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  // ...fetch using controller.signal
}
```

`useRef` avoids a re-render on every request change. The abort happens synchronously before the new fetch begins.

### Mount-only auto-search

```tsx
useEffect(() => {
  // handleSearch reads only its arguments, never component state, so the
  // mounted closure is safe for the lifetime of this effect.
  handleSearch({ iosId: DEFAULT.iosId, androidId: DEFAULT.androidId });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

### `next/image` mock for Jest/jsdom

```ts
jest.mock("next/image", () => ({
  __esModule: true,
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; sizes?: string }
  ) => {
    const { fill: _fill, sizes: _sizes, ...rest } = props;
    return <img {...rest} />;
  },
}));
```

Strip `fill` and `sizes` (Next.js-only props) before forwarding to a plain `<img>` so jsdom does not throw on unknown attributes.

### Static client data belongs in `components/` — not `lib/`

`lib/` uses `import 'server-only'`, which makes all exports unavailable in client components. Static lookup data like the preset list lives in `components/PresetApps.ts` instead.

### iTunes Lookup API for icon URLs

```
GET https://itunes.apple.com/lookup?id=829587759
→ response.results[0].artworkUrl100
```

Apple CDN paths can rotate when an app updates its icon — re-fetch if a URL breaks.

## Prevention

- When matching against a derived value, always compare field values, not object references (`===`).
- Never store derived state that can be computed from other state — compute it inline instead.
- After calling `setState`, do not read that state variable in the same synchronous function. Pass the new value explicitly.
- When a button uses both `ring-*` and `border-*` classes, verify in the browser that only one border frame is visible.
- Write a test that clicks the default/pre-selected button and asserts the expected behaviour fires — this would have caught Bug 1 immediately.
