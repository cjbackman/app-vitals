---
date: 2026-02-25
topic: duolingo-preset-app
---

# Add DuoLingo as a Second Preset App

## What We're Building

Add DuoLingo alongside Babbel in the preset app picker. Clicking DuoLingo fills both iOS and Android IDs and triggers a search, exactly like Babbel does today. DuoLingo's brand green (`#58CC02`) will be used for its sparkline trend lines.

This is also the natural moment to move `brandColor` out of the hardcoded ID checks in `AppCard.tsx` and into the `PresetApp` interface — a change the existing code already anticipated with the comment "Add brandColor there when a second preset app needs it."

## Why This Approach

There's only one approach: add an entry to `PRESET_APPS` and promote `brandColor` into the `PresetApp` interface. No alternatives worth exploring — this is a well-worn path.

## Key Decisions

- **DuoLingo iOS ID:** `570060128`
- **DuoLingo Android ID:** `com.duolingo`
- **DuoLingo brand color:** `#58CC02` (DuoLingo green from brand assets)
- **brandColor on PresetApp:** Add `brandColor?: string` to the interface; Babbel gets `"#FF6700"`, DuoLingo gets `"#58CC02"`; future apps without a brand color omit the field
- **AppCard cleanup:** Replace the hardcoded `if (iosId === "829587759" || ...)` block with `selectedPreset?.brandColor` lookup
- **Icon URL:** Fetch from iTunes Lookup API at `https://itunes.apple.com/lookup?id=570060128` — extract `artworkUrl100`

## Open Questions

- None — scope is clear and constrained.

## Next Steps

→ `/workflows:plan` for implementation details
