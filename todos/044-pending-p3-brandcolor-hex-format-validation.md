---
status: pending
priority: p3
issue_id: "044"
tags: [code-review, security, quality, presets]
dependencies: []
---

# P3: `brandColor` flows into SVG attributes with no format enforcement

## Problem Statement

The `brandColor` field in `PresetApp` is documented as `"#RRGGBB"` via JSDoc but has no runtime validation. The value flows directly from `PresetApps.ts` → `AppCard.tsx` → `SnapshotHistory.tsx` where it is set as an SVG `fill`/`stroke` attribute. React escapes JSX attribute values, neutralising classic XSS payloads, but a future developer adding a new preset could supply a CSS function value such as `url(javascript:alert(1))` or `expression(...)` that some SVG rendering engines may interpret. The current hardcoded values (`#FF6700`, `#58CC02`) are safe.

## Findings

- **`components/PresetApps.ts:18`** — `brandColor?: string` with JSDoc but no enforcement
- **`components/SnapshotHistory.tsx:57,62,131,132`** — `fill={stroke}` / `stroke={stroke}` SVG attributes from the prop chain
- Identified by security-sentinel (medium) in PR #6 review

## Proposed Solutions

### Option A: Validate at the Sparkline render boundary (Recommended)
Add a small guard in `SnapshotHistory.tsx` before using the color:
```ts
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const safeColor = color && HEX_COLOR_RE.test(color) ? color : DEFAULT_COLOR;
```
Silently falls back to the default indigo if an invalid value is supplied.

### Option B: Validate at the `PresetApp` definition time
Add a build-time or startup assertion in `PresetApps.ts` that all `brandColor` values match the regex. Throws early rather than silently falling back.

### Option C: TypeScript branded type
Define `type HexColor = \`#\${string}\`` and use it for `brandColor`. Catches mistakes at compile time for TypeScript consumers, no runtime cost.

**Recommended:** Option A as a defensive guard at the render boundary, plus Option C for authoring-time safety.

## Acceptance Criteria
- [ ] An invalid `brandColor` value cannot produce an unexpected SVG attribute value
- [ ] Valid `#RRGGBB` hex values continue to render correctly

## Work Log
- 2026-02-25: Identified by security-sentinel (medium) in PR #6 review
