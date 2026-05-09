# Landmark-Placement Analysis for the NURA Try-On

**Scope.** This document is *only* about how to attach virtual makeup to the
right places on a human face/hand. It tells the engineer which MediaPipe
landmark indices anchor each effect, why those indices are correct
anatomically, and what shape (open arc / closed polygon / radial / ellipse)
the renderer should use. It does not change the visual look of any layer —
the existing lipstick / blush / contour / etc. recipes stay as they are.

**Inputs.**

- `MediaPipe FaceMesh` — 468-point face topology (canonical numbering used
  throughout this document).
- `MediaPipe Hands` — 21 landmarks per hand (`WRIST`, then thumb→pinky in
  groups of 4: `MCP / PIP / DIP / TIP`).

A short index reference for the FaceMesh points used below:

| Region | Indices |
| --- | --- |
| Outer face silhouette | `10` (top of forehead), `152` (chin), `234` (left cheekbone outer), `454` (right cheekbone outer) |
| Nose | `1` (tip), `6` / `168` / `195` / `5` (bridge top → bottom) |
| Eyes (inner / outer corners) | `133` / `33` (left), `362` / `263` (right) |
| Lips | `0` / `17` (top / bottom centre), `61` / `291` (corners) |

---

## 1. Lips — `LIP_OUTER` and `LIP_INNER` polygons

**Goal.** Paint pigment on the lip flesh while leaving the mouth opening
untouched (so teeth never get tinted).

**Outer contour (20 indices, clockwise from left corner):**

```
61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
291, 409, 270, 269, 267, 0, 37, 39, 40, 185
```

These walk: lower-lip from left corner → centre `17` → right corner, then
back along the upper lip's vermillion border via `0` (cupid's bow) to the
left corner. They land *on* the vermillion border — not on the skin above
or the inside of the mouth. That means a fill drawn through them never
bleeds onto the philtrum or chin.

**Inner contour (20 indices):**

```
78, 95, 88, 178, 87, 14, 317, 402, 318, 324,
308, 415, 310, 311, 312, 13, 82, 81, 80, 191
```

These trace the *mouth opening* — the boundary between lip flesh and the
dark interior when the mouth is slightly parted. `13` and `14` are the
exact upper/lower-inner-lip centre points.

**Render rule.** Build a single path: outer polygon + inner polygon, then
fill with the **even-odd** rule. The inner polygon punches a hole, so the
mouth opening is preserved automatically:

```ts
ctx.beginPath();
moveAround(outer); ctx.closePath();
moveAround(inner); ctx.closePath();
ctx.fill("evenodd");
```

**Why not just fill the outer polygon?** Without the punch-out, an open
mouth in the camera feed would have the dark inside coloured red. The
even-odd rule fixes this for free.

---

## 2. Eyes — three nested clusters per eye

The eye is the most visually sensitive region. We use **three** separate
polygons per eye so eyeshadow, eyeliner, and lash-line smudge each anchor
to the correct anatomical line.

### 2.1 Upper lash-line (eyeliner) — open arc

```
EYELINER_L = [33, 246, 161, 160, 159, 158, 157, 173, 133]
EYELINER_R = [362, 398, 384, 385, 386, 387, 388, 466, 263]
```

Inner corner → over the lid → outer corner. These are exactly the
**topmost** points of the upper-lid arc (the lash root line). Drawing a
quadratic-bezier through them produces a real lash-hugging stroke.

The *wing* (cat-eye flick) is computed at runtime by extrapolating the
final segment vector (`last - prev`) past the outer corner and lifting `y`
slightly toward the temple. That keeps the wing angled correctly for any
face orientation — we don't hard-code a screen direction.

### 2.2 Upper-lid polygon (eyeshadow base) — closed

```
EYESHADOW_L_LID = [246, 161, 160, 159, 158, 157, 173, 133,
                   155, 154, 153, 145, 144, 163, 7]
EYESHADOW_R_LID = [398, 384, 385, 386, 387, 388, 466, 263,
                   249, 390, 373, 374, 380, 381, 382]
```

Goes around the eye opening (upper lid → outer corner → lower lid → inner
corner). When eyes are open this fills the visible eye-white area. We
*want* that — the multiply blend mode preserves the white sclera through
the pigment, and the result reads as "lid colour over eye opening" without
needing to mask the iris specifically.

### 2.3 Crease polygon (eyeshadow transition) — closed, sits *above* the lid

```
EYESHADOW_L_CREASE = [70, 63, 105, 66, 107, 55, 193, 122,
                      196, 197, 173, 33, 130, 247, 30, 29]
EYESHADOW_R_CREASE = [300, 293, 334, 296, 336, 285, 417, 351,
                      419, 196, 466, 263, 359, 467, 260, 259]
```

These wrap the *brow-bone area immediately above* the lid (`70 / 63 / 105
/ 66` are the lower brow line). The renderer fills this polygon with a
linear gradient that fades from transparent at the top to full pigment at
the bottom — that produces the classic "transition shade" effect blending
into the brow bone.

### 2.4 Lower-lash line — used for smudge / waterline

```
LOWER_LINE_L = [33, 7, 163, 144, 145, 153, 154, 155, 133]
LOWER_LINE_R = [362, 382, 381, 380, 374, 373, 390, 249, 263]
```

Same pair of corners as `EYELINER_*` but follows the lower-lash path. We
only draw on this when intensity is high (smudged liner) — never as a
default, because the lower-lash line is the most aging element of an eye
look when overdone.

### 2.5 Inner-corner highlight — single point

`landmarks[133]` and `landmarks[362]` are the exact tear-duct points. A
small radial dot here is enough — using a polygon would over-paint into
the eye-white. Always cream-tinted, never pure white, so it doesn't
compete with the sclera.

---

## 3. Cheeks — `BLUSH_*` clusters

**Goal.** Soft radial flush centred on the apple of the cheek (the
fleshiest, highest-curvature point when the user smiles).

```
BLUSH_L_APPLE = [50, 101, 118, 117, 123, 147]
BLUSH_R_APPLE = [280, 330, 347, 346, 352, 376]
```

Centroid of these six points is the apple of the cheek — landmark `50` is
on the upper apple, `147` is on the lower; their average sits right where
you'd want a brush tap.

**Why centroid + radial, not a polygon fill?** The cheek has no hard
boundary in real makeup. A polygon fill would paint a rectangular patch.
A radial gradient with falloff produces the soft circular glow that real
cream/powder blush creates.

**Sizing.** `rx ≈ faceWidth × 0.20`, `ry ≈ faceWidth × 0.16`. Both
derived from `landmarks[454].x − landmarks[234].x` (cheekbone-to-cheekbone
width in pixels) so the blush scales with how close the face is to the
camera.

**Rotation.** A small `−0.15 rad` tilt aligns the major axis with the
cheekbone direction. Without the tilt the radial reads as too round and
draws the eye downward.

---

## 4. Contour — jaw, temple, nose

Contour is the only category that uses **open strokes** rather than fills.
Each strip is a sequence of indices traced as a smoothed bezier with
`lineCap: round`.

### 4.1 Jaw contour

```
CONTOUR_JAW_L = [172, 136, 150, 149, 176, 148, 152]
CONTOUR_JAW_R = [397, 365, 379, 378, 400, 377, 152]
```

Both strips terminate at `152` (chin centre) so the two sides meet
exactly. The strip starts under the ear at `172/397` and walks along the
jawline edge — these are the *underside* of the jaw, not the visible
outline, which is why a multiply stroke here reads as a real shadow.

### 4.2 Temple contour

```
CONTOUR_TEMPLE_L = [234, 93, 132, 58]
CONTOUR_TEMPLE_R = [454, 323, 361, 288]
```

`234` / `454` are the outermost cheekbone points (the same pair we use to
measure face width). The strip walks down toward the ear (`58` / `288`).
This is the standard "make the face read narrower at the temples" stroke.

### 4.3 Nose-side slimming — `CONTOUR_NOSE_*`

```
CONTOUR_NOSE_L = [193, 245, 188, 174, 198, 49]
CONTOUR_NOSE_R = [417, 465, 412, 399, 420, 279]
```

The points trace the side of the nose bridge from inner-eye (`193 / 417`)
down to the nostril side (`49 / 279`). Drawn at ~40% the width of the jaw
stroke so it never dominates.

---

## 5. Highlight zones (paired with contour)

Highlight always reads as the inverse of contour — light planes where
contour is dark. Implementing it requires no new polygons; we use the
**centroid** of small fixed clusters.

| Zone | Cluster | Reason |
| --- | --- | --- |
| Forehead centre | `[10, 151, 9]` | Top of forehead + glabella average. |
| Nose bridge | `[168, 6, 197, 195, 5]` | Five points down the bridge → soft vertical line. |
| Cheekbone L / R | `[116, 117, 118] / [345, 346, 347]` | High point above the apple — distinct from the blush apple. |
| Cupid's bow | `[0, 11, 12]` | The exact upper-lip peak. Highlight here visually plumps the lip. |
| Chin | `[152, 175, 199]` | Chin tip + just below. Lengthens the lower face. |

A radial dot at each centroid using `screen` blending and a warm cream
tint (`#fff5e6`) is enough — no polygon needed. Highlight always paints
*after* contour so it sits on top.

---

## 6. Hands — `FINGER_TIPS / DIPS / PIPS`

```
FINGER_TIPS = [4, 8, 12, 16, 20]   // thumb→pinky
FINGER_DIPS = [3, 7, 11, 15, 19]
FINGER_PIPS = [2, 6, 10, 14, 18]
```

For each finger we have three colinear joints. The **finger-direction
vector** comes from `tip − pip` (skipping `dip` because it shares the
same axis). That vector gives:

1. The angle to rotate the nail ellipse so its long axis follows the
   finger.
2. The length scale (`segLen = |tip − pip|`) — the nail is `0.55 ×
   segLen` long and `0.38 × segLen` wide. Both factors are tuned to look
   correct on adult fingers across distances from the camera.
3. The centre point — placed at `t = 0.7` along the `pip → tip` segment.
   Not at `tip` itself, because `tip` is the actual fingertip (under the
   nail's free edge) and putting the ellipse there would extend past the
   finger.

If `segLen < 5 px`, we skip the finger entirely — that means the hand is
too far / too occluded to render polish reliably.

---

## 7. Skin-tone sampling — `detectSkinTone`

Sampled points: `[10, 50, 280, 1, 151]`.

- `10` — top of forehead
- `50` / `280` — left / right upper cheek
- `1` — nose tip (sometimes occluded by glasses; the average tolerates one
  bad sample)
- `151` — between the eyebrows

We grab a 12×12 px patch around each point and average the RGB channel.
Five points spread across the face avoids being misled by transient
shadows or specular highlights on a single area. The result is mapped to
five depth tiers by luminance. This drives the "★ recommended for your
tone" badge on each shade swatch — no other rendering depends on it.

---

## 8. Model mode — synthetic regions that match the FaceMesh contract

Model mode does *not* run MediaPipe. Instead, the portrait painter
constructs a `PortraitRegions` object whose fields use the **same names
and shapes** as the camera-mode polygons:

```ts
interface PortraitRegions {
  cx, cy, faceRx, faceRy, faceWidthPx;
  lipsOuter:  Point[];   // matches LIP_OUTER walk order
  lipsInner:  Point[];
  cheekL: Point;         // single centroid, like camera-mode blush
  cheekR: Point;
  eyeL / eyeR: { lid, crease, liner, innerCorner, outerCorner };
  jawL, jawR, templeL, templeR: Point[];
  nails: Array<{ tip, dip, pip }>;
}
```

That symmetry is deliberate. Every renderer expects "outer-then-inner
polygons" for lips, "lid + crease polygons" for eyes, "open strip" for
jaw — model mode just hands those shapes to the same painters. When the
landmark choices in §1–6 change, the model painter inherits the change
without modification.

---

## 9. Open issues / future work

- `EYESHADOW_*_CREASE` includes `196` / `197` — those are *very* close to
  the nose bridge and produce a small visual leak on aquiline noses.
  Replace `196 / 197` with `190 / 414` if the leak is reported.
- `CONTOUR_TEMPLE_*` ends at `58 / 288` (just in front of the ear).
  On full-frontal faces this works; for ¾-profile shots the strip
  disappears behind the ear — consider stopping at `132 / 361` instead.
- Hand smoothing: a fast wave can produce one bad finger frame where the
  nail rotates 90°. A Kalman filter over the last 3 frames of `tip - pip`
  would solve it; today we just skip frames with `segLen < 5`.
