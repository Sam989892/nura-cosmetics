# Collaboration Plan

Last updated: 2026-04-22 (Partner B — Claude, cavemen mode)

## New Priorities (user-driven this session)

1. Broken try-on UX — rebuild.
2. Face-scan loading sequence on entry.
3. Auto-recommend Nura products based on detected skin tone, undertone, face shape.
4. Fix non-working features: lipgloss, eyeliner, eyeshadow, contour, nails. Keep lipstick + blush logic intact.
5. Log plan + decisions for Cursor (Partner A).

## Root-cause of "not working" features (from code inspection + research)

- Eyeliner left eye: `EYELINER_L = [33,...,133]` walks outer → inner. Wing extrapolation uses `last-prev` → wings *inward* at nose bridge. Right eye is correct (inner → outer). Fix: reverse `EYELINER_L` to match right-eye direction.
- Eyeshadow crease gradient: alpha ramps 0 at top → 1 at bottom. Real eyeshadow is strongest in crease (top). Fix: flip stops.
- Contour temple strip: `CONTOUR_TEMPLE_L = [234, 93, 132, 58]` points are mid-cheek to lower jaw, not temple. Fix: use hairline indices near temple (`234, 127, 162, 21, 54, 103`) or derive from cheekbone → temple vector.
- Nails: MediaPipe Hands landmarks are correct; render anchor uses DIP→TIP axis. Known issue is visibility gate fails when hand rotates. Add per-finger z-depth gate + reduce threshold.
- Lipgloss: three stacked white strokes + blur pile up; reads as white smear, not sheen. Reduce alphas and drop the widest pass.

## Research notes

- MediaPipe refine_landmarks=true → 478 points; iris 468-477. Already enabled.
- Face-shape inference: compute ratios (face width / face height), jaw width / cheekbone width, forehead width / face width. Classify into oval/round/square/heart/long. Confidence low but viable heuristic.
- Undertone classifier in engine already usable.

## Scan-sequence spec

- 2-3 second overlay with animated mesh + ring while FaceMesh warms up.
- Stages: `detect` → `analyze` → `match`.
- On complete, show a floating "Your Profile" card with: tone, undertone, face shape, top-3 recommended products.

## Execution Plan

- [NOW] Write GRAPH.json nodes, DECISIONS.md entries, TASKS updates.
- [NOW] Patch `lib/tryon-engine.ts`: flip `EYELINER_L`, flip eyeshadow crease gradient, fix `CONTOUR_TEMPLE_L`, dial down lipgloss, add `detectFaceShape()` and `buildRecommendations()`.
- [NOW] Patch `app/try-on/page.tsx`: add `FaceScanOverlay`, `ProfileCard` component, wire face-shape detection post-first-lock, wire recommendations into `tryon-layer-detail`.
- [SOON] Visual regression + tsc + lint.
- [LATER] Replace emoji chip icons with SVG, refactor the 2.5k-line page into ~4 subcomponents.

## Conflict-avoidance protocol for Cursor handoff

- All engine changes additive or in clearly-marked blocks. No rename of existing exports.
- New components are new files under `app/try-on/_components/` so Cursor edits to the main page won't conflict.
- GRAPH.json appended only; DECISIONS.md entries time-stamped.
