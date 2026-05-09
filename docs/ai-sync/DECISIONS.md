# Decisions Log

## 2026-04-28 (Partner B — ecommerce-first + upload UX pass)
- **Decision:** Keep makeup layers by default when users change uploaded photos, but make reset behavior explicit via a checkbox in try-on controls.
- **Rationale:** Least-surprising behavior for shoppers comparing multiple selfies is to keep the chosen look active while changing the base photo. Users who want a fresh start can opt out before upload.
- **Impact:** `app/try-on/page.tsx` now has `preserveLayersOnPhotoChange` and explicit `Change photo` / `Remove photo` / `Upload another` controls; flow resets to `idle` for re-scan on each new image.

## 2026-04-28 (Partner B — PDF ingestion fallback)
- **Decision:** Use extracted text metadata and shade references from `PRODUCT IMAGES/PK Lip Wardah.pdf`, with explicit manual image drop-in filenames for unresolved embedded assets.
- **Rationale:** PDF text extraction is available; deterministic embedded image extraction is not currently automated in this environment.
- **Impact:** `data/products.ts` now includes `sourceTags`, `sourceShadeRefs`, `sourceImageFile`, and `expectedManualAsset` metadata, plus `docs/PRODUCT_IMAGE_MAPPING_FROM_PDF.md` for asset handoff.

## 2026-04-28 (Partner B — ecommerce IA)
- **Decision:** Shift page hierarchy to ecommerce-first by promoting browse/filter/cart/checkout funnels and positioning try-on as a conversion assist.
- **Rationale:** User requested the site feel like a proper ecommerce experience rather than a try-on demo.
- **Impact:** Navigation, homepage messaging, shop cues, PDP trust/info hierarchy, and cart/checkout copy now guide users from discovery to purchase.

## 2026-04-28 (Partner B — launch overhaul pass)
- **Decision:** Ship try-on in upload-only mode by default behind `ENABLE_LIVE_CAMERA = false`, while preserving camera implementation in commented blocks.
- **Rationale:** User requested immediate production-safe launch posture with camera disabled but quickly reversible.
- **Impact:** Live camera UI entry points are hidden, source defaults to upload, and camera code can be re-enabled by toggling the constant and uncommenting marked blocks.

## 2026-04-28 (Partner B — launch overhaul pass)
- **Decision:** Use in-repo branded SVG assets as deterministic launch placeholders and wire them everywhere placeholders previously existed.
- **Rationale:** Runtime image generation tool was unavailable in this environment; SVG assets keep the site cohesive and production-stable while preserving a reproducible prompt pipeline.
- **Impact:** Home, about, PDP, and product cards now render real mapped assets from `/public/images/site` and `/public/images/products`.

## 2026-04-28 (Partner B — launch overhaul pass)
- **Decision:** Add CSP/referrer/nosniff/frame and permission hardening in `next.config.mjs` and complete PWA metadata via `app/manifest.ts`.
- **Rationale:** User requested launch hardening around headers, manifest, and production optimization.
- **Impact:** App now ships explicit security headers, optimized image settings, and complete manifest/icon metadata.

## 2026-04-23 (Partner B — Claude, cavemen mode — upload-ready Phase 0)
- **Decision:** Wire `next/font/google` variables (`--font-cormorant`, `--font-inter`) through the existing `--font-display` / `--font-body` tokens rather than replacing them.
- **Rationale:** The app already references `var(--font-display)` + `var(--font-body)` in ~15 places in `globals.css`. Collapsing next/font directly onto those names would drop the web-safe fallback chain (`"Playfair Display", Georgia, serif` etc.), which renders before hydration and on no-JS. Routing through nested vars preserves the fallback chain and gives next/font priority when the font file lands.
- **Impact:** Kills the `no-page-custom-font` lint warning, enables self-hosted fonts + `font-display: swap`, zero visual regression.

## 2026-04-23 (Partner B — Claude, cavemen mode — upload-ready Phase 0)
- **Decision:** Suppress `no-img-element` at the try-on upload `<img>` rather than converting to `next/image`.
- **Rationale:** `photoUrl` is a runtime `URL.createObjectURL` blob, dimensions are unknown at render time, and MediaPipe FaceMesh consumes the raw `HTMLImageElement` via `imgRef.current`. `next/image` requires known `width`/`height` or `fill` + aspect-ratio, and it renders a wrapper element that breaks the ref contract. This is the one legitimate `<img>` in the codebase.
- **Impact:** Lint is now fully clean ("No ESLint warnings or errors"). Ref + MediaPipe pipeline untouched.

## 2026-04-23 (Partner B — Claude, cavemen mode — upload-ready Phase 0)
- **Decision:** Keep `app/robots.txt` as the single source of truth; deprecate the newly-drafted `app/robots.ts` by moving it to `design-system/robots-dynamic-example.ts`.
- **Rationale:** Both files can't coexist (Next.js errors on conflicting robots conventions), and VM delete permissions refused the `rm` on the pre-existing static file. The static version now includes the same disallows (`/api/`, `/cart`, `/checkout`, `/admin`), sitemap pointer, and host declaration the dynamic file would have produced.
- **Impact:** Robots exposes the same rules either way. The dynamic template is retained for reference so a future switch is a single-file move.

## 2026-04-23 (Partner B — Claude, cavemen mode — engine v4 + UI/UX plan)
- **Decision:** Contour v4 — clip blurred strokes to `FACE_OVAL` (37-index FaceMesh ring), drop halo+core stack in favour of one wide blurred shadow + one thin definition pass, weight cheekbone heavier than jaw (0.8× width, 0.65× alpha), run all shade hex through new `toContourHex()` (desaturate 0.55 + cool/warm mix) before painting.
- **Rationale:** Cursor's v3 still stacked two strokes on the same smoothed path — multiply alpha bruised deeper skin tones. Unclipped blur bled into hair and background. Raw shade hex on rose/pink shades painted rosy cheeks, not shadow. Face-oval clip contains the blur; de-saturating hex collapses any shade into believable contour; weighting cheekbone vs jaw matches how plane shadows actually fall.
- **Alternatives considered:**
  - (a) Keep halo+core but drop alpha 30%. Rejected — still stacks on the same path, same root issue.
  - (b) Render contour as a radial gradient mask. Rejected — loses the cheekbone-ring directional shape.
- **Impact:** Contour now reads as sculpted plane shadow on any shade and any skin tone. Engine-v4 block in `applyPortraitLayers` (model mode) mirrored to match. `toContourHex` is a new public export. `FACE_OVAL` is private to the engine module.

## 2026-04-23 (Partner B — Claude, cavemen mode — engine v4 + UI/UX plan)
- **Decision:** Eyeliner v4 — adaptive EMA alpha (`0.18 + d*0.05`, capped 0.55) per lid point, blink gate via new `eyeAperture()` (BLINK threshold 0.14), tightline clamped 0.6–1.8 px, wing anchor uses raw outer-corner landmark (33 / 263), wing direction blends eye-axis 70% + `localUp` 30%.
- **Rationale:** Fixed EMA jittered at long range and smeared at close range. Paint carried over closed eyelids because there was no blink gate. Tightline at 0.4× baseThickness was too thick — a tightline should read as a hair-thin dark line against the waterline. Wing direction that ignored head tilt pointed wings inward on tilted heads.
- **Alternatives considered:**
  - (a) Higher fixed EMA. Rejected — still fails at one distance range.
  - (b) Drop eyeliner when `faceDetected === false`. Rejected — blinks don't clear `faceDetected`, wouldn't solve the issue.
- **Impact:** Eyeliner holds at close + long range, vanishes on blink, wings track head tilt, tightline reads correctly. New private helpers `smoothLidPoint`, `eyeAperture` in `lib/tryon-engine.ts`.

## 2026-04-23 (Partner B — Claude, cavemen mode — engine v4 + UI/UX plan)
- **Decision:** Pick Soft UI Evolution as the base design system; Liquid Glass reserved for premium accent moments (hero chrome, modal backdrop) only.
- **Rationale:** User brief is "$100k DTC beauty feel" + "not laggy at all" + "mobile responsive". Soft UI scored WCAG AA+ and excellent perf on the ui-ux-pro-max query; Liquid Glass scored premium-premium on feel but moderate-poor on perf, especially on low-end Android. Using Soft UI as the base keeps the perf budget (LCP < 2.5 s, INP < 200 ms) while letting Liquid Glass carry the "expensive" moments inside a `@supports (backdrop-filter)` fallback.
- **Impact:** `design-system/MASTER.md` captures the full token set and global UX rules. Per-page overrides live in `design-system/pages/*.md`. `UI_UX_UPGRADE_PLAN.md` sequences the rollout across 10 phases; `LAUNCH_CHECKLIST.md` gates publish with Must/Should/Nice waves.

## 2026-04-22 00:00 UTC (local session)
- **Decision:** Create baseline `docs/ai-sync` artifacts from scratch because none existed.
- **Rationale:** Collaboration protocol requires a single shared source of truth before ongoing work.
- **Impact:** Enables continuity between Partner A (Cursor) and Partner B (Claude); avoids context loss across sessions.

## 2026-04-22 00:00 UTC (local session)
- **Decision:** Prioritize style-option wiring in try-on renderer before adding new UI controls.
- **Rationale:** Style fields already exist in state and engine supports them; wiring closes functional gap with minimal surface area.
- **Impact:** Immediate behavior correctness improvement and cleaner base for subsequent UI control additions.

## 2026-04-22 00:00 UTC (local session)
- **Decision:** Keep default style fallbacks (`matte`, `apples`, `cream`, `winged`, `glossy`) while wiring dynamic layer options.
- **Rationale:** Preserves existing UX behavior for users who do not explicitly change style fields, while enabling full style path consistency.
- **Impact:** Lower regression risk; model and real-face rendering now both honor layer style state when present.

## 2026-04-22 00:00 UTC (local session)
- **Decision:** Use TypeScript check as primary validation evidence for the previous session.
- **Rationale:** `npm run lint` was non-automatable because Next.js requested interactive ESLint initialization.
- **Impact:** Functional/type confidence was high; lint status remained pending until ESLint config was committed.

## 2026-04-22 (Partner B — Claude session)
- **Decision:** Add `.eslintrc.json` with `{ "extends": "next/core-web-vitals" }` at the repo root.
- **Rationale:** `eslint-config-next` is already in devDependencies, and this is the canonical Next.js config. A minimal flat file avoids prescribing style rules the team hasn't opted into while defeating the interactive first-run prompt.
- **Impact:** `npm run lint` now runs non-interactively in CI and local shells; exits 0 with two pre-existing warnings (`no-page-custom-font` in `app/layout.tsx`, `no-img-element` in `app/try-on/page.tsx`).

## 2026-04-22 (Partner B — Claude session)
- **Decision:** Implement per-category style controls as a small local `StyleChips<T>` helper inside `app/try-on/page.tsx` rather than a new module.
- **Rationale:** The component is ~20 lines, tightly coupled to the try-on panel's existing `filter-group-label` visual language, and only used here. A new module would add import surface without reuse benefit. Using a generic type parameter keeps the option values typed to each engine enum (`LipFinish`, `BlushPlacement`, etc.) without `any` casts.
- **Alternatives considered:**
  - (a) Single driven-by-data array mapping category → control groups. Rejected: pushes type narrowing into runtime and loses per-option autocomplete.
  - (b) Native `<select>`. Rejected: less tactile than chip toggles and inconsistent with existing swatch-pill UX.
- **Impact:** Users can now change lip finish, blush placement, blush formula, eyeliner style, and nail finish from the panel; changes flow through existing `updateLayer` and render on the next frame in both model and real-face modes.

## 2026-04-22 (Partner B — Claude session)
- **Decision:** Do not fix pre-existing lint warnings in this session.
- **Rationale:** Warnings are in `app/layout.tsx` and an unrelated region of `app/try-on/page.tsx`; fixing them would expand scope beyond the agreed plan and increase merge-conflict risk with Partner A.
- **Impact:** Warnings are recorded as follow-up tasks in `TASKS.md`; lint remains green (exit 0).

## 2026-04-22 (Partner B — Claude, cavemen mode)
- **Decision:** Reverse `EYELINER_L` walk order (inner → outer) so wing extrapolation lands at the outer canthus.
- **Rationale:** Previous order walked outer → inner. The wing uses `last - prev` to extrapolate; with `last = 133` (inner corner), the wing flicked inward toward the nose. Right-eye path was already inner → outer, so the two sides drew asymmetric wings. Reversing the left-eye list makes both sides symmetric without touching the rendering code.
- **Impact:** Winged liner now reads correctly on both eyes. `LOWER_LINE_L` reversed to match so smudged-liner order is consistent.

## 2026-04-22 (Partner B — Claude, cavemen mode)
- **Decision:** Flip the eyeshadow crease linear gradient stops (alpha 1 at top, 0 at bottom).
- **Rationale:** The prior stops painted shadow darkest under the eye, not in the crease — the opposite of how eyeshadow actually sits. This was a one-line polarity bug, not a design choice.
- **Impact:** Eyeshadow now reads as a crease wash fading into the lid, matching the reference in `docs/MAKEUP_ANALYSIS.md`.

## 2026-04-22 (Partner B — Claude, cavemen mode)
- **Decision:** Re-anchor `CONTOUR_TEMPLE_L/R` to hairline-adjacent FaceMesh indices.
- **Rationale:** The old indices (`234, 93, 132, 58`) walk down the cheek into the jaw — they were never temple points. That drifted the contour stripe onto mid-cheek, collided with blush placement, and looked like a bruise.
- **Impact:** Temple contour now traces the upper hairline edge and blends into the cheekbone outer edge.

## 2026-04-22 (Partner B — Claude, cavemen mode)
- **Decision:** Replace the triple-pass lipgloss sheen with a single blurred band + faint upper-lip rim.
- **Rationale:** The triple-stack (wide blur + bright mid + narrow core) piled up into a white smear on the lower lip. One blurred band at moderate alpha reads as wet specular; a fainter pass on the upper lip keeps "both lips are glossed".
- **Impact:** Gloss no longer overwrites the pigment wash or looks milky at high intensity.

## 2026-04-22 (Partner B — Claude, cavemen mode)
- **Decision:** Introduce a dedicated face-scan overlay + profile-card component pair under `app/try-on/_components/`.
- **Rationale:** The scan flow is narrative UX (not a micro-tweak) and the profile card is re-rendered only after the scan, so scoping them into separate files keeps the 2.6k-line `page.tsx` from growing further and gives Cursor a clear, conflict-free surface.
- **Alternatives considered:**
  - (a) Inline both blocks into `page.tsx` — rejected, increases page size and editing-conflict surface.
  - (b) Put them under `components/try-on/` at the app root — rejected, pulls logic out of the route's private scope unnecessarily.
- **Impact:** Scan triggers the first time a face locks on camera/upload, resets per source change. ProfileCard surfaces top-3 recommendations with per-row apply and an "Apply all" shortcut.

## 2026-04-22 (Partner B — Claude, cavemen mode)
- **Decision:** Face-shape classification is a pure ratio heuristic over FaceMesh landmarks.
- **Rationale:** No ML model available in-browser that's lightweight enough to bundle. Ratio thresholds are stable enough for a styling hint. Flagged as coarse, not prescriptive.
- **Impact:** Works offline and never leaves the device, preserving the "processing stays in-browser" guarantee.

## 2026-04-22 (Partner B — Claude, cavemen mode)
- **Decision:** Recommendation scoring is deterministic (tone match +3, undertone hex proxy +2, everyday +1, halal +1). Face-shape is used to pick which *categories* to surface, not to re-weight shade selection.
- **Rationale:** Keeps the logic inspectable and lets Partner A tune it without touching a model artifact. Also means the recs are reproducible for the same profile.
- **Impact:** Scans with the same tone/undertone/shape consistently produce the same three recommendations.

## 2026-04-23 (Partner A — Cursor)
- **Decision:** Replace emoji category icons with inline SVG paths rendered via `CategoryIcon`.
- **Rationale:** Emoji glyph style varies by platform and looked inconsistent beside the newer profile-card visuals. Inline SVG keeps icon weight/shape stable and themeable via `currentColor`.
- **Impact:** Layer chips and active-layer header now render consistently across browsers; focused chip state remains readable through CSS color control instead of emoji inversion.

## 2026-04-23 (Partner A — Cursor) — sync-note: cross-ownership edit
- **Decision:** Partner A will edit `lib/tryon-engine.ts` (`renderLipgloss`, `renderEyeliner`, `renderContour`) plus add `CONTOUR_CHEEKBONE_L/R` constants. These functions/constants are listed claude-owned in `GRAPH.json`.
- **Rationale:** User directly reported the three renderers broken (lipgloss "strip of light", eyeliner not sticking close/far, contour still off). Partner B is not in this turn. `.cursor/rules/sync.md` allows ownership crossing with a sync note; this is it.
- **Scope of edit:** lipgloss replaces stroked midline with 2–3 radial specular highlights; eyeliner clamps thickness, smooths landmarks, biases toward lash; contour adds true cheekbone-arch indices (`234, 227, 116, 117, 118, 101, 36` / mirror) and re-aliases `CONTOUR_TEMPLE_*` to those.
- **Impact:** `GRAPH.json.ownership.jointlyOwned` now lists those three functions for follow-up reconciliation by Partner B.

## 2026-04-23 (Partner A — Cursor)
- **Decision:** Drop nails to "Coming Soon". Remove from `ALL_CATS`, drop the `@mediapipe/hands` load path, drop nails from recommendations.
- **Rationale:** User asked to ship without nail try-on. Hands engine adds load weight + tracking issues; pulling it removes a category of bugs.
- **Impact:** `app/try-on/page.tsx` no longer instantiates `Hands`, `renderNails` is unused but kept in engine for future. ProfileCard never surfaces nails.

## 2026-04-23 (Partner A — Cursor)
- **Decision:** Restructure try-on into a gated narrative flow: `idle → scanning → curating → showingProfile → playing`.
- **Rationale:** User asked for "recommendation first" with scan + waiting screen. Picked the gated option.
- **Impact:** New `CuratingOverlay` component, ProfileCard lifts to a hero slot above the preview, controls panel dims/disables during `scanning` and `curating`.

## 2026-04-23 (Partner A — Cursor)
- **Decision:** Start the requested page split by introducing `PreviewStage`, `ControlsPanel`, `SourceSelector`, and `LayerDetail` subcomponent boundaries in `app/try-on/page.tsx`.
- **Rationale:** The page is still large, so first pass prioritizes explicit boundaries with zero behavior risk before deeper extraction into separate modules.
- **Impact:** Render tree now has named segmentation points, reducing future refactor risk and making continued extraction work straightforward.

## 2026-04-23 (Partner A — Cursor) — try-on overhaul (post-user-feedback)
- **Decision:** User-initiated scan. `buildDefaultLayers()` returns every layer `active: false`, the face-detection render loop no longer auto-triggers `setFlowStage("scanning")`, and a new `ScanCTA` component floats over the stage once `faceDetected && flowStage === "idle"`.
- **Rationale:** User reported: "the scan starts immediately as the page is opened … it also has the filters pre-applied. It should wait for scanning then give the recommendation and then apply when user clicks." This flips the default to fully opt-in.
- **Impact:** Users land on `/try-on`, camera opens, face locks, and they see a sweet "Let us find your perfect look" prompt with a "Scan my face" button. Nothing paints on the face until they apply a recommendation or manually toggle.

## 2026-04-23 (Partner A — Cursor) — cross-ownership edit (v2)
- **Decision:** Rewrite `renderContour` (claude-owned in `GRAPH.json`) from stroked smoothed paths to two stacked wide strokes under `ctx.filter = blur(...)` plus a screen-blended highlight pass on forehead / nose bridge / nose tip / chin / cheekbone tops.
- **Rationale:** User feedback: *"the countour is like a thick draw line instead of feeling like actual countour its just hand drawn borders or lines which look totally artificial"*. Stroked smoothed paths, even at low alpha, will always read as drawn lines because the falloff is perpendicular to the stroke and the alpha is uniform along it. The industry-standard approach is a soft-edge area shadow + a separate highlight pass. We get the soft-edge area cheaply by stacking two wide strokes inside a canvas `filter: blur(N)` — the result is a blurred band whose edges dissolve into skin.
- **Scope of edit:** `lib/tryon-engine.ts::renderContour` fully rewritten. `app/try-on/page.tsx::applyPortraitLayers` contour block rewritten to match (model mode). `GRAPH.json.ownership.jointlyOwned` already lists `renderContour`; no change needed.
- **Impact:** Contour now reads as a sculpted plane shadow plus highlights, not as drawn jaw/temple lines. Highlight alpha scales with `intensity`, so low-intensity contour remains subtle.

## 2026-04-23 (Partner A — Cursor) — eyeliner close-range detection
- **Decision:** Lower MediaPipe FaceMesh `minDetectionConfidence` + `minTrackingConfidence` from `0.5` → `0.3`.
- **Rationale:** User: "the eye liner is not able to detect the face yet in when the camera is closer". MediaPipe's short-range face detector loses confidence when the face fills >60 % of the frame (the eye detector the eyeliner renderer relies on is downstream of this). 0.3 keeps the detector alive at close range without meaningfully increasing false positives at normal distance.
- **Impact:** Eyeliner (and every other renderer) now tracks at close-up. Eyeliner EMA smoothing + thickness clamp from the prior session remain unchanged.

## 2026-04-23 (Partner A — Cursor) — responsive UI overhaul
- **Decision:** Rebuild the try-on layout for a mobile-first + desktop-polished experience (MAC / Sephora / Revieve reference patterns). Desktop: sticky controls panel with card elevation, icon-based source tabs, larger shade swatches (52 px). Phone (≤ 640 px): full-bleed stage, horizontal-scroll shade and layer strips with snap, sticky bottom action bar with safe-area padding, 44 px min touch targets.
- **Rationale:** User: *"the website ui isnt optimised everything is all over the place please fix it … make it mobile friendly and fully responsive"*. Single 900 px breakpoint + wrapping grids was insufficient.
- **Scope of edit:** `styles/globals.css` (added `.tryon-scan-cta`, `.tryon-controls-header`, rewrote `.tryon-source`, widened `.tryon-shade-grid`, added 900 px + 640 px responsive blocks, sticky action bar with `env(safe-area-inset-bottom)`). `app/try-on/page.tsx` (source selector now has inline SVG icons + label text; controls panel has a header with title + "Live preview" eyebrow).
- **Impact:** Desktop feels like a studio; phone feels like the Sephora / MAC try-on app — stage up top, scrollable shade strip, sticky Apply bar.
