# Cavemen Notes (terse session log — Partner B / Claude)

Working style for this session: short sentences, no filler, run tools, show result.

## Root causes (pin these)

- EYELINER_L reversed → wing points inward. Flip to [133,...,33].
- Eyeshadow crease gradient stops inverted. Top should be 1.0, bottom 0.
- CONTOUR_TEMPLE_L points at cheek/jaw, not temple. Re-anchor to hairline indices.
- Lipgloss three-pass sheen stacks too hot. Drop widest pass; cut alphas by 40%.
- Nails depth gate too strict. Widen threshold; skip fingers with z > 0.25.

## Scan flow

1. Enter try-on → overlay with animated ring + mesh scan.
2. 3 stages: "Detecting face…" → "Analyzing skin & structure…" → "Matching your products".
3. On ready, slide in ProfileCard (tone, undertone, shape, top 3 recs).

## Face-shape heuristic

- Ratios off FaceMesh landmarks (already present):
  - faceW = |x454 - x234|, faceH = |y152 - y10|
  - jawW  = |x172 - x397|
  - cheekW = |x234 - x454| (same as faceW, use as baseline)
  - forehead = |x21 - x251|
- Classify:
  - faceH / faceW > 1.35 → long/oval
  - faceH / faceW < 1.1  → round (if jawW/cheekW > 0.85) or square (else)
  - forehead > jawW * 1.2 → heart
  - fallback → oval

## Recommendation rules

- Pick one product per category from `products[]`.
- Score = tone match (+3) + undertone match (+2) + face-shape tag match (+2) + occasion=everyday (+1).
- Return top-3 by score.

## What Cursor should avoid doing concurrently

- Don't touch `lib/tryon-engine.ts` LIP_* / BLUSH_* constants while this session runs.
- Don't edit `app/try-on/page.tsx` layer-switch statements; new components are additive.
