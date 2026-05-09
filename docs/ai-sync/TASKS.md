# AI Sync Tasks

Last updated: 2026-04-28 (Partner B — launch overhaul pass)

## Completed this session (Partner B — 2026-04-28 ecommerce-first + try-on upload hardening)
- [DONE] Implemented robust upload validation in `app/try-on/page.tsx` (file type + max size checks, clearer recovery CTAs).
- [DONE] Added explicit upload controls in try-on: `Upload another`, `Change photo`, `Remove photo`.
- [DONE] Added explicit behavior toggle for photo changes: keep current makeup layers by default, with optional reset.
- [DONE] Improved no-face recovery UX for upload mode with guidance and one-click re-upload paths.
- [DONE] Ingested `PRODUCT IMAGES/PK Lip Wardah.pdf` text metadata into `data/products.ts` (`sourceTags`, shade refs, icon labels).
- [DONE] Added PDF mapping and manual image fallback file plan in `docs/PRODUCT_IMAGE_MAPPING_FROM_PDF.md`.
- [DONE] Shifted IA/UX to ecommerce-first across `app/page.tsx`, `app/shop/page.tsx`, `app/product/[slug]/page.tsx`, `components/Nav.tsx`, `components/ProductCard.tsx`, `app/cart/page.tsx`, `app/checkout/page.tsx`.
- [DONE] Updated shared styling in `styles/globals.css` for ecommerce funnel blocks and new try-on upload controls.

## Completed this session (Partner B — 2026-04-28 launch overhaul)
- [DONE] Try-on moved to upload-first default in `app/try-on/page.tsx` with `ENABLE_LIVE_CAMERA = false`.
- [DONE] Camera UI hidden and preserved in commented markers (`CAMERA_MODE_START/END`, `CAMERA_BUTTON_START/END`) for easy re-enable.
- [DONE] Added object URL lifecycle cleanup for upload previews (`URL.revokeObjectURL` on replacement and unmount).
- [DONE] Replaced placeholder visual blocks with wired branded assets on home/about/PDP/ProductCard using `next/image`.
- [DONE] Added product image mapping in `data/products.ts` and created `/public/images/products/*.svg` asset set.
- [DONE] Installed prompt skill package: `nano-banana-pro-prompts-recommend-skill` and added `docs/IMAGE_PROMPT_LIBRARY.md`.
- [DONE] Launch hardening: `next.config.mjs` image optimization + security headers, added `app/manifest.ts`, new icon assets.
- [DONE] Checkout launch clarity tightened with explicit simulated-payment messaging on checkout + PDP.
- [DONE] Validation attributes improved on checkout form inputs (phone/postcode patterns).

## Status Legend
- `TODO`: not started
- `IN_PROGRESS`: actively being worked
- `DONE`: completed and validated
- `BLOCKED`: waiting on dependency or user decision

## Completed this session (Partner B)
- [DONE] Fix `EYELINER_L` winging the wrong way. Walk order now inner → outer, matches right eye.
- [DONE] Fix eyeshadow crease gradient direction. Shadow is strongest in the crease, fades toward the lash line.
- [DONE] Fix contour temple stripe. Anchors re-pointed to hairline indices (`21, 54, 103, ...`) instead of the cheek/jaw points that were painting into mid-cheek.
- [DONE] Dial down lipgloss sheen. Removed the stacked triple white passes; single blurred band + faint upper-lip rim.
- [DONE] Add `detectFaceShape()` + `FaceProfile` in `lib/tryon-engine.ts`.
- [DONE] Add `app/try-on/_components/FaceScanOverlay.tsx` — 3-stage intro scan.
- [DONE] Add `app/try-on/_components/ProfileCard.tsx` — summary + top-3 recommendations + Apply All.
- [DONE] Wire scan + profile into `app/try-on/page.tsx` (first-face trigger, reset on source change).
- [DONE] CSS for scan overlay + profile card in `styles/globals.css`.

## Completed this session (Partner A — 2026-04-23)
- [DONE] Drop nails to "Coming Soon". Removed `renderNails`, `NailFinish`, the MediaPipe Hands load path, nail UI, and nails from recommendations.
- [DONE] Fix lipgloss "strip of light". Replaced stacked midline stroke passes with discrete radial specular highlights (lower-lip apex + cupid's-bow lobes). Applied to both camera (`renderLipgloss`) and model (`applyPortraitLayers`) paths.
- [DONE] Fix eyeliner tracking at close + long range. Added EMA-smoothed lid-point cache, downward pixel-scaled bias toward the lash, clamped baseThickness to 1.0–4.5 px.
- [DONE] Fix contour cheekbone. New `CONTOUR_CHEEKBONE_L/R` landmark ring (`234, 227, 116, 117, 118, 101, 36` / mirror); `CONTOUR_TEMPLE_L/R` kept as back-compat alias. Added a wider soft-bloom pass so it reads as plane shadow.
- [DONE] Restructure try-on into gated narrative flow (`idle → scanning → curating → showingProfile → playing`). ProfileCard now renders as a hero above the preview; controls panel dims/disables during `scanning` + `curating`; new `CuratingOverlay` fills the stage between scan and reveal.

## Completed this session (Partner A — 2026-04-23 follow-up overhaul)
- [DONE] User-initiated scan. `buildDefaultLayers` now returns every layer inactive, face-detection loop no longer auto-triggers the scan, new `ScanCTA` overlay asks the user to start the scan themselves. No pre-applied filters on landing.
- [DONE] Rewrite `renderContour` from stroked smoothed paths → blurred wide strokes (`ctx.filter`) + screen-blended highlight pass on forehead / nose / chin / cheekbone tops. Same treatment applied to model-mode contour in `app/try-on/page.tsx::applyPortraitLayers`.
- [DONE] Lower MediaPipe FaceMesh `minDetectionConfidence` + `minTrackingConfidence` from `0.5` → `0.3`. Unblocks eyeliner (and all renderers) at close-up camera distance.
- [DONE] Verified lip gloss radial-specular rendering post-rewrite; params stay balanced (apex alpha `0.18 + intensity*0.22`, lobes `0.12 + intensity*0.14`).
- [DONE] Desktop UI refinements — sticky controls panel card with elevation + internal scroll, icon-tab source selector, larger shade swatches (52 px), controls-panel header with title + eyebrow.
- [DONE] Mobile responsive — full-bleed stage, horizontal-scroll shade + layer strips with snap, sticky bottom action bar with `env(safe-area-inset-bottom)`, 44 px min touch targets, compact scan CTA.

## Completed this session (Partner B — 2026-04-23, engine v4 + UI/UX plan)
- [DONE] Contour v4 in `lib/tryon-engine.ts::renderContour`. Face-oval clip, single wide blurred shadow + thin definition pass, cheekbone weighted heavier than jaw, shade hex passed through new `toContourHex()` (desat + cool/warm mix). Model-mode block in `applyPortraitLayers` mirrored to match.
- [DONE] Eyeliner v4 in `lib/tryon-engine.ts::renderEyeliner`. Adaptive EMA per lid point, blink gate via new `eyeAperture()`, hair-thin clamped tightline (0.6–1.8 px), wing anchor on raw outer-corner landmark, wing direction blends eye-axis + `localUp`.
- [DONE] New exports: `toContourHex` (public). New private helpers: `FACE_OVAL`, `smoothLidPoint` (now adaptive), `eyeAperture`.
- [DONE] Generate design system via `/ui-ux-pro-max`. Two queries — first returned Liquid Glass (perf-moderate), second returned Soft UI Evolution (perf-excellent, WCAG AA+). Picked Soft UI as base; Liquid Glass reserved for hero chrome + modal backdrop only.
- [DONE] `design-system/MASTER.md` — full token set (colour, type, spacing, motion, breakpoints), global UX rules, navigation spec, accessibility + ethics + perf budget.
- [DONE] `design-system/pages/{home,shop,product,try-on,cart,checkout}.md` — per-page overrides inheriting MASTER.
- [DONE] `design-system/UI_UX_UPGRADE_PLAN.md` — 10-phase rollout (Phase 0 foundations → Phase 9 launch QA).
- [DONE] `design-system/LAUNCH_CHECKLIST.md` — Must / Should / Nice waves, blocks publish on any unchecked Must.
- [DONE] `npx tsc --noEmit` clean. `npm run lint` clean (exit 0) with the same two pre-existing warnings (`no-page-custom-font`, `no-img-element`); both already scheduled for Phase 0 of the upgrade plan. `npm run build` blocked locally by the dev server holding `.next` — not a source-level regression.

## Completed this session (Partner B — 2026-04-23, upload-ready Phase 0 pass)
- [DONE] Migrated Google Fonts from `<link>` to `next/font/google` — `Cormorant_Garamond` + `Inter` imported in `app/layout.tsx`, wired through `--font-cormorant` / `--font-inter` CSS vars in `styles/globals.css` behind the existing `--font-display` / `--font-body` tokens. Kills the `no-page-custom-font` lint warning, enables self-hosting + `font-display: swap`.
- [DONE] Disabled `no-img-element` at the try-on upload `<img>` with an inline rationale — the src is a runtime blob URL, dimensions are unknown, and MediaPipe consumes the raw `HTMLImageElement` via ref. `next/image` is not the right tool here.
- [DONE] Global `prefers-reduced-motion` block in `styles/globals.css` — kills entrance animations, transforms, scroll-behavior, and decorative backdrop blurs for users who opt out.
- [DONE] Global `prefers-contrast: more` block — strengthens focus rings + 2 px borders on form controls.
- [DONE] Hardened focus rings: `:focus { outline: none }` + `:focus-visible { outline: 2px solid plum; outline-offset: 2px }` so mouse/touch users don't see the ring, keyboard users do.
- [DONE] `app/sitemap.ts` — dynamic sitemap pulling product slugs from `data/products.ts`, covering `/`, `/shop`, `/try-on`, `/about`, `/halal`, `/contact`, and every `/product/[slug]`. Uses `NEXT_PUBLIC_SITE_URL` env var with `nuracosmetics.co.uk` fallback.
- [DONE] `app/robots.txt` updated — disallows `/api/`, `/cart`, `/checkout`, `/admin`; points to `/sitemap.xml`; declares host. Kept as static `.txt` because the static file already existed and the rename-to-`.ts` file was blocked by VM delete permissions (the dynamic alternative lives at `design-system/robots-dynamic-example.ts` for future reference).
- [DONE] `app/error.tsx` — route-level error boundary. Keeps Nav + Footer + CartProvider mounted, offers Try-again / Back-home + digest ID.
- [DONE] `app/global-error.tsx` — last-resort boundary for root-layout crashes. Self-contained `<html><body>` with inline styles (layout.tsx no longer mounted by this point).
- [DONE] Re-validated: `npx tsc --noEmit` clean, `npm run lint` → **"No ESLint warnings or errors"**. Both previous pre-existing warnings now resolved.

## Active
- [TODO] Polish labels / a11y for the new style chips (carried over).
- [DONE] (Partner A — Cursor) Convert emoji category icons to inline SVG for visual consistency.
- [IN_PROGRESS] (Partner A — Cursor) Split `app/try-on/page.tsx` into `ControlsPanel`, `PreviewStage`, `SourceSelector`, `LayerDetail` — boundaries in place, module extraction still pending.
- [TODO] Consider saving the face-shape result to `localStorage` so repeat visits skip the scan.
- [TODO] Minor lipstick tracking jitter on smile/head-turn (user-reported; low priority).

## Partner A (Cursor) — suggested next
- Rework the controls-panel typography / spacing to match the new ProfileCard's premium feel.
- Replace the file-input "Upload photo" button chip with a drag-and-drop target.
- Add explicit aria-labels to `FaceScanOverlay` stage text.
- Extract `PreviewStage` / `ControlsPanel` / `LayerDetail` / `SourceSelector` into real modules (boundaries are in place, real extraction not done).

## Partner B (Claude) — review notes
- Ownership of `renderLipgloss`, `renderEyeliner`, `renderContour`, `CONTOUR_TEMPLE_*`, `CONTOUR_CHEEKBONE_*` is now `jointlyOwned` in `GRAPH.json`. Re-inspect the new radial-gloss + EMA-liner logic when you next claim the engine.
- `renderContour` was rewritten again on 2026-04-23 to use blurred wide strokes + a screen-blended highlight pass. No API change, but the internal shape is entirely different from the previous "multiply stroke stack". Worth a review when you next claim the engine.

## Completed this session (Partner B — 2026-05-02, try-on rendering fixes)
- [DONE] Fix eyeshadow invisible on real/uploaded photos. Root cause: `renderEyeshadow` in `lib/tryon-engine.ts` used `globalCompositeOperation = "multiply"` for lid, crease, outer-V passes — invisible on non-white skin. Changed to `source-over` with calibrated alphas.
- [DONE] Fix isStripeVisible threshold blocking eyeshadow on selfies with slight face pitch. Raised threshold from 0.08 → 0.15 for EYESHADOW_L_LID and EYESHADOW_R_LID checks in `renderEyeshadow`.
- [DONE] Fix isStripeVisible threshold blocking eyeliner on selfies with slight face pitch. Same 0.08 → 0.15 fix for EYELINER_L and EYELINER_R checks in `renderEyeliner`.
- [DONE] Remove debug console.log from `app/try-on/page.tsx` eyeshadow switch case.
- [DONE] Visual confirmation on real selfie: eyeshadow correctly positioned on eyelid/crease, eyeliner visible on upper lash line, no artefacts.

## Active (as of 2026-05-02)
- [TODO] Deploy fixes to Vercel production (git push triggers auto-deploy)
- [TODO] Generate replacement product images (see `docs/AI_IMAGE_PROMPTS.md`)
- [TODO] Custom domain setup: nuracosmetics.co.uk DNS → Vercel (manual step for owner)
- [TODO] Polish labels / a11y for style chips (carried over)
- [TODO] Consider caching face-shape result in localStorage to skip repeat scans
