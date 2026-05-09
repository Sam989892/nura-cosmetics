# Shared Context

Last updated: 2026-04-22

## Facts
- Project is a Next.js 14 App Router storefront (`nura-cosmetics`) with TypeScript.
- Core differentiator is a browser-only virtual try-on at `app/try-on/page.tsx`.
- Rendering engine lives in `lib/tryon-engine.ts` and supports multiple finishes/styles:
  - Lipstick finishes: `matte | satin | glossy | sheer | shimmer`
  - Blush placement: `apples | lifted | diffused`; formula: `cream | powder`
  - Eyeliner styles: `winged | tightline | smudged`
  - Nail finishes: `glossy | matte | shimmer`
- Try-on page stores per-layer style fields in state (`LayerState`) AND now exposes explicit UI controls (chip toggles) for each category.
- ESLint is configured via `.eslintrc.json` (extends `next/core-web-vitals`); `npm run lint` runs non-interactively.
- App message and UI emphasize privacy: processing stays in-browser.

## Assumptions
- Current priority is improving UX fidelity of try-on without broad refactors.
- Existing product shade data is sufficiently correct; no schema migration needed.

## Risks
- `app/try-on/page.tsx` is large (~2.4k lines). Any edit should be localized to avoid merge conflicts across partners.
- Pre-existing lint warnings (`no-page-custom-font`, `no-img-element`) are unrelated to current changes but will surface in CI until addressed.

## Current Focus
- Style-option UX is now surfaced end-to-end. Next natural work: label/help-text polish, aria-labels on the chip fieldsets, and optional screenshot regression check between model and real-face modes.

## Latest State
- Completed in prior session: style-option wiring landed for all four categories and model-mode lipstick now uses `layer.lipFinish`.
- Completed in this session (Partner B — Claude):
  - Added `.eslintrc.json` extending `next/core-web-vitals` — `npm run lint` exits 0.
  - Added `StyleChips<T>` helper and conditional chip rows to `app/try-on/page.tsx` for lip finish, blush placement, blush formula, eyeliner style, nail finish.
- Validation:
  - `npx tsc --noEmit` — pass.
  - `npm run lint` — exit 0 with two pre-existing warnings unrelated to current edits.
