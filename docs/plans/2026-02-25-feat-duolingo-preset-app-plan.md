---
title: "feat: Add Duolingo as second preset app"
type: feat
date: 2026-02-25
---

# feat: Add Duolingo as Second Preset App

Add Duolingo alongside Babbel in the preset app picker. Promote `brandColor` from a hardcoded ID check in `AppCard` into the `PresetApp` interface — the existing code anticipated this with a comment: "Add brandColor there when a second preset app needs it."

## Proposed Solution

### 1. Add `brandColor` to `PresetApp` + add Duolingo (`components/PresetApps.ts`)

```typescript
export interface PresetApp {
  name: string;
  iosId: string;
  androidId: string;
  iconUrl: string;
  /**
   * Optional brand hex color for sparkline strokes.
   * Omit for apps where the default indigo is acceptable.
   * Format: "#RRGGBB"
   */
  brandColor?: string;
}

export const PRESET_APPS: PresetApp[] = [
  {
    name: "Babbel",
    iosId: "829587759",
    androidId: "com.babbel.mobile.android.en",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/66/87/3f/66873f01-ba57-4e60-2885-2c03cf94720d/AppIcon-Default-0-0-1x_U007epad-0-1-0-0-85-220.png/100x100bb.jpg",
    brandColor: "#FF6700",
  },
  {
    name: "Duolingo",
    iosId: "570060128",
    androidId: "com.duolingo",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/8c/2e/fc/8c2efc2c-1efc-50ea-a0b1-16ab54db9102/AppIcon-0-0-1x_U007epad-0-1-85-220.png/100x100bb.jpg",
    brandColor: "#58CC02",
  },
];
```

### 2. Accept `brandColor` prop; remove hardcoded ID check (`components/AppCard.tsx`)

Replace the hardcoded block (lines 130–134):
```typescript
// REMOVE:
const brandColor =
  (store === "ios" && appId === "829587759") ||
  (store === "android" && appId === "com.babbel.mobile.android.en")
    ? "#FF6700"
    : undefined;
```

Add `brandColor` to `AppCardProps`:
```typescript
interface AppCardProps {
  store: "ios" | "android";
  data: AppData | ApiError | null;
  loading?: boolean;
  appId?: string;
  brandColor?: string;
}
```

Use it directly — no computation needed:
```typescript
export default function AppCard({ store, data, loading, appId, brandColor }: AppCardProps) {
  // ...
  <SnapshotHistory snapshots={snapshots} store={store} color={brandColor} />
}
```

### 3. Pass `brandColor` from `selectedPreset` (`components/SearchPage.tsx`)

`selectedPreset` is already derived at line 29. Pass its `brandColor` to both cards:

```tsx
<AppCard
  store="ios"
  data={results?.ios ?? null}
  loading={loading}
  appId={iosId}
  brandColor={selectedPreset?.brandColor}
/>
<AppCard
  store="android"
  data={results?.android ?? null}
  loading={loading}
  appId={androidId}
  brandColor={selectedPreset?.brandColor}
/>
```

## Acceptance Criteria

- [x] Duolingo button appears in the preset app picker alongside Babbel
- [x] Clicking Duolingo fills both iOS and Android ID fields and triggers a search
- [x] Duolingo sparklines render in `#58CC02` green
- [x] Babbel sparklines still render in `#FF6700` orange
- [x] Apps searched manually (not via picker) show default indigo sparklines
- [x] Hardcoded ID check removed from `AppCard.tsx`
- [x] All existing tests pass

## Tests

### `__tests__/components/AppPicker.test.tsx`

1. Update the existing "renders a button for each preset" test to assert both Babbel **and** Duolingo buttons are present (the test currently only checks Babbel, making its name a lie after this change).
2. Add a "calls onSelect with Duolingo preset when clicked" test mirroring the existing Babbel click test.

### `__tests__/components/AppCard.test.tsx`

Add a mock-based prop-threading test. Mock `SnapshotHistory` to capture the `color` prop:

```typescript
jest.mock("@/components/SnapshotHistory", () => ({
  __esModule: true,
  default: ({ color }: { color?: string }) => (
    <div data-testid="snapshot-history" data-color={color ?? ""} />
  ),
}));

it("passes brandColor prop through to SnapshotHistory", async () => {
  await act(async () => {
    render(
      <AppCard
        store="ios"
        data={BASE_APP}
        appId="570060128"
        brandColor="#58CC02"
      />
    );
  });
  expect(screen.getByTestId("snapshot-history")).toHaveAttribute(
    "data-color",
    "#58CC02"
  );
});
```

Note: there is no existing test relying on a hardcoded ID check — nothing to delete from the test file on that front.

## Files to Change

| File | Change |
|------|--------|
| `components/PresetApps.ts` | Add JSDoc + `brandColor?: string` to interface; add field to Babbel; add Duolingo entry |
| `components/AppCard.tsx` | Add `brandColor?: string` prop; remove hardcoded ID check |
| `components/SearchPage.tsx` | Pass `brandColor={selectedPreset?.brandColor}` to both `<AppCard>` instances |
| `__tests__/components/AppPicker.test.tsx` | Update existing render test + add Duolingo click test |
| `__tests__/components/AppCard.test.tsx` | Add mock-based brandColor prop-threading test |

## References

- Brainstorm: `docs/brainstorms/2026-02-25-duolingo-preset-app-brainstorm.md`
- Existing preset: `components/PresetApps.ts`
- AppCard brandColor (to remove): `components/AppCard.tsx:130-134`
- SearchPage AppCard rendering: `components/SearchPage.tsx:112-123`
- Babbel brand orange: `#FF6700`; Duolingo brand green: `#58CC02`
