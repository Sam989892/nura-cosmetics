// NURA Try-On Engine v3
// ---------------------
// Render realistic makeup on a face/hand canvas. Each category renders from
// a small set of research-backed rules captured in docs/MAKEUP_ANALYSIS.md.
//
// v3 changes (driven by the makeup analysis report):
//   - renderLipstick supports five finishes: matte / satin / glossy / sheer / shimmer
//   - renderBlush supports placement (apples / lifted / diffused) + formula (cream / powder)
//   - renderContour now paints a paired highlight (forehead, nose bridge, cheekbones,
//     cupid's bow, chin) so contour reads as light/shadow, not just shadow
//   - renderEyeshadow optionally paints a transition + outer-V + inner-corner highlight
//   - renderEyeliner supports tightline / winged / smudged styles
//   - renderNails supports glossy / matte / shimmer finishes
//   - new detectUndertone() returns "warm" | "cool" | "neutral"
//   - new applyUndertoneShift() nudges a hex toward the substrate's undertone

export type Point = { x: number; y: number };
export type LipFinish = "matte" | "satin" | "glossy" | "sheer" | "shimmer";
export type BlushPlacement = "apples" | "lifted" | "diffused";
export type BlushFormula = "cream" | "powder";
export type EyelinerStyle = "winged" | "tightline" | "smudged";
export type NailFinish = "glossy" | "matte" | "shimmer";
export type Undertone = "warm" | "cool" | "neutral";
export type SkinDepth = "fair" | "light" | "medium" | "tan" | "deep";

export type Shade = {
  name: string;
  hex: string;
  finish?: LipFinish | NailFinish | string;
  recommendedFor?: string[];
  recommendedUndertone?: Undertone;
};

// ──────────────────────────────────────────────────────────────────────────────
// Landmark index clusters (MediaPipe FaceMesh 468-point topology)
// ──────────────────────────────────────────────────────────────────────────────

export const LIP_OUTER = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
  291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
];
export const LIP_INNER = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324,
  308, 415, 310, 311, 312, 13, 82, 81, 80, 191,
];

// Anatomical sub-paths walking along the bottom and top lips, paired in the
// same x-order as their inner counterparts so we can build a midline by
// averaging matched indices.  Used by renderLipgloss for a sheen band that
// follows the lip's actual curve (instead of a centred radial catchlight).
export const LIP_LOWER_OUTER = [146, 91, 181, 84, 17, 314, 405, 321, 375];
export const LIP_LOWER_INNER = [95, 88, 178, 87, 14, 317, 402, 318, 324];
export const LIP_UPPER_OUTER = [185, 40, 39, 37, 0, 267, 269, 270, 409];
export const LIP_UPPER_INNER = [191, 80, 81, 82, 13, 312, 311, 310, 415];

export const BLUSH_L_APPLE = [50, 101, 118, 117, 123, 147];
export const BLUSH_R_APPLE = [280, 330, 347, 346, 352, 376];
// Lifted placement targets the upper cheekbone + outer eye area.
export const BLUSH_L_LIFTED = [205, 50, 117, 118, 119, 100];
export const BLUSH_R_LIFTED = [425, 280, 346, 347, 348, 329];

export const CONTOUR_JAW_L = [172, 136, 150, 149, 176, 148, 152];
export const CONTOUR_JAW_R = [397, 365, 379, 378, 400, 377, 152];
// Cheekbone (zygomatic-arch) stripe — walks from the ear/temple anchor
// down along the cheekbone ridge toward mid-cheek. This is where contour
// actually sits. Previous CONTOUR_TEMPLE_* indices walked the hairline
// across the forehead, which painted a band on the brow instead of the
// cheekbone.
export const CONTOUR_CHEEKBONE_L = [234, 227, 116, 117, 118, 101, 36];
export const CONTOUR_CHEEKBONE_R = [454, 447, 345, 346, 347, 330, 266];
// Back-compat aliases. Old name retained so any existing imports keep
// working; both point to the cheekbone path now.
export const CONTOUR_TEMPLE_L = CONTOUR_CHEEKBONE_L;
export const CONTOUR_TEMPLE_R = CONTOUR_CHEEKBONE_R;

// LID polygon uses only the upper lash line landmarks (same as EYELINER_L/R).
// As a closed polygon the curved lash line seals into a narrow crescent just
// above the lash — it does NOT cover the iris and does NOT cover the brow.
// The CREASE gradient (rendered on top) provides the broader lid coverage.
//
// Previous attempts:
//   v1: included lower-lash-line landmarks → covered the entire iris (broken).
//   v2: used landmarks 221–226 / 441–446 → those sit at brow level (broken).
//   v3: used crease bottom-edge 196/197/130 → still at crease/brow level (broken).
export const EYESHADOW_L_LID = [133, 173, 157, 158, 159, 160, 161, 246, 33];
export const EYESHADOW_L_CREASE = [70, 63, 105, 66, 107, 55, 193, 122, 196, 197, 173, 33, 130, 247, 30, 29];
export const EYESHADOW_R_LID = [362, 398, 384, 385, 386, 387, 388, 466, 263];
export const EYESHADOW_R_CREASE = [300, 293, 334, 296, 336, 285, 417, 351, 419, 196, 466, 263, 359, 467, 260, 259];

// Walk inner → outer so wing extrapolation at the last point lands at
// the temple end of the lash line (outer canthus). Left-eye previously
// walked outer → inner, which flicked the wing *toward* the nose.
export const EYELINER_L = [133, 173, 157, 158, 159, 160, 161, 246, 33];
export const EYELINER_R = [362, 398, 384, 385, 386, 387, 388, 466, 263];
export const LOWER_LINE_L = [133, 155, 154, 153, 145, 144, 163, 7, 33];
export const LOWER_LINE_R = [362, 382, 381, 380, 374, 373, 390, 249, 263];

export const FINGER_TIPS = [4, 8, 12, 16, 20];
export const FINGER_DIPS = [3, 7, 11, 15, 19];
export const FINGER_PIPS = [2, 6, 10, 14, 18];

// ──────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g)
    .toString(16)
    .padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

export function toPx(p: { x: number; y: number }, w: number, h: number): Point {
  return { x: p.x * w, y: p.y * h };
}

function centroid(pts: Point[]): Point {
  const s = pts.reduce(
    (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
    { x: 0, y: 0 }
  );
  return { x: s.x / pts.length, y: s.y / pts.length };
}

function smoothPath(ctx: CanvasRenderingContext2D, pts: Point[], closed = false) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  if (closed) ctx.closePath();
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Point[]) {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

/**
 * isStripeVisible — head-pose visibility gate for landmark sub-paths.
 *
 * MediaPipe FaceMesh keeps emitting landmarks for occluded sides of the head
 * (it tracks the canonical 468-point mesh even when those points are behind
 * the face from the camera's POV). Every landmark also carries a `z` depth
 * roughly normalised to the same scale as `x`/`y`, with the nose tip near
 * `z ≈ 0` and points behind the head deeper (more positive).
 *
 * We treat a stripe as hidden when the average depth of its anchor points
 * sits more than `threshold` deeper than the nose tip — that's the typical
 * delta when a cheek / temple / eye rotates behind the head plane.  Skipping
 * those stripes prevents the "stroke painted in mid-air" artefacts the user
 * reported (jaw and eyeshadow bleeding into empty space on a turned head).
 */
export function isStripeVisible(
  landmarks: Point[],
  indices: number[],
  threshold = 0.08
): boolean {
  // Cast through `any` because our `Point` type only carries x/y for the rest
  // of the engine — MediaPipe actually hands us {x,y,z,visibility?}.
  const lm = landmarks as unknown as Array<{ z?: number }>;
  const noseZ = typeof lm[1]?.z === "number" ? (lm[1].z as number) : 0;
  let sum = 0;
  let n = 0;
  for (const i of indices) {
    const z = lm[i]?.z;
    if (typeof z === "number") {
      sum += z;
      n++;
    }
  }
  if (n === 0) return true;
  return sum / n - noseZ < threshold;
}

/** Deterministic 0..1 PRNG used for shimmer specks (stable across frames). */
function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Shift a hex shade slightly toward / away from the substrate undertone so a
 * cool shade on a warm lip reads ~1 step warmer (and vice versa). The shift
 * is small (≤5%) — enough for the preview to feel honest, never enough to
 * change the displayed swatch's character.
 */
export function applyUndertoneShift(
  hex: string,
  shadeUndertone: Undertone | undefined,
  substrate: Undertone | null
): string {
  if (!shadeUndertone || !substrate || shadeUndertone === substrate) return hex;
  const [r, g, b] = hexToRgb(hex);
  // Cool substrate biases pigments cooler (more blue, less red).
  if (substrate === "cool") return rgbToHex(r * 0.97, g * 1.0, b * 1.05);
  if (substrate === "warm") return rgbToHex(r * 1.05, g * 1.0, b * 0.95);
  return hex;
}

// ──────────────────────────────────────────────────────────────────────────────
// Lipstick — five finishes
// ──────────────────────────────────────────────────────────────────────────────

function paintLipBase(
  ctx: CanvasRenderingContext2D,
  outer: Point[],
  inner: Point[],
  hex: string,
  alpha: number
) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) ctx.lineTo(outer[i].x, outer[i].y);
  ctx.closePath();
  ctx.moveTo(inner[0].x, inner[0].y);
  for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
  ctx.closePath();
  ctx.fill("evenodd");
  ctx.restore();
}

function paintLipHighlight(
  ctx: CanvasRenderingContext2D,
  outer: Point[],
  size: "tight" | "broad",
  alpha: number
) {
  const c = centroid(outer);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = alpha;
  const radius = size === "tight" ? 32 : 64;
  const grad = ctx.createRadialGradient(c.x, c.y - 2, 2, c.x, c.y, radius);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.3)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  fillPoly(ctx, outer);
  ctx.restore();
}

function paintLipShimmer(
  ctx: CanvasRenderingContext2D,
  outer: Point[],
  inner: Point[],
  intensity: number
) {
  const rand = seededRand(0xa57c | Math.floor(intensity * 100));
  const minX = Math.min(...outer.map((p) => p.x));
  const maxX = Math.max(...outer.map((p) => p.x));
  const minY = Math.min(...outer.map((p) => p.y));
  const maxY = Math.max(...outer.map((p) => p.y));
  const innerMinY = Math.min(...inner.map((p) => p.y));
  const innerMaxY = Math.max(...inner.map((p) => p.y));

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 28; i++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);
    if (y > innerMinY && y < innerMaxY) continue;
    const r = 0.5 + rand() * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderLipstick(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  w: number,
  h: number,
  shade: Shade,
  intensity: number,
  finish: LipFinish = "satin",
  substrateUndertone: Undertone | null = null
) {
  const outer = LIP_OUTER.map((i) => toPx(landmarks[i], w, h));
  const inner = LIP_INNER.map((i) => toPx(landmarks[i], w, h));

  const hex = applyUndertoneShift(
    shade.hex,
    shade.recommendedUndertone,
    substrateUndertone
  );

  switch (finish) {
    case "matte":
      paintLipBase(ctx, outer, inner, hex, 0.5 + intensity * 0.45);
      return;
    case "satin":
      paintLipBase(ctx, outer, inner, hex, 0.45 + intensity * 0.45);
      paintLipHighlight(ctx, outer, "broad", 0.18 + intensity * 0.12);
      return;
    case "glossy":
      paintLipBase(ctx, outer, inner, hex, 0.45 + intensity * 0.45);
      paintLipHighlight(ctx, outer, "tight", 0.35 + intensity * 0.2);
      return;
    case "sheer":
      paintLipBase(ctx, outer, inner, hex, 0.25 + intensity * 0.25);
      paintLipHighlight(ctx, outer, "broad", 0.16 + intensity * 0.12);
      return;
    case "shimmer":
      paintLipBase(ctx, outer, inner, hex, 0.45 + intensity * 0.4);
      paintLipHighlight(ctx, outer, "tight", 0.3 + intensity * 0.2);
      paintLipShimmer(ctx, outer, inner, intensity);
      return;
  }
}

/**
 * renderLipgloss — sheer pigment wash + lower-lip sheen band that follows
 * the lip's actual curvature.  We deliberately avoid a centred radial
 * catchlight here — real gloss never reads as a hot circle in the middle
 * of the lips.  Instead light traces the convex lower-lip line as a thin
 * elongated highlight, with a much fainter accent along the upper lip.
 */
export function renderLipgloss(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  w: number,
  h: number,
  shade: Shade,
  intensity: number,
  _substrateUndertone: Undertone | null = null
) {
  void _substrateUndertone;

  const outer = LIP_OUTER.map((i) => toPx(landmarks[i], w, h));
  const inner = LIP_INNER.map((i) => toPx(landmarks[i], w, h));
  const lowerOuter = LIP_LOWER_OUTER.map((i) => toPx(landmarks[i], w, h));
  const lowerInner = LIP_LOWER_INNER.map((i) => toPx(landmarks[i], w, h));
  const upperOuter = LIP_UPPER_OUTER.map((i) => toPx(landmarks[i], w, h));
  const upperInner = LIP_UPPER_INNER.map((i) => toPx(landmarks[i], w, h));

  const minX = Math.min(...outer.map((p) => p.x));
  const maxX = Math.max(...outer.map((p) => p.x));
  const minY = Math.min(...outer.map((p) => p.y));
  const maxY = Math.max(...outer.map((p) => p.y));
  const lipWidth = maxX - minX;
  const lipHeight = maxY - minY;
  if (lipWidth < 4 || lipHeight < 4) return;

  // 1. Sheer pigment wash — much lighter than lipstick so the lip's own
  // colour and shadow show through.
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.2 + intensity * 0.3;
  ctx.fillStyle = shade.hex;
  ctx.beginPath();
  ctx.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) ctx.lineTo(outer[i].x, outer[i].y);
  ctx.closePath();
  ctx.moveTo(inner[0].x, inner[0].y);
  for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
  ctx.closePath();
  ctx.fill("evenodd");
  ctx.restore();

  // 2. Discrete specular highlights — replaces the previous stroked sheen
  // band, which read as a literal white "strip" across the lower lip.
  // Real gloss catches light at the convex points: lower-lip apex (center
  // of the lower curve) and the two cupid's-bow lobes on the upper lip.
  // Each is a soft radial gradient that fades to zero, blended with
  // `screen` so it brightens the wash without overwriting it. Clipped to
  // the lip polygon so blur never spills onto the chin.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) ctx.lineTo(outer[i].x, outer[i].y);
  ctx.closePath();
  ctx.clip();

  ctx.globalCompositeOperation = "screen";

  const cx = (minX + maxX) / 2;

  // Lower-lip apex — slightly above the geometric mid of the lower lip.
  const lowerApex: Point = {
    x: cx,
    y: (lowerOuter[Math.floor(lowerOuter.length / 2)].y +
        lowerInner[Math.floor(lowerInner.length / 2)].y) / 2 - lipHeight * 0.05,
  };
  const lowerR = Math.max(6, lipWidth * 0.18);

  ctx.globalAlpha = 0.18 + intensity * 0.22;
  let g = ctx.createRadialGradient(
    lowerApex.x, lowerApex.y, 0,
    lowerApex.x, lowerApex.y, lowerR
  );
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(lowerApex.x, lowerApex.y, lowerR, 0, Math.PI * 2);
  ctx.fill();

  // Cupid's-bow lobes — two small highlights flanking the philtrum.
  const upperMidIdx = Math.floor(upperOuter.length / 2);
  const upperLineY =
    (upperOuter[upperMidIdx].y + upperInner[upperMidIdx].y) / 2 +
    lipHeight * 0.04;
  const lobeOffset = lipWidth * 0.13;
  const lobeR = Math.max(4, lipWidth * 0.09);

  ctx.globalAlpha = 0.12 + intensity * 0.14;
  for (const lobeX of [cx - lobeOffset, cx + lobeOffset]) {
    g = ctx.createRadialGradient(lobeX, upperLineY, 0, lobeX, upperLineY, lobeR);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.55, "rgba(255,255,255,0.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lobeX, upperLineY, lobeR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  void upperOuter; void upperInner;
}

// ──────────────────────────────────────────────────────────────────────────────
// Blush — placement + formula
// ──────────────────────────────────────────────────────────────────────────────

function paintBlushRadial(
  ctx: CanvasRenderingContext2D,
  c: Point,
  rx: number,
  ry: number,
  rotation: number,
  hex: string,
  alpha: number,
  blend: GlobalCompositeOperation
) {
  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha = alpha;
  ctx.translate(c.x, c.y);
  ctx.rotate(rotation);
  const g = ctx.createRadialGradient(0, 0, rx * 0.05, 0, 0, rx);
  g.addColorStop(0, hex);
  g.addColorStop(0.55, hex + "99");
  g.addColorStop(1, hex + "00");
  ctx.fillStyle = g;
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderBlush(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  w: number,
  h: number,
  shade: Shade,
  intensity: number,
  placement: BlushPlacement = "apples",
  formula: BlushFormula = "cream"
) {
  const faceWidth = Math.abs(landmarks[454].x - landmarks[234].x) * w;
  const blend: GlobalCompositeOperation =
    formula === "cream" ? "soft-light" : "multiply";
  const baseAlpha =
    formula === "cream" ? 0.6 + intensity * 0.35 : 0.35 + intensity * 0.35;

  switch (placement) {
    case "apples": {
      const lC = centroid(BLUSH_L_APPLE.map((i) => toPx(landmarks[i], w, h)));
      const rC = centroid(BLUSH_R_APPLE.map((i) => toPx(landmarks[i], w, h)));
      const rx = faceWidth * 0.2;
      const ry = faceWidth * 0.16;
      paintBlushRadial(ctx, lC, rx, ry, 0, shade.hex, baseAlpha, blend);
      paintBlushRadial(ctx, rC, rx, ry, 0, shade.hex, baseAlpha, blend);
      return;
    }
    case "lifted": {
      const lC = centroid(BLUSH_L_LIFTED.map((i) => toPx(landmarks[i], w, h)));
      const rC = centroid(BLUSH_R_LIFTED.map((i) => toPx(landmarks[i], w, h)));
      const rx = faceWidth * 0.22;
      const ry = faceWidth * 0.11;
      paintBlushRadial(ctx, lC, rx, ry, -0.25, shade.hex, baseAlpha, blend);
      paintBlushRadial(ctx, rC, rx, ry, 0.25, shade.hex, baseAlpha, blend);
      return;
    }
    case "diffused": {
      const lC = centroid(BLUSH_L_APPLE.map((i) => toPx(landmarks[i], w, h)));
      const rC = centroid(BLUSH_R_APPLE.map((i) => toPx(landmarks[i], w, h)));
      const noseBridge = toPx(landmarks[6], w, h);
      const rx = faceWidth * 0.24;
      const ry = faceWidth * 0.14;
      const a = baseAlpha * 0.6;
      paintBlushRadial(ctx, lC, rx, ry, -0.1, shade.hex, a, blend);
      paintBlushRadial(ctx, rC, rx, ry, 0.1, shade.hex, a, blend);
      paintBlushRadial(
        ctx,
        noseBridge,
        rx * 0.7,
        ry * 0.7,
        0,
        shade.hex,
        a * 0.7,
        blend
      );
      return;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Contour — jaw + temple multiply strokes. No nose strip, no highlight pass;
// those caused stray bright/dark lines when the underlying landmarks drifted.
// This is the v2 behaviour.
// ──────────────────────────────────────────────────────────────────────────────

// Contour v4 — refined from v3.
//
// v3 was already blurred-stroke + highlight (no more "hand-drawn border"
// look) but had three remaining tells:
//   (a) Shade was used raw. If the swatch was a rosy brown it produced
//       pink cheeks instead of shadow. Real contour is desaturated toward
//       cool brown.
//   (b) Halo + core stroked on the same path stacked the multiply alpha
//       and crushed the cheekbone dark enough to read as a bruise on
//       deeper skin tones.
//   (c) The blurred stroke had no clip — at extreme head tilt the blur
//       bled into hair / background. Face-oval clip fixes that.
//
// This rewrite:
//   1. Converts `shade.hex` to a contour-appropriate tone
//      (desaturate + darken) before stroking.
//   2. Replaces the halo+core stack with a single wide blurred pass plus
//      a thin "definition" pass under it — same darkness, half the
//      alpha pile-up.
//   3. Clips the shadow pass to a face-oval polygon so blur doesn't
//      leak.
//   4. Weights cheekbone heavier than jaw (real contour convention).
//   5. Scales highlight intensity with contour intensity (low intensity
//      = almost no highlight so light makeup doesn't look wet).

// Face-oval FaceMesh ring, clockwise. Used as a clip to contain the
// blurred contour shadow within skin.
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

// Pull a darkened, skin-ward-desaturated version of a shade for use as
// contour pigment. Without this, a warm-nude swatch looks pink on cheeks.
export function toContourHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  // Luminance-preserving desaturation toward cool brown, then 15% darker.
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const deSat = 0.55;
  const dr = r * (1 - deSat) + gray * deSat;
  const dg = g * (1 - deSat) + gray * deSat;
  const db = b * (1 - deSat) + gray * deSat;
  // Nudge warm-brown: more red than blue.
  const warm = 0.93;
  return rgbToHex(dr * warm, dg * warm * 0.96, db * warm * 0.88);
}

export function renderContour(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  w: number,
  h: number,
  shade: Shade,
  intensity: number,
  _unusedWithHighlight = false
) {
  void _unusedWithHighlight;
  const faceWidth = Math.abs(landmarks[454].x - landmarks[234].x) * w;
  if (faceWidth <= 0) return;

  // Blur scales with face size so softness feels the same at any distance.
  const blurPx = Math.max(5, faceWidth * 0.032);
  // One wide stroke (plane shadow) + one narrow definition stroke.
  const shadowW = faceWidth * 0.16;
  const defW = faceWidth * 0.06;

  // Alpha is lower overall than v3 to avoid cheek-crush on deeper skin.
  const baseAlpha = 0.14 + intensity * 0.22;

  const jawLVis = isStripeVisible(landmarks, CONTOUR_JAW_L);
  const jawRVis = isStripeVisible(landmarks, CONTOUR_JAW_R);
  const cheekLVis = isStripeVisible(landmarks, CONTOUR_CHEEKBONE_L);
  const cheekRVis = isStripeVisible(landmarks, CONTOUR_CHEEKBONE_R);

  const contourHex = toContourHex(shade.hex);

  // Face-oval clip — keeps blur from bleeding off the face.
  ctx.save();
  ctx.beginPath();
  const ovalPts = FACE_OVAL.map((i) => toPx(landmarks[i], w, h));
  ctx.moveTo(ovalPts[0].x, ovalPts[0].y);
  for (let i = 1; i < ovalPts.length; i++) ctx.lineTo(ovalPts[i].x, ovalPts[i].y);
  ctx.closePath();
  ctx.clip();

  const drawBlurredStripe = (
    indices: readonly number[],
    width: number,
    alpha: number
  ) => {
    smoothPath(ctx, indices.map((i) => toPx(landmarks[i], w, h)));
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.stroke();
  };

  // Shadow pass — single wide, heavily blurred stroke. Reads as a plane
  // shadow, not a line.
  ctx.globalCompositeOperation = "multiply";
  ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
  ctx.strokeStyle = contourHex;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Cheekbone is the primary plane shadow (full strength).
  if (cheekLVis) drawBlurredStripe(CONTOUR_CHEEKBONE_L, shadowW, baseAlpha);
  if (cheekRVis) drawBlurredStripe(CONTOUR_CHEEKBONE_R, shadowW, baseAlpha);
  // Jaw is secondary (lighter). Real contour convention: cheekbone > jaw.
  if (jawLVis) drawBlurredStripe(CONTOUR_JAW_L, shadowW * 0.8, baseAlpha * 0.65);
  if (jawRVis) drawBlurredStripe(CONTOUR_JAW_R, shadowW * 0.8, baseAlpha * 0.65);

  // Definition pass — thinner, less blurred, anchors the darkest point
  // of the cheekbone without the line-like tell of a stroked path.
  ctx.filter = `blur(${(blurPx * 0.5).toFixed(2)}px)`;
  if (cheekLVis) drawBlurredStripe(CONTOUR_CHEEKBONE_L, defW, baseAlpha * 0.55);
  if (cheekRVis) drawBlurredStripe(CONTOUR_CHEEKBONE_R, defW, baseAlpha * 0.55);

  ctx.restore();

  // Highlight pass — gentle screen-blended white radials on convex
  // high points. Scale with intensity so a light contour doesn't
  // produce an unnaturally wet face.
  const hiAlpha = (0.12 + intensity * 0.22) * Math.min(1, intensity * 1.4);
  if (hiAlpha <= 0.01) return;

  const forehead = toPx(landmarks[10], w, h);
  const noseBridge = toPx(landmarks[168], w, h);
  const noseTip = toPx(landmarks[4], w, h);
  const chin = toPx(landmarks[152], w, h);
  const cheekTopL = toPx(landmarks[117], w, h);
  const cheekTopR = toPx(landmarks[346], w, h);

  const highlightR = faceWidth * 0.11;
  const highlightRNose = faceWidth * 0.05;

  const paintHighlight = (
    cx: number,
    cy: number,
    r: number,
    strength: number
  ) => {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(255,248,235,${strength.toFixed(3)})`);
    grad.addColorStop(1, "rgba(255,248,235,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  paintHighlight(forehead.x, forehead.y, highlightR * 1.1, hiAlpha * 0.9);
  paintHighlight(noseBridge.x, noseBridge.y, highlightRNose * 1.1, hiAlpha * 0.75);
  paintHighlight(noseTip.x, noseTip.y, highlightRNose * 0.85, hiAlpha * 0.6);
  paintHighlight(chin.x, chin.y, highlightR * 0.75, hiAlpha * 0.7);
  if (cheekLVis) paintHighlight(cheekTopL.x, cheekTopL.y, highlightR * 0.85, hiAlpha * 0.65);
  if (cheekRVis) paintHighlight(cheekTopR.x, cheekTopR.y, highlightR * 0.85, hiAlpha * 0.65);
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────────────────
// Eyeshadow — three-zone gradient + inner-corner cream highlight
// ──────────────────────────────────────────────────────────────────────────────

export function renderEyeshadow(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  w: number,
  h: number,
  shade: Shade,
  intensity: number,
  options: { transitionHex?: string; accentHex?: string; innerCorner?: boolean } = {}
) {
  const [r, g, b] = hexToRgb(shade.hex);

  // Perceived brightness — drives blend-mode and alpha selection.
  const brightness = (r + g + b) / (3 * 255);
  // lightMul: softens alpha for near-white shades.
  const lightMul = brightness <= 0.6 ? 1.0 : 1.0 - (brightness - 0.6) / 0.4 * 0.55;

  // Per-eye visibility — relaxed threshold for static photos.
  const lVis = isStripeVisible(landmarks, EYESHADOW_L_LID, 0.15);
  const rVis = isStripeVisible(landmarks, EYESHADOW_R_LID, 0.15);
  if (!lVis && !rVis) return;

  // ── Measurements ──────────────────────────────────────────────────────
  const faceH = Math.abs(landmarks[10].y - landmarks[152].y) * h;

  // Eye width per side — scales blur radius so it looks proportional at any crop.
  const lEyeW = Math.hypot(
    (landmarks[33].x - landmarks[133].x) * w,
    (landmarks[33].y - landmarks[133].y) * h
  );
  const rEyeW = Math.hypot(
    (landmarks[263].x - landmarks[362].x) * w,
    (landmarks[263].y - landmarks[362].y) * h
  );

  // Lid height: tight strip above the lash line (~3% face height).
  const lidH = Math.max(4, faceH * 0.032);

  // Crease height: capped at 45% of actual brow-to-lash distance per eye.
  // lm 159/386 = upper-lash midpoint, lm 66/296 = eyebrow midpoint.
  const lBrowDist = Math.abs(landmarks[159].y - landmarks[66].y) * h;
  const rBrowDist = Math.abs(landmarks[386].y - landmarks[296].y) * h;
  const lCreaseH = Math.min(Math.max(6, faceH * 0.052), lBrowDist * 0.45);
  const rCreaseH = Math.min(Math.max(6, faceH * 0.052), rBrowDist * 0.45);

  // ── Blend mode ────────────────────────────────────────────────────────
  // multiply: pigment shades — tints underlying skin realistically.
  // screen:   highlight/near-white — brightens lid without painting over it.
  const isHighlight = brightness > 0.72;
  const blendMode: GlobalCompositeOperation = isHighlight ? "screen" : "multiply";

  // ── Blur radii ────────────────────────────────────────────────────────
  // This is the single most important improvement over hard polygon fills.
  // Every production virtual-makeup system (OpenCV/MediaPipe Python) applies
  // a Gaussian blur to the mask before compositing — it is what makes shadows
  // look like soft powder instead of face paint.  We apply the blur at draw
  // time via ctx.filter so no offscreen canvas is needed.
  const lBlurLid    = Math.max(2, lEyeW * 0.065);
  const rBlurLid    = Math.max(2, rEyeW * 0.065);
  const lBlurCrease = Math.max(3, lEyeW * 0.11);
  const rBlurCrease = Math.max(3, rEyeW * 0.11);

  // ── Polygon builder ───────────────────────────────────────────────────
  const mkPoly = (lashIds: number[], offset: number): Point[] => {
    const lash  = lashIds.map((i) => toPx(landmarks[i], w, h));
    const upper = lash.map((p) => ({ x: p.x, y: p.y - offset }));
    return [...lash, ...upper.slice().reverse()];
  };

  // ── LID BASE ──────────────────────────────────────────────────────────
  // Tight polygon, blurred — soft solid colour strip on the eyelid.
  const drawLid = (lashIds: number[], height: number, blur: number, visible: boolean) => {
    if (!visible) return;
    ctx.save();
    (ctx as unknown as { filter: string }).filter = `blur(${blur.toFixed(1)}px)`;
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = (isHighlight ? 0.40 : 0.58) * (0.55 + intensity * 0.45) * lightMul;
    ctx.fillStyle = shade.hex;
    fillPoly(ctx, mkPoly(lashIds, height));
    ctx.restore();
  };
  drawLid(EYELINER_L, lidH, lBlurLid, lVis);
  drawLid(EYELINER_R, lidH, rBlurLid, rVis);

  // ── CREASE WASH ───────────────────────────────────────────────────────
  // Wider polygon + heavier blur + linear gradient fading upward.
  // Mimics the blended "transition shade" look.
  const transitionHex = options.transitionHex ?? shade.hex;
  const [tr, tg, tb] = hexToRgb(transitionHex);

  const drawCrease = (lashIds: number[], height: number, blur: number, visible: boolean) => {
    if (!visible) return;
    const poly = mkPoly(lashIds, height);
    const bot = poly.reduce((a, b2) => (a.y > b2.y ? a : b2));
    const top = poly.reduce((a, b2) => (a.y < b2.y ? a : b2));
    const grad = ctx.createLinearGradient(bot.x, bot.y, top.x, top.y);
    grad.addColorStop(0,    `rgba(${tr},${tg},${tb},1)`);
    grad.addColorStop(0.55, `rgba(${tr},${tg},${tb},0.3)`);
    grad.addColorStop(1,    `rgba(${tr},${tg},${tb},0)`);
    ctx.save();
    (ctx as unknown as { filter: string }).filter = `blur(${blur.toFixed(1)}px)`;
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = (isHighlight ? 0.20 : 0.35) * (0.5 + intensity * 0.5) * lightMul;
    ctx.fillStyle = grad;
    fillPoly(ctx, poly);
    ctx.restore();
  };
  drawCrease(EYELINER_L, lCreaseH, lBlurCrease, lVis);
  drawCrease(EYELINER_R, rCreaseH, rBlurCrease, rVis);

  // ── OUTER-V ACCENT ────────────────────────────────────────────────────
  if (options.accentHex) {
    const [ar, ag, ab] = hexToRgb(options.accentHex);
    ctx.save();
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = (0.35 + intensity * 0.25) * lightMul;
    ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`;
    for (const [visible, lashIds] of [[lVis, EYELINER_L], [rVis, EYELINER_R]] as Array<[boolean, number[]]>) {
      if (!visible) continue;
      const pts = lashIds.map((i) => toPx(landmarks[i], w, h));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo((pts[1] ?? pts[0]).x, (pts[1] ?? pts[0]).y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Inner-corner highlight intentionally omitted — visible as an artefact blob.

  void r; void g; void b;
}

// ──────────────────────────────────────────────────────────────────────────────
// Eyeliner — three styles
// ──────────────────────────────────────────────────────────────────────────────

// Temporal landmark cache for eyeliner — adaptive exponential moving
// average on the upper/lower lid index points. Adaptive, so small
// jitters get heavily smoothed (stable line at distance) while real
// motion passes through (no visible lag when the user looks around).
// Keyed by point index.
const EYELINER_EMA = new Map<number, Point>();

function smoothLidPoint(idx: number, fresh: Point): Point {
  const prev = EYELINER_EMA.get(idx);
  if (!prev) {
    EYELINER_EMA.set(idx, { ...fresh });
    return fresh;
  }
  // Adaptive alpha: delta < ~1 px per frame = jitter → heavy smoothing.
  // Large deltas = real motion → let it through.
  const dx = fresh.x - prev.x;
  const dy = fresh.y - prev.y;
  const d = Math.hypot(dx, dy);
  // alpha ∈ [0.18 .. 0.55]. 1 px delta → 0.22, 8 px → 0.55.
  const alpha = Math.min(0.55, 0.18 + d * 0.05);
  const blended: Point = {
    x: prev.x * (1 - alpha) + fresh.x * alpha,
    y: prev.y * (1 - alpha) + fresh.y * alpha,
  };
  EYELINER_EMA.set(idx, blended);
  return blended;
}

function lidPath(
  indices: number[],
  landmarks: Point[],
  w: number,
  h: number
): Point[] {
  // Smooth each landmark, then bias the path 1px down (toward the lash
  // line) so the stroke paints ON the lashes instead of floating above
  // them. The bias scales with face size so it stays visible at distance.
  const faceW = Math.abs(landmarks[454].x - landmarks[234].x) * w;
  const bias = Math.min(2.5, Math.max(0.6, faceW * 0.0035));
  return indices.map((i) => {
    const fresh = toPx(landmarks[i], w, h);
    const sm = smoothLidPoint(i, fresh);
    return { x: sm.x, y: sm.y + bias };
  });
}

// Eye aperture (0..1-ish) — ratio of lid opening to eye width. Drops
// toward 0 during a blink. Used to gate liner paint so the line doesn't
// collapse to a dash across closed lashes.
function eyeAperture(
  landmarks: Point[],
  w: number,
  h: number,
  side: "L" | "R"
): number {
  // Upper lid midpoint, lower lid midpoint, outer/inner corners.
  const topI = side === "L" ? 159 : 386;
  const botI = side === "L" ? 145 : 374;
  const outI = side === "L" ? 33 : 263;
  const innI = side === "L" ? 133 : 362;
  const top = toPx(landmarks[topI], w, h);
  const bot = toPx(landmarks[botI], w, h);
  const out = toPx(landmarks[outI], w, h);
  const inn = toPx(landmarks[innI], w, h);
  const vertical = Math.hypot(top.x - bot.x, top.y - bot.y);
  const horizontal = Math.hypot(out.x - inn.x, out.y - inn.y);
  if (horizontal <= 0.001) return 0;
  return vertical / horizontal;
}

export function renderEyeliner(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  w: number,
  h: number,
  shade: Shade,
  intensity: number,
  style: EyelinerStyle = "winged"
) {
  const faceWidth = Math.abs(landmarks[454].x - landmarks[234].x) * w;
  // Clamp into a sane pixel band. At close range a raw 0.008 multiplier
  // bloats the line into a slab; at long range it collapses below 1 px and
  // disappears.
  const baseThickness = Math.min(
    Math.max(1.0, faceWidth * 0.008),
    4.5
  );

  // Per-eye blink gate — if aperture drops below ~0.12, the eye is
  // mid-blink and we skip painting it. Prevents the liner from
  // collapsing into a dash across closed lashes.
  const apL = eyeAperture(landmarks, w, h, "L");
  const apR = eyeAperture(landmarks, w, h, "R");
  const BLINK = 0.14;
  const lOpen = apL > BLINK;
  const rOpen = apR > BLINK;

  // Use a relaxed threshold (0.15) so slightly pitched/tilted faces in
  // uploaded photos are not gated out. The 0.08 default is tuned for live
  // camera head-turn rejection, which is too strict for static photos.
  const lVis = isStripeVisible(landmarks, EYELINER_L, 0.15) && lOpen;
  const rVis = isStripeVisible(landmarks, EYELINER_R, 0.15) && rOpen;
  if (!lVis && !rVis) return;

  const visiblePairs = (lines: Array<[boolean, number[]]>) =>
    lines.filter(([v]) => v).map(([, idxs]) => idxs);

  if (style === "tightline") {
    // Tightline is cosmetically "between the lashes" — should read as a
    // hair-thin accent, never a slab. Clamp 0.6 .. 1.8 px.
    const thickness = Math.min(1.8, Math.max(0.6, baseThickness * 0.35 + intensity * 0.6));
    ctx.save();
    ctx.strokeStyle = shade.hex;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.75 + intensity * 0.2;
    ctx.lineWidth = thickness;
    for (const line of visiblePairs([
      [lVis, EYELINER_L],
      [rVis, EYELINER_R],
    ])) {
      smoothPath(ctx, lidPath(line, landmarks, w, h));
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (style === "smudged") {
    const thickness = baseThickness * 1.3 + intensity * baseThickness * 1.5;
    ctx.save();
    ctx.strokeStyle = shade.hex;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.55 + intensity * 0.3;
    (ctx as { filter?: string }).filter = "blur(2.2px)";
    ctx.lineWidth = thickness;
    for (const line of visiblePairs([
      [lVis, EYELINER_L],
      [rVis, EYELINER_R],
      [lVis, LOWER_LINE_L],
      [rVis, LOWER_LINE_R],
    ])) {
      smoothPath(ctx, lidPath(line, landmarks, w, h));
      ctx.stroke();
    }
    (ctx as { filter?: string }).filter = "none";
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = shade.hex;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = thickness * 0.55;
    for (const line of visiblePairs([
      [lVis, EYELINER_L],
      [rVis, EYELINER_R],
    ])) {
      smoothPath(ctx, lidPath(line, landmarks, w, h));
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Winged (default)
  const thickness = baseThickness + intensity * baseThickness * 1.5;

  // Wing tilt — derive the eye's own local "up" from the outer-corner →
  // inner-corner vector so the wing kicks up relative to the eye, not
  // relative to the canvas. Fixes head-tilt artifacts where the wing
  // looked horizontal on a tilted head.
  const localUp = (side: "L" | "R") => {
    const out = toPx(landmarks[side === "L" ? 33 : 263], w, h);
    const inn = toPx(landmarks[side === "L" ? 133 : 362], w, h);
    // Perpendicular to the eye axis, pointing "up" in the face frame.
    const dx = out.x - inn.x;
    const dy = out.y - inn.y;
    const len = Math.hypot(dx, dy) || 1;
    // Rotate 90° so it points up from the eye line; sign flips per side.
    const ux = -dy / len;
    const uy = dx / len;
    const sign = side === "L" ? 1 : -1;
    return { x: ux * sign, y: uy * sign };
  };

  ctx.save();
  ctx.strokeStyle = shade.hex;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.88 + intensity * 0.12;
  const entries: Array<[boolean, number[], "L" | "R"]> = [
    [lVis, EYELINER_L, "L"],
    [rVis, EYELINER_R, "R"],
  ];
  for (const [ok, line, side] of entries) {
    if (!ok) continue;
    const pts = lidPath(line, landmarks, w, h);
    ctx.lineWidth = thickness;
    smoothPath(ctx, pts);
    ctx.stroke();

    // Wing: anchor at the raw outer-corner landmark (no EMA lag) so the
    // wing origin sits exactly at the lash end regardless of smoothing.
    const outerIdx = side === "L" ? 33 : 263;
    const anchor = toPx(landmarks[outerIdx], w, h);
    const prev = pts[pts.length - 2];
    const dx = anchor.x - prev.x;
    const dy = anchor.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const nx = dx / len;
      const ny = dy / len;
      const up = localUp(side);
      // Blend 70% along-eye-axis + 30% up-in-eye-frame for a natural wing tilt.
      const wingLen = faceWidth * 0.025 * (0.5 + intensity * 0.5);
      const wx = (nx * 0.7 + up.x * 0.3) * wingLen;
      const wy = (ny * 0.7 + up.y * 0.3) * wingLen;
      ctx.beginPath();
      ctx.lineWidth = thickness * 0.85;
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(anchor.x + wx, anchor.y + wy);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (intensity > 0.5) {
    ctx.save();
    ctx.strokeStyle = shade.hex;
    ctx.lineCap = "round";
    ctx.globalAlpha = (intensity - 0.5) * 0.5;
    ctx.lineWidth = thickness * 0.5;
    for (const line of visiblePairs([
      [lVis, LOWER_LINE_L],
      [rVis, LOWER_LINE_R],
    ])) {
      smoothPath(ctx, lidPath(line, landmarks, w, h));
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Nails — three finishes
// ──────────────────────────────────────────────────────────────────────────────

export function renderNails(
  ctx: CanvasRenderingContext2D,
  hands: Point[][],
  w: number,
  h: number,
  shade: Shade,
  intensity: number,
  finish: NailFinish = "glossy"
) {
  ctx.save();
  for (const hand of hands) {
    // Hand reference scale — used to set a sane min/max nail size and to
    // skip nails when the finger projects too short to read (curled finger
    // or hand pointing straight at the camera).
    const wrist = toPx(hand[0], w, h);
    const middleMcp = toPx(hand[9], w, h);
    const handScale = Math.hypot(
      middleMcp.x - wrist.x,
      middleMcp.y - wrist.y
    );

    for (let fi = 0; fi < 5; fi++) {
      const tip = toPx(hand[FINGER_TIPS[fi]], w, h);
      const dip = toPx(hand[FINGER_DIPS[fi]], w, h);
      const pip = toPx(hand[FINGER_PIPS[fi]], w, h);

      // Use DIP→TIP as the nail axis (the actual distal phalanx).  PIP→TIP
      // was overshooting back into the middle phalanx, which made polish
      // look like it slid off the fingertip.
      const dx = tip.x - dip.x;
      const dy = tip.y - dip.y;
      const dipSegLen = Math.hypot(dx, dy);

      // Fall back to PIP→TIP only if DIP→TIP collapsed (rare projection
      // edge case where DIP and TIP overlap).
      const useFallback = dipSegLen < handScale * 0.18;
      const ax = useFallback ? tip.x - pip.x : dx;
      const ay = useFallback ? tip.y - pip.y : dy;
      const segLen = Math.hypot(ax, ay);

      // Skip when projected length is too small to read (curled or
      // pointing-at-camera finger). Threshold is relative to hand scale
      // so it works for hands close to and far from the camera.
      if (segLen < Math.max(6, handScale * 0.12)) continue;

      const ang = Math.atan2(ay, ax);
      // Nail covers ~80% of the distal phalanx, biased toward the tip so
      // it sits on the actual nail bed, not the knuckle.
      const nailLen = segLen * (useFallback ? 0.5 : 0.78);
      const nailWidth = nailLen * 0.55;
      // Anchor: 58% from DIP toward TIP (or PIP→TIP fallback) puts the
      // nail centre on the nail bed without overshooting the fingertip.
      const t = useFallback ? 0.72 : 0.55;
      const baseX = useFallback ? pip.x : dip.x;
      const baseY = useFallback ? pip.y : dip.y;
      const cx = baseX + ax * t;
      const cy = baseY + ay * t;

      ctx.save();
      ctx.translate(cx, cy);
      // Rotate so local +y axis (the ellipse's long axis) points from
      // cuticle toward tip — this also points the highlight gradient
      // (top half of ellipse) at the cuticle end, where light catches
      // a real nail's lunula.
      ctx.rotate(ang - Math.PI / 2);

      ctx.globalCompositeOperation = "multiply";
      const baseAlpha =
        finish === "matte"
          ? 0.77 + intensity * 0.28
          : 0.72 + intensity * 0.28;
      ctx.globalAlpha = baseAlpha;
      ctx.fillStyle = shade.hex;
      ctx.beginPath();
      ctx.ellipse(0, 0, nailWidth / 2, nailLen / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (finish !== "matte") {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.38;
        const hi = ctx.createLinearGradient(0, -nailLen / 2, 0, 0);
        hi.addColorStop(0, "rgba(255,255,255,0.9)");
        hi.addColorStop(0.45, "rgba(255,255,255,0.3)");
        hi.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = hi;
        ctx.beginPath();
        ctx.ellipse(0, 0, nailWidth / 2, nailLen / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (finish === "shimmer") {
        const rand = seededRand(fi * 9176 + 13);
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        for (let i = 0; i < 7; i++) {
          const sx = (rand() - 0.5) * nailWidth * 0.85;
          const sy = (rand() - 0.5) * nailLen * 0.85;
          const sr = 0.5 + rand() * 1.0;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────────────────
// Skin tone + undertone detection
// ──────────────────────────────────────────────────────────────────────────────

export function detectSkinTone(
  frame: HTMLCanvasElement,
  landmarks: Point[]
): SkinDepth {
  const ctx = frame.getContext("2d");
  if (!ctx) return "medium";

  const samplePts = [10, 50, 280, 1, 151].map((i) =>
    toPx(landmarks[i], frame.width, frame.height)
  );

  let r = 0, g = 0, b = 0, n = 0;
  for (const pt of samplePts) {
    try {
      const data = ctx.getImageData(
        Math.max(0, Math.floor(pt.x - 6)),
        Math.max(0, Math.floor(pt.y - 6)),
        12,
        12
      ).data;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    } catch {}
  }
  if (!n) return "medium";
  r /= n;
  g /= n;
  b /= n;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 200) return "fair";
  if (lum > 170) return "light";
  if (lum > 135) return "medium";
  if (lum > 95) return "tan";
  return "deep";
}

/**
 * detectUndertone — heuristic undertone classifier (Patrick Ta panel
 * calibration, see docs/MAKEUP_ANALYSIS.md §3). Reads the same forehead
 * + cheek samples as detectSkinTone and projects to a warm/cool/neutral axis.
 */
export function detectUndertone(
  frame: HTMLCanvasElement,
  landmarks: Point[]
): Undertone {
  const ctx = frame.getContext("2d");
  if (!ctx) return "neutral";

  const samplePts = [10, 50, 280, 1, 151].map((i) =>
    toPx(landmarks[i], frame.width, frame.height)
  );

  let r = 0, g = 0, b = 0, n = 0;
  for (const pt of samplePts) {
    try {
      const data = ctx.getImageData(
        Math.max(0, Math.floor(pt.x - 6)),
        Math.max(0, Math.floor(pt.y - 6)),
        12,
        12
      ).data;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    } catch {}
  }
  if (!n) return "neutral";
  const sum = r + g + b;
  if (sum === 0) return "neutral";
  const warmness = r / sum - 0.34;
  const coolness = b / sum - 0.3;
  if (warmness > coolness + 0.01) return "warm";
  if (coolness > warmness + 0.01) return "cool";
  return "neutral";
}

// ──────────────────────────────────────────────────────────────────────────────
// Face-shape heuristic — used by the scan sequence to tailor product picks.
// Produces a coarse label (oval / round / square / heart / long). Accuracy is
// not medical-grade — it's a styling hint, so we trade precision for
// stability across camera angles.
// ──────────────────────────────────────────────────────────────────────────────

export type FaceShape = "oval" | "round" | "square" | "heart" | "long";

export function detectFaceShape(landmarks: Point[]): FaceShape {
  // Normalised landmark coordinates (0..1) — ratios are unitless so we can
  // skip the image dimensions.
  const top = landmarks[10];
  const chin = landmarks[152];
  const cheekL = landmarks[234];
  const cheekR = landmarks[454];
  const jawL = landmarks[172];
  const jawR = landmarks[397];
  const templeL = landmarks[21];
  const templeR = landmarks[251];
  if (!top || !chin || !cheekL || !cheekR || !jawL || !jawR) return "oval";

  const faceH = Math.abs(chin.y - top.y);
  const cheekW = Math.abs(cheekR.x - cheekL.x);
  const jawW = Math.abs(jawR.x - jawL.x);
  const foreheadW = templeL && templeR
    ? Math.abs(templeR.x - templeL.x)
    : cheekW * 0.85;

  if (cheekW === 0) return "oval";

  const heightRatio = faceH / cheekW;      // length vs width
  const jawRatio = jawW / cheekW;           // jaw vs cheekbone
  const foreheadRatio = foreheadW / cheekW; // forehead vs cheekbone

  if (heightRatio > 1.45) return "long";
  if (heightRatio < 1.05) {
    return jawRatio > 0.88 ? "square" : "round";
  }
  if (foreheadRatio > 1.05 && jawRatio < 0.82) return "heart";
  return "oval";
}

// ──────────────────────────────────────────────────────────────────────────────
// Profile type — emitted by the scan sequence and consumed by the
// recommendation helper in data/products.
// ──────────────────────────────────────────────────────────────────────────────

export type FaceProfile = {
  tone: SkinDepth;
  undertone: Undertone;
  shape: FaceShape;
};
