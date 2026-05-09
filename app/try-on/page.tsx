"use client";
// NURA Virtual Try-On Studio v4
// ─────────────────────────────
// Pipeline:
//   1. User selects a source (live camera, uploaded photo, or a diverse model illustration).
//   2. FaceMesh + Hands load lazily from CDN (only when camera / upload is selected).
//   3. Every animation frame:
//        - camera/upload  → MediaPipe detection → render active layers on the real face
//        - model          → stylised portrait + layers painted directly on known regions
//
// v4 changes:
//   - Global error / unhandledrejection swallowers for the known-harmless
//     @mediapipe/face_mesh loader `xhr.onprogress` TypeError. Keeps the
//     Next.js dev overlay quiet without masking real failures.
//   - Loop reads mutable state from refs — stable useCallback, no RAF thrash.
//   - faceDetected transitions only (with ~500 ms hysteresis) — no flicker.
//   - Camera start-up race fixed. Permission denial shows a friendly chip,
//     not a full-stage error takeover.
//   - Layer chip is a true single-click toggle. Active-layer pills carry ×.
//   - Source selector fully button-based.
//   - Model mode renders all 7 layers directly on the painted portrait's
//     known regions (no synthetic MediaPipe landmarks).

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { products, skinTones } from "@/data/products";
import { useCart } from "@/lib/cart";
import {
  renderLipstick,
  renderBlush,
  renderEyeliner,
  renderEyeshadow,
  detectSkinTone,
  detectUndertone,
  detectFaceShape,
  Point,
  LipFinish,
  BlushPlacement,
  BlushFormula,
  EyelinerStyle,
  Undertone,
  FaceProfile,
} from "@/lib/tryon-engine";
import FaceScanOverlay from "./_components/FaceScanOverlay";
import ProfileCard, {
  buildRecommendations,
  type Recommendation,
} from "./_components/ProfileCard";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type SourceMode = "camera" | "upload" | "model";
const ENABLE_LIVE_CAMERA = false;
type SkinTone = "fair" | "light" | "medium" | "tan" | "deep";
type CatKey =
  | "lipstick"
  | "lipgloss"
  | "blush"
  | "contour"
  | "eyeliner"
  | "eyeshadow"
  | "nails";

// Categories that are launched and tracked. Nails/lipgloss/contour moved to
// "Coming Soon" or removed. Lip gloss and contour removed from the studio per
// product decision. Re-enabling is one-line in ALL_CATS.
type ActiveCatKey = Exclude<CatKey, "nails" | "lipgloss" | "contour">;
const COMING_SOON_CATS: CatKey[] = ["nails"];

type Shade = { name: string; hex: string };

interface LayerState {
  active: boolean;
  productSlug: string;
  shadeIdx: number;
  intensity: number;
  // Per-category style options (only relevant for some categories).
  lipFinish?: LipFinish;
  blushPlacement?: BlushPlacement;
  blushFormula?: BlushFormula;
  eyelinerStyle?: EyelinerStyle;
}

type LandmarkPoint = Point & { z?: number; visibility?: number };

const CATEGORY_LABELS: Record<CatKey, string> = {
  lipstick: "Lipstick",
  lipgloss: "Lip Gloss",
  blush: "Blush",
  contour: "Contour",
  eyeliner: "Eyeliner",
  eyeshadow: "Eyeshadow",
  nails: "Nails",
};

const ALL_CATS: ActiveCatKey[] = [
  "lipstick",
  "blush",
  "eyeliner",
  "eyeshadow",
];

type ModelDef = {
  name: string;
  skin: SkinTone;
  skinHex: string;
  hairHex: string;
  gradient: string;
};

const MODELS: ModelDef[] = [
  {
    name: "Aisha",
    skin: "medium",
    skinHex: "#c89878",
    hairHex: "#2b1e17",
    gradient: "linear-gradient(135deg,#c89878,#a37353)",
  },
  {
    name: "Zainab",
    skin: "tan",
    skinHex: "#a37353",
    hairHex: "#1f1410",
    gradient: "linear-gradient(135deg,#a37353,#6d4733)",
  },
  {
    name: "Meera",
    skin: "light",
    skinHex: "#e3b999",
    hairHex: "#3b2a1f",
    gradient: "linear-gradient(135deg,#e3b999,#c89878)",
  },
  {
    name: "Fatima",
    skin: "deep",
    skinHex: "#6d4733",
    hairHex: "#140a05",
    gradient: "linear-gradient(135deg,#6d4733,#3d2419)",
  },
];

// MediaPipe CDN — pinned to the latest published builds on jsdelivr/npm.
// face_mesh's xhr.onprogress TypeError is harmless noise (assets still
// load) — the capture-phase error swallower below prevents it from
// reaching Next.js's dev overlay.
const FACEMESH_VERSION = "0.4.1633559619";
const FACEMESH_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${FACEMESH_VERSION}/face_mesh.js`;

// Noise-swallow matcher: any error whose filename or stack mentions one of
// these script files is a known MediaPipe loader quirk (fires from inside
// xhr progress callbacks while packed assets are streamed — the asset still
// finishes loading, the error is harmless).
const MP_NOISE_MATCHERS = [
  "face_mesh_solution_packed_assets_loader.js",
  "face_mesh_solution_simd_wasm_bin.js",
];

function isMediapipeNoise(
  filename?: string | null,
  message?: string | null,
  stack?: string | null
): boolean {
  const s = `${filename ?? ""}\n${message ?? ""}\n${stack ?? ""}`;
  return MP_NOISE_MATCHERS.some((m) => s.includes(m));
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function smoothFaceLandmarks(
  prev: LandmarkPoint[] | null,
  fresh: LandmarkPoint[]
): LandmarkPoint[] {
  if (!prev || prev.length !== fresh.length) {
    return fresh.map((p) => ({ ...p }));
  }

  return fresh.map((p, i) => {
    const old = prev[i];
    const dx = p.x - old.x;
    const dy = p.y - old.y;
    const dz = (p.z ?? 0) - (old.z ?? 0);
    const delta = Math.hypot(dx, dy, dz);
    // ModiFace-style stability: damp tiny tracker noise, let real head motion through.
    const alpha = Math.min(0.7, Math.max(0.22, delta * 18));
    return {
      ...p,
      x: old.x * (1 - alpha) + p.x * alpha,
      y: old.y * (1 - alpha) + p.y * alpha,
      z:
        typeof p.z === "number" || typeof old.z === "number"
          ? (old.z ?? 0) * (1 - alpha) + (p.z ?? 0) * alpha
          : undefined,
    };
  });
}

function defaultSlug(cat: ActiveCatKey): string {
  const map: Record<ActiveCatKey, string> = {
    lipstick: "wardah-matte-lip-cream",
    blush: "nura-velvet-blush",
    eyeliner: "nura-kohl-liner",
    eyeshadow: "nura-silk-eyeshadow",
  };
  return map[cat];
}

function buildDefaultLayers(): Record<ActiveCatKey, LayerState> {
  const out = {} as Record<ActiveCatKey, LayerState>;
  for (const cat of ALL_CATS) {
    out[cat] = {
      // All layers start OFF. User must either tap the scan CTA and apply a
      // recommendation, or manually toggle a layer. Prevents the "pre-applied
      // filter" look users saw before.
      active: false,
      productSlug: defaultSlug(cat),
      shadeIdx: 0,
      intensity: 0.7,
      lipFinish: "matte",
      blushPlacement: "apples",
      blushFormula: "cream",
      eyelinerStyle: "winged",
    };
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Canvas utilities (small local copies — the real-face renderers use the
// same shapes internally but don't export them).
// ──────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function shade(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const adj = (c: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(c + (amount >= 0 ? (255 - c) * amount : c * amount))
      )
    );
  return `#${adj(r).toString(16).padStart(2, "0")}${adj(g)
    .toString(16)
    .padStart(2, "0")}${adj(b).toString(16).padStart(2, "0")}`;
}

function smoothPath(ctx: CanvasRenderingContext2D, pts: Point[]) {
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
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Point[]) {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function centroid(pts: Point[]): Point {
  const s = pts.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), {
    x: 0,
    y: 0,
  });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

// ──────────────────────────────────────────────────────────────────────────────
// Model-mode portrait + region map
// ──────────────────────────────────────────────────────────────────────────────

interface EyeRegion {
  innerCorner: Point;
  outerCorner: Point;
  /** Upper-lid arc points from inner → top → outer. Used by eyeliner. */
  liner: Point[];
  /** Closed lid polygon used by eyeshadow base fill. */
  lid: Point[];
  /** Crease polygon used by eyeshadow gradient fade. */
  crease: Point[];
}

interface PortraitRegions {
  cx: number;
  cy: number;
  faceRx: number;
  faceRy: number;
  faceWidthPx: number;
  lipsOuter: Point[];
  lipsInner: Point[];
  cheekL: Point;
  cheekR: Point;
  eyeL: EyeRegion;
  eyeR: EyeRegion;
  jawL: Point[];
  jawR: Point[];
  templeL: Point[];
  templeR: Point[];
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  model: ModelDef
): PortraitRegions {
  // Background wash
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#f7ede0");
  bg.addColorStop(1, "#e7d8bd");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.44;
  const faceRx = Math.min(w, h) * 0.22;
  const faceRy = Math.min(w, h) * 0.3;
  const faceWidthPx = faceRx * 2;

  // Shoulders / neck
  ctx.fillStyle = shade(model.skinHex, -0.1);
  ctx.fillRect(cx - faceRx * 0.5, cy + faceRy * 0.7, faceRx, h);
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.quadraticCurveTo(cx, h * 0.78, w, h);
  ctx.closePath();
  ctx.fillStyle = shade(model.skinHex, -0.25);
  ctx.fill();

  // Hair back-halo
  ctx.fillStyle = model.hairHex;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy - faceRy * 0.05,
    faceRx * 1.25,
    faceRy * 1.15,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Face
  ctx.fillStyle = model.skinHex;
  ctx.beginPath();
  ctx.ellipse(cx, cy, faceRx, faceRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face shading
  const faceShade = ctx.createRadialGradient(
    cx,
    cy - faceRy * 0.3,
    faceRx * 0.1,
    cx,
    cy,
    faceRx
  );
  faceShade.addColorStop(0, "rgba(255,255,255,0.08)");
  faceShade.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = faceShade;
  ctx.beginPath();
  ctx.ellipse(cx, cy, faceRx, faceRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair front fringe
  ctx.fillStyle = model.hairHex;
  ctx.beginPath();
  ctx.moveTo(cx - faceRx, cy - faceRy * 0.6);
  ctx.quadraticCurveTo(
    cx - faceRx * 0.4,
    cy - faceRy * 1.05,
    cx + faceRx * 0.3,
    cy - faceRy * 0.85
  );
  ctx.quadraticCurveTo(
    cx + faceRx * 0.9,
    cy - faceRy * 0.5,
    cx + faceRx,
    cy - faceRy * 0.2
  );
  ctx.quadraticCurveTo(
    cx + faceRx * 0.7,
    cy - faceRy * 0.7,
    cx,
    cy - faceRy * 0.62
  );
  ctx.quadraticCurveTo(
    cx - faceRx * 0.6,
    cy - faceRy * 0.55,
    cx - faceRx,
    cy - faceRy * 0.6
  );
  ctx.closePath();
  ctx.fill();

  // Eyes — geometry shared with region map
  const eyeY = cy - faceRy * 0.12;
  const eyeDX = faceRx * 0.42;
  const eyeW = faceRx * 0.22;
  const eyeH = faceRy * 0.06;

  const buildEye = (sign: -1 | 1): EyeRegion => {
    const ex = cx + sign * eyeDX;
    const innerCorner = { x: ex + (sign === 1 ? -eyeW : eyeW), y: eyeY };
    const outerCorner = { x: ex + (sign === 1 ? eyeW : -eyeW), y: eyeY };
    // Inner → top → outer arc for the upper lash line (ordered so the wing
    // lands at outerCorner, exactly like FaceMesh's outer-eye order).
    const liner: Point[] = [];
    const LINER_SAMPLES = 9;
    for (let i = 0; i < LINER_SAMPLES; i++) {
      const t = i / (LINER_SAMPLES - 1);
      // Arc: start at inner corner, peak over the eye, end at outer.
      const px =
        innerCorner.x + (outerCorner.x - innerCorner.x) * t;
      const arc = Math.sin(t * Math.PI);
      const py = eyeY - arc * eyeH;
      liner.push({ x: px, y: py });
    }
    // Lid polygon — upper arc then lower arc (closed). Used for eyeshadow base.
    const lid: Point[] = [];
    const LID_SAMPLES = 10;
    for (let i = 0; i < LID_SAMPLES; i++) {
      const t = i / (LID_SAMPLES - 1);
      const px = innerCorner.x + (outerCorner.x - innerCorner.x) * t;
      const arc = Math.sin(t * Math.PI);
      lid.push({ x: px, y: eyeY - arc * eyeH * 0.95 - eyeH * 0.15 });
    }
    // Back along a gentler arc just above the lash line.
    for (let i = LID_SAMPLES - 1; i >= 0; i--) {
      const t = i / (LID_SAMPLES - 1);
      const px = innerCorner.x + (outerCorner.x - innerCorner.x) * t;
      const arc = Math.sin(t * Math.PI);
      lid.push({ x: px, y: eyeY - arc * eyeH * 0.2 });
    }
    // Crease polygon — a wider fan above the lid used for the upward gradient.
    const crease: Point[] = [];
    const CREASE_SAMPLES = 10;
    for (let i = 0; i < CREASE_SAMPLES; i++) {
      const t = i / (CREASE_SAMPLES - 1);
      const px = innerCorner.x + (outerCorner.x - innerCorner.x) * t;
      const arc = Math.sin(t * Math.PI);
      crease.push({
        x: px,
        y: eyeY - arc * eyeH * 1.9 - eyeH * 0.6,
      });
    }
    for (let i = CREASE_SAMPLES - 1; i >= 0; i--) {
      const t = i / (CREASE_SAMPLES - 1);
      const px = innerCorner.x + (outerCorner.x - innerCorner.x) * t;
      const arc = Math.sin(t * Math.PI);
      crease.push({ x: px, y: eyeY - arc * eyeH * 0.95 - eyeH * 0.2 });
    }
    return { innerCorner, outerCorner, liner, lid, crease };
  };

  const eyeL = buildEye(-1);
  const eyeR = buildEye(1);

  // Eye fills
  for (const sign of [-1, 1] as const) {
    const ex = cx + sign * eyeDX;
    ctx.fillStyle = "#f8f5f0";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a2212";
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeH * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0604";
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeH * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(ex - eyeH * 0.3, eyeY - eyeH * 0.3, eyeH * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brows
  ctx.strokeStyle = model.hairHex;
  ctx.lineWidth = Math.max(2, faceRx * 0.035);
  ctx.lineCap = "round";
  for (const sign of [-1, 1] as const) {
    const ex = cx + sign * eyeDX;
    ctx.beginPath();
    ctx.moveTo(ex - eyeW * (sign === -1 ? 1.05 : 0.9), eyeY - eyeH * 3.4);
    ctx.quadraticCurveTo(
      ex,
      eyeY - eyeH * 4.2,
      ex + eyeW * (sign === -1 ? 0.9 : 1.05),
      eyeY - eyeH * 2.9
    );
    ctx.stroke();
  }

  // Nose
  ctx.strokeStyle = shade(model.skinHex, -0.18);
  ctx.lineWidth = Math.max(2, faceRx * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx - faceRx * 0.05, cy - faceRy * 0.05);
  ctx.quadraticCurveTo(
    cx,
    cy + faceRy * 0.2,
    cx + faceRx * 0.1,
    cy + faceRy * 0.22
  );
  ctx.stroke();

  // Nostrils
  ctx.fillStyle = shade(model.skinHex, -0.35);
  ctx.beginPath();
  ctx.ellipse(
    cx - faceRx * 0.06,
    cy + faceRy * 0.26,
    faceRx * 0.02,
    faceRx * 0.012,
    0,
    0,
    Math.PI * 2
  );
  ctx.ellipse(
    cx + faceRx * 0.06,
    cy + faceRy * 0.26,
    faceRx * 0.02,
    faceRx * 0.012,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Lips base — shape + region. Upper-arc followed by lower-arc, closed.
  const lipY = cy + faceRy * 0.48;
  const lipW = faceRx * 0.38;
  const lipH = faceRy * 0.08;

  const lipsOuter: Point[] = [
    { x: cx - lipW, y: lipY },
    { x: cx - lipW * 0.75, y: lipY - lipH * 0.75 },
    { x: cx - lipW * 0.4, y: lipY - lipH * 0.4 },
    { x: cx - lipW * 0.18, y: lipY - lipH * 0.2 },
    { x: cx, y: lipY - lipH * 0.55 },
    { x: cx + lipW * 0.18, y: lipY - lipH * 0.2 },
    { x: cx + lipW * 0.4, y: lipY - lipH * 0.4 },
    { x: cx + lipW * 0.75, y: lipY - lipH * 0.75 },
    { x: cx + lipW, y: lipY },
    { x: cx + lipW * 0.7, y: lipY + lipH * 1.0 },
    { x: cx + lipW * 0.35, y: lipY + lipH * 1.1 },
    { x: cx, y: lipY + lipH * 1.0 },
    { x: cx - lipW * 0.35, y: lipY + lipH * 1.1 },
    { x: cx - lipW * 0.7, y: lipY + lipH * 1.0 },
  ];
  const lipsInner: Point[] = [
    { x: cx - lipW * 0.85, y: lipY + lipH * 0.05 },
    { x: cx - lipW * 0.5, y: lipY - lipH * 0.05 },
    { x: cx, y: lipY + lipH * 0.1 },
    { x: cx + lipW * 0.5, y: lipY - lipH * 0.05 },
    { x: cx + lipW * 0.85, y: lipY + lipH * 0.05 },
    { x: cx + lipW * 0.5, y: lipY + lipH * 0.25 },
    { x: cx, y: lipY + lipH * 0.35 },
    { x: cx - lipW * 0.5, y: lipY + lipH * 0.25 },
  ];
  ctx.fillStyle = shade(model.skinHex, -0.45);
  fillPoly(ctx, lipsOuter);

  // Soft mouth line
  ctx.strokeStyle = shade(model.skinHex, -0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - lipW * 0.95, lipY);
  ctx.quadraticCurveTo(cx, lipY + lipH * 0.1, cx + lipW * 0.95, lipY);
  ctx.stroke();

  // Cheek centers
  const cheekL: Point = { x: cx - faceRx * 0.55, y: cy + faceRy * 0.18 };
  const cheekR: Point = { x: cx + faceRx * 0.55, y: cy + faceRy * 0.18 };

  // Jaw + temple strips (used for contour)
  const jawL: Point[] = [
    { x: cx - faceRx * 0.95, y: cy + faceRy * 0.35 },
    { x: cx - faceRx * 0.85, y: cy + faceRy * 0.6 },
    { x: cx - faceRx * 0.65, y: cy + faceRy * 0.82 },
    { x: cx - faceRx * 0.35, y: cy + faceRy * 0.95 },
  ];
  const jawR: Point[] = [
    { x: cx + faceRx * 0.95, y: cy + faceRy * 0.35 },
    { x: cx + faceRx * 0.85, y: cy + faceRy * 0.6 },
    { x: cx + faceRx * 0.65, y: cy + faceRy * 0.82 },
    { x: cx + faceRx * 0.35, y: cy + faceRy * 0.95 },
  ];
  const templeL: Point[] = [
    { x: cx - faceRx * 0.95, y: cy - faceRy * 0.35 },
    { x: cx - faceRx * 0.85, y: cy - faceRy * 0.15 },
    { x: cx - faceRx * 0.72, y: cy + faceRy * 0.05 },
  ];
  const templeR: Point[] = [
    { x: cx + faceRx * 0.95, y: cy - faceRy * 0.35 },
    { x: cx + faceRx * 0.85, y: cy - faceRy * 0.15 },
    { x: cx + faceRx * 0.72, y: cy + faceRy * 0.05 },
  ];

  return {
    cx,
    cy,
    faceRx,
    faceRy,
    faceWidthPx,
    lipsOuter,
    lipsInner,
    cheekL,
    cheekR,
    eyeL,
    eyeR,
    jawL,
    jawR,
    templeL,
    templeR,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// applyPortraitLayers — paint each active layer directly onto known regions
// using the same compositing verbs as the real-face renderers. Eyeliner,
// eyeshadow and contour are re-implemented locally so we don't depend on
// MediaPipe's topological ordering at all in model mode.
// ──────────────────────────────────────────────────────────────────────────────

function paintLipsBase(
  ctx: CanvasRenderingContext2D,
  lipsOuter: Point[],
  lipsInner: Point[],
  hex: string,
  alpha: number
) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.moveTo(lipsOuter[0].x, lipsOuter[0].y);
  for (let i = 1; i < lipsOuter.length; i++)
    ctx.lineTo(lipsOuter[i].x, lipsOuter[i].y);
  ctx.closePath();
  ctx.moveTo(lipsInner[0].x, lipsInner[0].y);
  for (let i = 1; i < lipsInner.length; i++)
    ctx.lineTo(lipsInner[i].x, lipsInner[i].y);
  ctx.closePath();
  ctx.fill("evenodd");
  ctx.restore();
}

function paintLipsHighlight(
  ctx: CanvasRenderingContext2D,
  lipsOuter: Point[],
  size: "tight" | "broad",
  alpha: number
) {
  const c = centroid(lipsOuter);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = alpha;
  const radius = size === "tight" ? 32 : 64;
  const grad = ctx.createRadialGradient(c.x, c.y - 2, 2, c.x, c.y, radius);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.3)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  fillPoly(ctx, lipsOuter);
  ctx.restore();
}

function paintLipsByFinish(
  ctx: CanvasRenderingContext2D,
  lipsOuter: Point[],
  lipsInner: Point[],
  hex: string,
  intensity: number,
  finish: LipFinish
) {
  switch (finish) {
    case "matte":
      paintLipsBase(ctx, lipsOuter, lipsInner, hex, 0.5 + intensity * 0.45);
      return;
    case "satin":
      paintLipsBase(ctx, lipsOuter, lipsInner, hex, 0.45 + intensity * 0.45);
      paintLipsHighlight(ctx, lipsOuter, "broad", 0.18 + intensity * 0.12);
      return;
    case "glossy":
      paintLipsBase(ctx, lipsOuter, lipsInner, hex, 0.45 + intensity * 0.45);
      paintLipsHighlight(ctx, lipsOuter, "tight", 0.35 + intensity * 0.2);
      return;
    case "sheer":
      paintLipsBase(ctx, lipsOuter, lipsInner, hex, 0.25 + intensity * 0.25);
      paintLipsHighlight(ctx, lipsOuter, "broad", 0.16 + intensity * 0.12);
      return;
    case "shimmer":
      paintLipsBase(ctx, lipsOuter, lipsInner, hex, 0.45 + intensity * 0.4);
      paintLipsHighlight(ctx, lipsOuter, "tight", 0.3 + intensity * 0.2);
      paintLipsShimmer(ctx, lipsOuter, lipsInner, intensity);
      return;
  }
}

function paintLipsShimmer(
  ctx: CanvasRenderingContext2D,
  lipsOuter: Point[],
  lipsInner: Point[],
  intensity: number
) {
  let s = (0xa57c | Math.floor(intensity * 100)) >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const minX = Math.min(...lipsOuter.map((p) => p.x));
  const maxX = Math.max(...lipsOuter.map((p) => p.x));
  const minY = Math.min(...lipsOuter.map((p) => p.y));
  const maxY = Math.max(...lipsOuter.map((p) => p.y));
  const innerMinY = Math.min(...lipsInner.map((p) => p.y));
  const innerMaxY = Math.max(...lipsInner.map((p) => p.y));
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

function paintBlushOnRegions(
  ctx: CanvasRenderingContext2D,
  regions: PortraitRegions,
  hex: string,
  intensity: number,
  placement: BlushPlacement,
  formula: BlushFormula
) {
  const { cheekL, cheekR, faceWidthPx, cx, cy, faceRy } = regions;
  const blend: GlobalCompositeOperation =
    formula === "cream" ? "soft-light" : "multiply";
  const baseAlpha =
    formula === "cream" ? 0.6 + intensity * 0.35 : 0.35 + intensity * 0.35;

  const radial = (
    c: Point,
    rx: number,
    ry: number,
    rotation: number,
    alpha: number
  ) => {
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
  };

  switch (placement) {
    case "apples": {
      const rx = faceWidthPx * 0.2;
      const ry = faceWidthPx * 0.16;
      radial(cheekL, rx, ry, 0, baseAlpha);
      radial(cheekR, rx, ry, 0, baseAlpha);
      return;
    }
    case "lifted": {
      const rx = faceWidthPx * 0.22;
      const ry = faceWidthPx * 0.11;
      const liftedL: Point = { x: cheekL.x + faceWidthPx * 0.05, y: cheekL.y - faceRy * 0.18 };
      const liftedR: Point = { x: cheekR.x - faceWidthPx * 0.05, y: cheekR.y - faceRy * 0.18 };
      radial(liftedL, rx, ry, -0.25, baseAlpha);
      radial(liftedR, rx, ry, 0.25, baseAlpha);
      return;
    }
    case "diffused": {
      const rx = faceWidthPx * 0.24;
      const ry = faceWidthPx * 0.14;
      const a = baseAlpha * 0.6;
      radial(cheekL, rx, ry, -0.1, a);
      radial(cheekR, rx, ry, 0.1, a);
      const noseBridge: Point = { x: cx, y: cy - regions.faceRy * 0.05 };
      radial(noseBridge, rx * 0.7, ry * 0.7, 0, a * 0.7);
      return;
    }
  }
}

function paintHighlightPass(
  ctx: CanvasRenderingContext2D,
  regions: PortraitRegions,
  intensity: number
) {
  const { cx, cy, faceRx, faceRy, faceWidthPx, cheekL, cheekR } = regions;
  const r = faceWidthPx * 0.09;
  const alpha = 0.18 + intensity * 0.18;

  const dot = (c: Point, radius: number, a: number) => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius);
    g.addColorStop(0, "rgba(255,245,230,0.95)");
    g.addColorStop(0.4, "rgba(255,245,230,0.4)");
    g.addColorStop(1, "rgba(255,245,230,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  dot({ x: cx, y: cy - faceRy * 0.5 }, r, alpha);
  dot({ x: cx, y: cy + faceRy * 0.05 }, r * 0.7, alpha);
  dot({ x: cheekL.x + faceWidthPx * 0.05, y: cheekL.y - faceRy * 0.05 }, r * 0.85, alpha);
  dot({ x: cheekR.x - faceWidthPx * 0.05, y: cheekR.y - faceRy * 0.05 }, r * 0.85, alpha);
  dot({ x: cx, y: cy + faceRy * 0.42 }, r * 0.45, alpha * 0.8);
  dot({ x: cx, y: cy + faceRy * 0.95 }, r * 0.55, alpha * 0.7);
  void faceRx;
}

function applyPortraitLayers(
  ctx: CanvasRenderingContext2D,
  regions: PortraitRegions,
  layers: Record<ActiveCatKey, LayerState>,
  substrateUndertone: Undertone | null
) {
  const { lipsOuter, lipsInner, eyeL, eyeR, faceWidthPx } = regions;

  const resolveShade = (cat: ActiveCatKey): Shade | null => {
    const layer = layers[cat];
    if (!layer.active) return null;
    const prod = products.find((p) => p.slug === layer.productSlug);
    if (!prod) return null;
    return (prod.shades[layer.shadeIdx] as Shade) ?? null;
  };

  // Lipstick — pure multiply matte (matches the v2 camera look).
  const lipstick = resolveShade("lipstick");
  if (lipstick) {
    const layer = layers.lipstick;
    paintLipsByFinish(
      ctx,
      lipsOuter,
      lipsInner,
      lipstick.hex,
      layer.intensity,
      layer.lipFinish ?? "matte"
    );
  }

  void substrateUndertone;

  // Blush — placement + formula aware.
  const blush = resolveShade("blush");
  if (blush) {
    const layer = layers.blush;
    paintBlushOnRegions(
      ctx,
      regions,
      blush.hex,
      layer.intensity,
      layer.blushPlacement ?? "apples",
      layer.blushFormula ?? "cream"
    );
  }

  // Eyeshadow — lid + crease + inner-corner cream highlight.
  // Portrait mode uses "source-over" (not "multiply") so all shades — including
  // light ones like Ivory Silk — are visible against the illustrated skin.
  const eyeshadow = resolveShade("eyeshadow");
  if (eyeshadow) {
    const intensity = layers.eyeshadow.intensity;
    const [r, g, b] = hexToRgb(eyeshadow.hex);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.38 + intensity * 0.32;
    ctx.fillStyle = eyeshadow.hex;
    fillPoly(ctx, eyeL.lid);
    fillPoly(ctx, eyeR.lid);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.28 + intensity * 0.28;
    for (const pts of [eyeL.crease, eyeR.crease]) {
      const top = pts.reduce((a, p) => (a.y < p.y ? a : p));
      const bot = pts.reduce((a, p) => (a.y > p.y ? a : p));
      const grad = ctx.createLinearGradient(top.x, top.y, bot.x, bot.y);
      // Gradient: opaque at top (crease depth) fading to transparent at bottom
      // (merging into the lid). This matches the real renderEyeshadow direction.
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      fillPoly(ctx, pts);
    }
    ctx.restore();

    // Inner-corner cream highlight.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.55;
    for (const eye of [eyeL, eyeR]) {
      const pt = eye.innerCorner;
      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 8);
      grad.addColorStop(0, "rgba(248,239,225,0.95)");
      grad.addColorStop(1, "rgba(248,239,225,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Eyeliner — style-aware (tightline / winged / smudged).
  const eyeliner = resolveShade("eyeliner");
  if (eyeliner) {
    const layer = layers.eyeliner;
    const style = layer.eyelinerStyle ?? "winged";
    const intensity = layer.intensity;
    const baseThickness = faceWidthPx * 0.008;

    if (style === "tightline") {
      const thickness = baseThickness * 0.4 + intensity * baseThickness * 0.3;
      ctx.save();
      ctx.strokeStyle = eyeliner.hex;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = thickness;
      smoothPath(ctx, eyeL.liner);
      ctx.stroke();
      smoothPath(ctx, eyeR.liner);
      ctx.stroke();
      ctx.restore();
    } else if (style === "smudged") {
      const thickness = baseThickness * 1.3 + intensity * baseThickness * 1.5;
      ctx.save();
      ctx.strokeStyle = eyeliner.hex;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.6 + intensity * 0.25;
      (ctx as any).filter = "blur(2px)";
      ctx.lineWidth = thickness;
      smoothPath(ctx, eyeL.liner);
      ctx.stroke();
      smoothPath(ctx, eyeR.liner);
      ctx.stroke();
      (ctx as any).filter = "none";
      ctx.lineWidth = thickness * 0.6;
      ctx.globalAlpha = 0.85;
      smoothPath(ctx, eyeL.liner);
      ctx.stroke();
      smoothPath(ctx, eyeR.liner);
      ctx.stroke();
      ctx.restore();
    } else {
      const thickness = baseThickness + intensity * baseThickness * 1.5;
      ctx.save();
      ctx.strokeStyle = eyeliner.hex;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.88 + intensity * 0.12;
      for (const eye of [eyeL, eyeR]) {
        ctx.lineWidth = thickness;
        smoothPath(ctx, eye.liner);
        ctx.stroke();

        const last = eye.liner[eye.liner.length - 1];
        const prev = eye.liner[eye.liner.length - 2];
        const dx = last.x - prev.x;
        const dy = last.y - prev.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          const nx = dx / len;
          const ny = dy / len;
          const wingLen = faceWidthPx * 0.025 * (0.5 + intensity * 0.5);
          ctx.beginPath();
          ctx.lineWidth = thickness * 0.8;
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(
            last.x + nx * wingLen,
            last.y + ny * wingLen - faceWidthPx * 0.01
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Nails removed — see "Coming Soon" treatment in UI.
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

// Frames of sustained detection loss required before we flip the no-face
// overlay on. ~30 frames ≈ 500 ms at 60 fps.
const NO_FACE_HYSTERESIS_FRAMES = 30;
const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Status =
  | "idle"
  | "loading-engine"
  | "starting-camera"
  | "ready"
  | "camera-denied"
  | "engine-failed";

// ──────────────────────────────────────────────────────────────────────────────
// Small presentational helper — pill-row for per-category style options.
// Kept inline (not a separate module) to avoid new file surface for one
// ~20-line component tightly coupled to the try-on panel's look.
// ──────────────────────────────────────────────────────────────────────────────

function StyleChips<T extends string>({
  label,
  options,
  current,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  current: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="filter-group-label" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {options.map((opt) => {
          const active = opt.value === current;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: "0.78rem",
                cursor: "pointer",
                border: `1px solid ${
                  active ? "var(--nura-ink, #1a1a1a)" : "var(--nura-line)"
                }`,
                background: active ? "var(--nura-ink, #1a1a1a)" : "#fff",
                color: active ? "#fff" : "var(--nura-ink, #1a1a1a)",
                transition: "background 120ms ease, color 120ms ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryIcon({ cat }: { cat: CatKey }) {
  switch (cat) {
    case "lipstick":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M8 4h8v4L13 12v8h-2v-8L8 8V4Z" />
        </svg>
      );
    case "lipgloss":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
          <path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z" />
        </svg>
      );
    case "blush":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <circle cx="9" cy="12" r="4" />
          <circle cx="15" cy="12" r="4" />
        </svg>
      );
    case "contour":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M5 17c2.5-6 11-10 14-10-1 4.5-4.5 9.5-9 11.5L5 17Z" />
        </svg>
      );
    case "eyeliner":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M4 14c4-4 9-6 16-5-3 1-4.5 2.5-5.5 5.5-4.5 0-7.5-1-10.5-.5Z" />
          <path d="M17 6l2-2 1 1-2 2-1-1Z" />
        </svg>
      );
    case "eyeshadow":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M3 12c2.5-4 6-6 9-6s6.5 2 9 6c-2.5 4-6 6-9 6s-6.5-2-9-6Z" />
          <circle cx="12" cy="12" r="2.5" fill="var(--nura-bg, #fff)" />
        </svg>
      );
    case "nails":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <rect x="5" y="7" width="3" height="10" rx="1.2" />
          <rect x="9.5" y="5" width="3" height="12" rx="1.2" />
          <rect x="14" y="6" width="3" height="11" rx="1.2" />
        </svg>
      );
  }
}

function PreviewStage({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

// Scan CTA — floating over the preview stage once the face is locked but
// before the user starts the scan. Replaces the old auto-trigger so no
// filters get applied before the user chooses to scan.
function ScanCTA({ onStart }: { onStart: () => void }) {
  return (
    <div className="tryon-scan-cta" role="region" aria-label="Start face scan">
      <div className="tryon-scan-cta-copy">
        <span className="tryon-scan-cta-eyebrow">You look radiant</span>
        <strong className="tryon-scan-cta-title">
          Let us find your perfect look
        </strong>
        <span className="tryon-scan-cta-sub">
          Quick face scan. Personalised shades in seconds.
        </span>
      </div>
      <button
        type="button"
        className="tryon-scan-cta-btn"
        onClick={onStart}
        aria-label="Start face scan for personalised recommendations"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path
            d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3M16 20h3a1 1 0 0 0 1-1v-3M8 12h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Scan my face
      </button>
    </div>
  );
}

// Curating overlay — shown between scan completion and the ProfileCard
// reveal. Sits on top of the preview stage, mirrors the scan overlay's
// z-index so it replaces it cleanly.
function CuratingOverlay() {
  const messages = [
    "Reading your undertone…",
    "Matching complementary shades…",
    "Curating your best look…",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setIdx((i) => (i + 1) % messages.length),
      600
    );
    return () => window.clearInterval(id);
  }, [messages.length]);
  return (
    <div className="tryon-curating" role="status" aria-live="polite">
      <div className="tryon-curating-orb">
        <span className="tryon-curating-orb-dot" />
      </div>
      <div className="tryon-curating-copy">
        <strong>{messages[idx]}</strong>
        <span>Personalising three looks for your face profile.</span>
      </div>
    </div>
  );
}

function SourceSelector({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function LayerDetail({ children }: { children: ReactNode }) {
  return <div className="tryon-layer-detail">{children}</div>;
}

function ControlsPanel({ children }: { children: ReactNode }) {
  return <div className="tryon-controls">{children}</div>;
}

function TryOnClient() {
  const sp = useSearchParams();
  const initialSlug = sp.get("product");
  const initialShade = sp.get("shade");

  const [source, setSource] = useState<SourceMode>("upload");
  const [modelIdx, setModelIdx] = useState(0);
  const [layers, setLayers] = useState<Record<ActiveCatKey, LayerState>>(
    buildDefaultLayers
  );
  const [activeTab, setActiveTab] = useState<ActiveCatKey>("lipstick");
  const [detectedTone, setDetectedTone] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preserveLayersOnPhotoChange, setPreserveLayersOnPhotoChange] = useState(true);
  const [snapMsg, setSnapMsg] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareValue, setCompareValue] = useState(50);

  // Gated narrative flow:
  //   idle → scanning → curating → showingProfile → playing
  // - scanning: scan overlay over preview
  // - curating: "Curating your best look…" overlay (rec already computed)
  // - showingProfile: ProfileCard hero, controls dimmed
  // - playing: full controls
  type FlowStage =
    | "idle"
    | "scanning"
    | "curating"
    | "showingProfile"
    | "playing";
  const [flowStage, setFlowStage] = useState<FlowStage>("idle");
  const [profile, setProfile] = useState<FaceProfile | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const scanTriggeredRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const isDraggingCompare = useRef(false);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const faceMeshRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const latestLandmarks = useRef<Point[] | null>(null);
  const smoothedLandmarks = useRef<LandmarkPoint[] | null>(null);
  const toneTimer = useRef<number>(0);
  const faceDetectedRef = useRef(false);
  const noFaceFramesRef = useRef(0);
  const cameraStartedRef = useRef(false);

  // Mutable copies of state for the stable render loop.
  const sourceRef = useRef<SourceMode>("upload");
  const layersRef = useRef(layers);
  const modelIdxRef = useRef(modelIdx);
  const detectedToneRef = useRef<string | null>(null);

  // Draggable compare divider — listen globally so fast drags don't lose the handle.
  useEffect(() => {
    const move = (clientX: number) => {
      if (!isDraggingCompare.current || !stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
      setCompareValue(Math.round(pct));
    };
    const onMouseMove = (e: MouseEvent) => move(e.clientX);
    const onTouchMove = (e: TouchEvent) => move(e.touches[0].clientX);
    const stop = () => { isDraggingCompare.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    if (!ENABLE_LIVE_CAMERA && source === "camera") {
      setSource("upload");
    }
  }, [source]);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  useEffect(() => {
    modelIdxRef.current = modelIdx;
  }, [modelIdx]);
  useEffect(() => {
    detectedToneRef.current = detectedTone;
  }, [detectedTone]);

  const { add } = useCart();

  // ─── URL params ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialSlug || initialShade) {
      setLayers((prev) => {
        const cat: ActiveCatKey = "lipstick";
        const slug = initialSlug ?? prev[cat].productSlug;
        const prod = products.find((p) => p.slug === slug);
        const idx =
          initialShade && prod
            ? Math.max(
                0,
                prod.shades.findIndex((s) => s.name === initialShade)
              )
            : prev[cat].shadeIdx;
        return {
          ...prev,
          [cat]: {
            ...prev[cat],
            productSlug: slug,
            shadeIdx: idx,
            active: true,
          },
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Global MediaPipe noise swallower ──────────────────────────────────────
  // Scoped to this page. Captures the `xhr.onprogress` TypeError that
  // @mediapipe/face_mesh fires while packed assets are streaming. The
  // payload still loads, so this is cosmetic noise only. We intercept in
  // the capture phase so Next.js's dev overlay never sees it.

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (
        isMediapipeNoise(e.filename, e.message, e.error?.stack ?? null)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: any = e.reason;
      if (
        reason &&
        isMediapipeNoise(
          reason.filename ?? null,
          typeof reason === "string" ? reason : reason?.message ?? null,
          reason?.stack ?? null
        )
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);

  // ─── helpers ────────────────────────────────────────────────────────────────

  const updateLayer = useCallback(
    (cat: ActiveCatKey, patch: Partial<LayerState>) => {
      setLayers((prev) => ({ ...prev, [cat]: { ...prev[cat], ...patch } }));
    },
    []
  );

  const toggleLayer = useCallback((cat: ActiveCatKey) => {
    setLayers((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], active: !prev[cat].active },
    }));
  }, []);

  // ─── MediaPipe bootstrap (lazy) ─────────────────────────────────────────────

  const ensureModels = useCallback(async () => {
    if (faceMeshRef.current) return;
    setStatus("loading-engine");
    setErrorMsg("");
    try {
      await loadScript(FACEMESH_URL);
      const w = window as any;
      if (!w.FaceMesh) {
        throw new Error("Face-tracking engine missing from page context.");
      }

      const fm = new w.FaceMesh({
        locateFile: (f: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${FACEMESH_VERSION}/${f}`,
      });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        // Lowered from 0.5/0.5. MediaPipe FaceMesh's short-range detector
        // loses confidence on extreme close-ups (face fills >60% of frame),
        // which was killing eyeliner tracking. 0.3 keeps the detector alive
        // without introducing noticeably more false positives at normal
        // distance.
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });
      fm.onResults((r: any) => {
        const fresh = r.multiFaceLandmarks?.[0] as LandmarkPoint[] | undefined;
        if (!fresh) {
          latestLandmarks.current = null;
          smoothedLandmarks.current = null;
          return;
        }
        const next = smoothFaceLandmarks(smoothedLandmarks.current, fresh);
        smoothedLandmarks.current = next;
        latestLandmarks.current = next;
      });
      faceMeshRef.current = fm;
      setStatus("ready");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Face tracking failed to load.");
      setStatus("engine-failed");
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    if (cameraStartedRef.current) return;
    cameraStartedRef.current = true;
    setStatus("starting-camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 800 },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus("ready");
    } catch {
      cameraStartedRef.current = false;
      setStatus("camera-denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraStartedRef.current = false;
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
  }, []);

  // ─── Main render loop — stable across layer / model changes ─────────────────

  const loop = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const src = sourceRef.current;
    const layersNow = layersRef.current;

    // Model mode — portrait + direct region painter, no MediaPipe.
    if (src === "model") {
      const w = (canvas.width = 640);
      const h = (canvas.height = 800);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const model = MODELS[modelIdxRef.current];
      const regions = drawPortrait(ctx, w, h, model);
      applyPortraitLayers(ctx, regions, layersNow, null);

      // Model mode always has a "face" — flip state once.
      if (!faceDetectedRef.current) {
        faceDetectedRef.current = true;
        setFaceDetected(true);
      }
      noFaceFramesRef.current = 0;

      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // Camera / Upload — MediaPipe path.
    const srcEl: HTMLVideoElement | HTMLImageElement | null =
      src === "camera" ? videoRef.current : imgRef.current;

    const w = (canvas.width = srcEl
      ? (srcEl as HTMLVideoElement).videoWidth ||
        (srcEl as HTMLImageElement).naturalWidth ||
        640
      : 640);
    const h = (canvas.height = srcEl
      ? (srcEl as HTMLVideoElement).videoHeight ||
        (srcEl as HTMLImageElement).naturalHeight ||
        800
      : 800);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // Guard: uploaded image must be fully decoded before drawImage.
    // Calling drawImage on an <img> with naturalWidth === 0 throws
    // InvalidStateError (HTML spec). Since this loop is async, an uncaught
    // throw here means requestAnimationFrame(loop) at the bottom never fires
    // and the loop dies permanently. Skip this frame and retry next tick.
    if (src === "upload" && srcEl && (srcEl as HTMLImageElement).naturalWidth === 0) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    if (srcEl) {
      try {
        if (src === "camera") {
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(srcEl as HTMLVideoElement, 0, 0, w, h);
          ctx.restore();
        } else {
          ctx.drawImage(srcEl as HTMLImageElement, 0, 0, w, h);
        }
      } catch (drawErr: any) {
        // drawImage can throw for two reasons:
        //   1. Video not yet playing (camera) — skip frame and retry next tick.
        //   2. SecurityError from crossOrigin-tainted canvas (upload) — log but
        //      do NOT return early; FaceMesh still gets whatever is on canvas.
        console.warn("[NURA] drawImage error:", drawErr?.name, drawErr?.message);
        if (src === "camera") {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        // For upload: fall through to send() even if draw failed — a blank
        // frame is better than zero detections because send() never fires.
      }
    }

    // Cap FaceMesh input at 640px — landmarks are normalised to 0-1 by
    // MediaPipe so downsampling here has zero effect on landmark accuracy,
    // but it reduces GPU/CPU load by ~25× on a typical 12-MP phone photo.
    // Without this, large uploads time out or exhaust canvas memory.
    const MAX_DETECT = 640;
    const dScale = Math.min(1, MAX_DETECT / Math.max(w || 1, h || 1));
    const dW = Math.max(1, Math.round(w * dScale));
    const dH = Math.max(1, Math.round(h * dScale));
    const off = offscreenRef.current ?? document.createElement("canvas");
    offscreenRef.current = off;
    off.width = dW;
    off.height = dH;
    const offCtx = off.getContext("2d");
    if (offCtx) offCtx.drawImage(canvas, 0, 0, dW, dH);

    try {
      if (faceMeshRef.current) {
        await faceMeshRef.current.send({ image: off });
      }
    } catch (e: any) {
      // Transient send errors are non-fatal — next frame will retry.
    }

    const lm = latestLandmarks.current;

    // Hysteresis-gated faceDetected state transitions (no per-frame setState).
    if (lm) {
      noFaceFramesRef.current = 0;
      if (!faceDetectedRef.current) {
        faceDetectedRef.current = true;
        setFaceDetected(true);
        // On uploaded photos: auto-start the scan so users get recommendations
        // immediately without having to find and click the Scan CTA.
        if (sourceRef.current === "upload" && !scanTriggeredRef.current) {
          scanTriggeredRef.current = true;
          setFlowStage("scanning");
        }
      }
    } else {
      noFaceFramesRef.current++;
      if (
        noFaceFramesRef.current >= NO_FACE_HYSTERESIS_FRAMES &&
        faceDetectedRef.current
      ) {
        faceDetectedRef.current = false;
        setFaceDetected(false);
      }
    }

    if (lm) {
      toneTimer.current++;
      if (!detectedToneRef.current && toneTimer.current > 60) {
        try {
          const tone = detectSkinTone(off, lm);
          detectedToneRef.current = tone;
          setDetectedTone(tone);
          toneTimer.current = 0;
        } catch {}
      }

      for (const cat of ALL_CATS) {
        const layer = layersNow[cat];
        if (!layer.active) continue;
        const prod = products.find((p) => p.slug === layer.productSlug);
        if (!prod) continue;
        const shadeVal = prod.shades[layer.shadeIdx];
        if (!shadeVal) continue;

        switch (cat) {
          case "lipstick":
            renderLipstick(
              ctx,
              lm,
              w,
              h,
              shadeVal,
              layer.intensity,
              layer.lipFinish ?? "matte"
            );
            break;
          case "blush":
            renderBlush(
              ctx,
              lm,
              w,
              h,
              shadeVal,
              layer.intensity,
              layer.blushPlacement ?? "apples",
              layer.blushFormula ?? "cream"
            );
            break;
          case "eyeliner":
            renderEyeliner(
              ctx,
              lm,
              w,
              h,
              shadeVal,
              layer.intensity,
              layer.eyelinerStyle ?? "winged"
            );
            break;
          case "eyeshadow":
            renderEyeshadow(ctx, lm, w, h, shadeVal, layer.intensity);
            break;
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  // Load MediaPipe only when camera / upload is selected.
  useEffect(() => {
    if (source === "camera" || source === "upload") {
      ensureModels();
    }
  }, [source, ensureModels]);

  // Manage camera + stream + loop on source/model change.
  useEffect(() => {
    // Reset detection state when source changes.
    latestLandmarks.current = null;
    smoothedLandmarks.current = null;
    noFaceFramesRef.current = 0;
    if (faceDetectedRef.current !== (source === "model")) {
      faceDetectedRef.current = source === "model";
      setFaceDetected(source === "model");
    }
    if (source !== "model") {
      detectedToneRef.current = null;
      setDetectedTone(null);
    } else {
      const tone = MODELS[modelIdx].skin;
      if (detectedToneRef.current !== tone) {
        detectedToneRef.current = tone;
        setDetectedTone(tone);
      }
    }

    if (ENABLE_LIVE_CAMERA && source === "camera" && status === "ready") {
      startCamera();
    } else if (source !== "camera") {
      stopCamera();
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [source, modelIdx, photoUrl, status, startCamera, stopCamera, loop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, [stopCamera]);
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // Reset scan + profile when source changes so each session gets a
  // fresh analysis. Stays quiet on model mode.
  useEffect(() => {
    scanTriggeredRef.current = false;
    // Model mode skips the gated narrative — no face to scan.
    setFlowStage(source === "model" ? "playing" : "idle");
    setProfile(null);
    setRecommendations([]);
  }, [source, modelIdx]);

  // Called by FaceScanOverlay when the scan animation finishes. Move to
  // "curating", derive profile, wait ~1.4s for the curating copy to feel
  // earned, then reveal the ProfileCard hero.
  const onScanComplete = useCallback(() => {
    setFlowStage("curating");
    const lm = latestLandmarks.current;
    const off = offscreenRef.current;

    let profileReady: FaceProfile | null = null;
    if (lm && off) {
      try {
        const tone = detectSkinTone(off, lm) as FaceProfile["tone"];
        const undertone = detectUndertone(off, lm);
        const shape = detectFaceShape(lm);
        profileReady = { tone, undertone, shape };
      } catch {
        // Silent fall-through — user can still use the full panel.
      }
    }

    window.setTimeout(() => {
      if (profileReady) {
        setProfile(profileReady);
        detectedToneRef.current = profileReady.tone;
        setDetectedTone(profileReady.tone);
        const recs = buildRecommendations(profileReady).filter(
          (r) => r.category !== "nails"
        );
        setRecommendations(recs);
        setFlowStage("showingProfile");
      } else {
        setFlowStage("playing");
      }
    }, 1400);
  }, []);

  const startScan = useCallback(() => {
    if (source === "model") return;
    scanTriggeredRef.current = true;
    setFlowStage("scanning");
  }, [source]);

  const applyRecommendation = useCallback(
    (rec: Recommendation) => {
      if (rec.category === "nails") return;
      setLayers((prev) => ({
        ...prev,
        [rec.category as ActiveCatKey]: {
          ...prev[rec.category as ActiveCatKey],
          active: true,
          productSlug: rec.product.slug,
          shadeIdx: rec.shadeIdx,
        },
      }));
      setActiveTab(rec.category as ActiveCatKey);
      setFlowStage("playing");
    },
    []
  );

  const applyAllRecommendations = useCallback(() => {
    setLayers((prev) => {
      const next = { ...prev };
      for (const rec of recommendations) {
        if (rec.category === "nails") continue;
        const cat = rec.category as ActiveCatKey;
        next[cat] = {
          ...prev[cat],
          active: true,
          productSlug: rec.product.slug,
          shadeIdx: rec.shadeIdx,
        };
      }
      return next;
    });
    setFlowStage("playing");
  }, [recommendations]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function clearUploadedPhoto() {
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    latestLandmarks.current = null;
    smoothedLandmarks.current = null;
    setFaceDetected(false);
    faceDetectedRef.current = false;
    setFlowStage("idle");
    setProfile(null);
    setRecommendations([]);
    setUploadError(null);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(f.type)) {
      setUploadError("Please upload a JPG, PNG, or WEBP image.");
      if (e.target) e.target.value = "";
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setUploadError(`Image is too large. Please upload a file under ${MAX_UPLOAD_MB}MB.`);
      if (e.target) e.target.value = "";
      return;
    }
    const nextUrl = URL.createObjectURL(f);
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    if (!preserveLayersOnPhotoChange) {
      setLayers(buildDefaultLayers());
    }
    latestLandmarks.current = null;
    smoothedLandmarks.current = null;
    faceDetectedRef.current = false;
    setFaceDetected(false);
    setFlowStage("idle");
    setProfile(null);
    setRecommendations([]);
    setUploadError(null);
    setSource("upload");
    if (e.target) e.target.value = "";
  }

  function onAddToCart() {
    const layer = layers[activeTab];
    const prod = products.find((p) => p.slug === layer.productSlug);
    if (!prod) return;
    const shadeVal = prod.shades[layer.shadeIdx];
    if (!shadeVal) return;
    add({
      slug: prod.slug,
      name: prod.name,
      shadeName: shadeVal.name,
      shadeHex: shadeVal.hex,
      price: prod.price,
      qty: 1,
    });
    setSnapMsg(`Added ${shadeVal.name}`);
    setTimeout(() => setSnapMsg(""), 1800);
  }

  function onSnapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "nura-look.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    setSnapMsg("Saved!");
    setTimeout(() => setSnapMsg(""), 2000);
  }

  function onReset() {
    setLayers(buildDefaultLayers());
  }

  function onRetryEngine() {
    faceMeshRef.current = null;
    ensureModels();
  }

  // ─── Derived values ─────────────────────────────────────────────────────────

  const tabLayer = layers[activeTab];
  const tabProduct = products.find((p) => p.slug === tabLayer.productSlug);
  const tabShade = tabProduct?.shades[tabLayer.shadeIdx];
  const tabCandidates = useMemo(
    () => products.filter((p) => p.tryOn === activeTab),
    [activeTab]
  );
  const activeLayers = ALL_CATS.filter((c) => layers[c].active);

  const showStartingCamera =
    source === "camera" && status === "starting-camera";
  const showEngineLoading =
    (source === "camera" || source === "upload") &&
    status === "loading-engine";
  const showEngineError = status === "engine-failed";
  const showCameraDenied = source === "camera" && status === "camera-denied";
  const showNoFaceOverlay =
    source !== "model" &&
    !showStartingCamera &&
    !showEngineLoading &&
    !showEngineError &&
    !showCameraDenied &&
    !(source === "upload" && !photoUrl) &&
    !faceDetected;

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 64 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Virtual Try-On Studio</h1>
        <p className="text-mute">
          Instantly try on any shade and find your perfect look. Your photo stays on your device.
        </p>
      </div>

      {flowStage === "showingProfile" &&
        profile &&
        recommendations.length > 0 && (
          <div className="tryon-profile-hero">
            <ProfileCard
              profile={profile}
              recommendations={recommendations}
              onApply={applyRecommendation}
              onApplyAll={applyAllRecommendations}
              onDismiss={() => setFlowStage("playing")}
            />
          </div>
        )}

      <div
        className={`tryon${
          flowStage === "scanning" || flowStage === "curating"
            ? " tryon-gated"
            : ""
        }${flowStage === "showingProfile" ? " tryon-dimmed" : ""}`}
      >
        {/* ── LEFT: Preview ── */}
        <PreviewStage>
          <div className="tryon-stage" aria-label="Try-on preview" ref={stageRef}>
            {/* CAMERA_MODE_START: Re-enable this block when ENABLE_LIVE_CAMERA is true. */}
            {/* {source === "camera" && (
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ transform: "scaleX(-1)" }}
                aria-label="Camera feed"
              />
            )} */}
            {/* CAMERA_MODE_END */}
            {source === "upload" && photoUrl && (
              // next/image doesn't fit here: photoUrl is a runtime blob URL, dimensions
              // are unknown, and MediaPipe FaceMesh consumes the raw HTMLImageElement
              // via imgRef. Disabling the rule locally is the correct move.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={photoUrl}
                alt="Your uploaded photo"
              />
            )}

            <canvas
              ref={canvasRef}
              aria-hidden
              style={
                compareMode && source !== "model"
                  ? {
                      clipPath: `inset(0 ${100 - compareValue}% 0 0)`,
                    }
                  : undefined
              }
            />

            {compareMode && source !== "model" && (
              <>
                {/* Floating labels sit on the image halves, not on the line */}
                <div className="tryon-compare-label tryon-compare-label--before"
                  style={{ right: `${100 - compareValue + 2}%` }}>Before</div>
                <div className="tryon-compare-label tryon-compare-label--after"
                  style={{ left: `${compareValue + 2}%` }}>After</div>
                {/* Draggable divider line + circular handle */}
                <div
                  className="tryon-compare-line"
                  style={{ left: `${compareValue}%` }}
                  onMouseDown={(e) => { e.preventDefault(); isDraggingCompare.current = true; }}
                  onTouchStart={() => { isDraggingCompare.current = true; }}
                  role="slider"
                  aria-valuenow={compareValue}
                  aria-valuemin={5}
                  aria-valuemax={95}
                  aria-label="Before and after comparison split"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") setCompareValue(v => Math.max(5, v - 2));
                    if (e.key === "ArrowRight") setCompareValue(v => Math.min(95, v + 2));
                  }}
                >
                  <div className="tryon-compare-handle" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M6 4l-4 5 4 5M12 4l4 5-4 5" stroke="var(--nura-plum-deep)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </>
            )}

            {showStartingCamera && (
              <div className="tryon-placeholder">
                <div className="tryon-spinner" />
                Starting camera…
              </div>
            )}
            {showEngineLoading && (
              <div className="tryon-placeholder">
                <div className="tryon-spinner" />
                Loading try-on engine…
              </div>
            )}
            {source === "upload" && !photoUrl && (
              <div className="tryon-placeholder tryon-placeholder--upload">
                <div className="tryon-placeholder-icon" aria-hidden>
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect x="2" y="2" width="36" height="36" rx="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
                    <circle cx="20" cy="16" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 34c0-6.627 5.373-10 12-10s12 3.373 12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="tryon-placeholder-title">Try on makeup instantly</p>
                <p className="tryon-placeholder-sub">Upload a clear front-facing photo to see any shade on your face in seconds. Your photo never leaves your device.</p>
                <button className="btn btn-primary tryon-placeholder-cta" onClick={openFilePicker}>
                  Upload photo
                </button>
              </div>
            )}
            <FaceScanOverlay
              visible={
                flowStage === "scanning" &&
                faceDetected &&
                source !== "model"
              }
              onComplete={onScanComplete}
            />

            {flowStage === "curating" && (
              <CuratingOverlay />
            )}

            {flowStage === "idle" &&
              faceDetected &&
              source !== "model" && (
                <ScanCTA onStart={startScan} />
              )}

            {showNoFaceOverlay && (
              <div className="tryon-no-face">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <ellipse
                    cx="40"
                    cy="38"
                    rx="28"
                    ry="34"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                  <circle
                    cx="30"
                    cy="32"
                    r="4"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="50"
                    cy="32"
                    r="4"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="2"
                  />
                  <path
                    d="M28 52 Q40 60 52 52"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span>We could not detect a face. Try a brighter, front-facing photo.</span>
              </div>
            )}
          </div>
          {uploadError && (
            <div className="tryon-status-chip" role="alert">
              <div>{uploadError}</div>
              <button className="btn btn-ghost tryon-chip-btn" onClick={openFilePicker}>
                Upload another
              </button>
            </div>
          )}
          {showNoFaceOverlay && source === "upload" && photoUrl && (
            <div className="tryon-status-chip" role="status">
              <div>Need help? Use a photo with one visible face, neutral angle, and no heavy shadows.</div>
              <button className="btn btn-ghost tryon-chip-btn" onClick={openFilePicker}>
                Change photo
              </button>
            </div>
          )}

          {/* Status chip (camera-denied / engine-failed) — small, below the stage */}
          {(showCameraDenied || showEngineError) && (
            <div className="tryon-status-chip" role="status">
              <div>
                {ENABLE_LIVE_CAMERA && showCameraDenied && (
                  <>
                    <strong>Camera access needed.</strong> Allow camera in your
                    browser, then retry.
                  </>
                )}
                {showEngineError && (
                  <>
                    <strong>Face tracker couldn&apos;t load.</strong>{" "}
                    {errorMsg ? `${errorMsg} ` : ""}Check your connection and
                    retry.
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {showCameraDenied && (
                  <button
                    className="btn btn-ghost tryon-chip-btn"
                    onClick={() => {
                      cameraStartedRef.current = false;
                      startCamera();
                    }}
                  >
                    Retry camera
                  </button>
                )}
                {showEngineError && (
                  <button
                    className="btn btn-ghost tryon-chip-btn"
                    onClick={onRetryEngine}
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}


          {/* Action bar below stage */}
          <div className="tryon-actionbar">
            <button
              className="btn btn-ghost tryon-action-btn"
              onClick={onSnapshot}
            >
              {snapMsg || "Save look"}
            </button>
            {source !== "model" && (
              <button
                className="btn btn-ghost tryon-action-btn"
                onClick={() => setCompareMode((v) => !v)}
                aria-pressed={compareMode}
              >
                {compareMode ? "Hide Compare" : "Compare"}
              </button>
            )}
            <button
              className="btn btn-ghost tryon-action-btn"
              onClick={onReset}
              aria-label="Reset all layers"
            >
              Reset makeup
            </button>
            {source === "upload" && photoUrl && (
              <>
                <button className="btn btn-ghost tryon-action-btn" onClick={openFilePicker}>
                  Change photo
                </button>
                <button className="btn btn-ghost tryon-action-btn" onClick={clearUploadedPhoto}>
                  Remove photo
                </button>
              </>
            )}
            {activeLayers.length > 0 && (
              <div className="tryon-active-pills">
                {activeLayers.map((cat) => {
                  const layer = layers[cat];
                  const prod = products.find(
                    (p) => p.slug === layer.productSlug
                  );
                  const shadeVal = prod?.shades[layer.shadeIdx];
                  if (!shadeVal) return null;
                  return (
                    <span key={cat} className="tryon-active-pill">
                      <span
                        className="tryon-active-pill-dot"
                        style={{ background: shadeVal.hex }}
                      />
                      <button
                        type="button"
                        className="tryon-active-pill-label"
                        onClick={() => setActiveTab(cat)}
                        aria-label={`Edit ${CATEGORY_LABELS[cat]}`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                      <button
                        type="button"
                        className="tryon-active-pill-close"
                        onClick={() =>
                          updateLayer(cat, { active: false })
                        }
                        aria-label={`Remove ${CATEGORY_LABELS[cat]}`}
                        title={`Remove ${CATEGORY_LABELS[cat]}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="tryon-privacy" style={{ marginTop: 10 }}>
            <span>Secure</span>
            <div>
              <strong>Private by design.</strong> Nothing leaves your device.
              All detection runs in your browser.
            </div>
          </div>
        </PreviewStage>

        {/* ── RIGHT: Controls ── */}
        <ControlsPanel>
          <div className="tryon-controls-header">
            <h2 className="tryon-controls-title">Your studio</h2>
            <span className="tryon-controls-sub">Upload and try</span>
          </div>
          {/* Source selector */}
          <SourceSelector>
            <div className="filter-group-label">Photo source</div>
            <div className="tryon-source" aria-label="Photo source">
              <button
                type="button"
                className={source === "upload" ? "active" : ""}
                onClick={openFilePicker}
                aria-pressed={source === "upload"}

              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14"
                    fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
                  />
                </svg>
                Upload
              </button>
              {/* CAMERA_BUTTON_START: Re-enable when ENABLE_LIVE_CAMERA is true. */}
              {/*
              <button
                type="button"
                className={source === "camera" ? "active" : ""}
                onClick={() => setSource("camera")}
                aria-pressed={source === "camera"}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M9 5.5 7.5 7.5H4a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 19.5h16a1.5 1.5 0 0 0 1.5-1.5V9A1.5 1.5 0 0 0 20 7.5h-3.5L15 5.5h-6Z M12 10.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"
                    fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
                  />
                </svg>
                Camera
              </button>
              */}
              {/* CAMERA_BUTTON_END */}
              <button
                type="button"
                className={source === "model" ? "active" : ""}
                onClick={() => setSource("model")}
                aria-pressed={source === "model"}

              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
                    fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                  />
                </svg>
                Model
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onUpload}
                style={{ display: "none" }}
                aria-hidden
              />
            </div>
            <div className="tryon-upload-controls">
              <button type="button" className="btn btn-primary" onClick={openFilePicker}>
                {photoUrl ? "Upload another" : "Upload photo"}
              </button>
              {photoUrl && (
                <>
                  <button type="button" className="btn btn-ghost" onClick={openFilePicker}>
                    Change photo
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearUploadedPhoto}>
                    Remove photo
                  </button>
                </>
              )}
            </div>
            <label className="tryon-upload-behavior">
              <input
                type="checkbox"
                checked={preserveLayersOnPhotoChange}
                onChange={(e) => setPreserveLayersOnPhotoChange(e.target.checked)}
              />
              <span>Keep current makeup layers when photo changes</span>
            </label>
            {source === "model" && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                {MODELS.map((m, i) => (
                  <button
                    key={m.name}
                    type="button"
                    className={`filter-chip ${
                      modelIdx === i ? "active" : ""
                    }`}
                    onClick={() => setModelIdx(i)}
                    aria-pressed={modelIdx === i}
                    aria-label={`Use model ${m.name}`}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        display: "inline-block",
                        background: m.skinHex,
                        marginRight: 4,
                        flexShrink: 0,
                      }}
                    />
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </SourceSelector>

          {/* Layer toggle row */}
          <div>
            <div className="filter-group-label">Active layers</div>
            <div className="tryon-layer-row">
              {ALL_CATS.map((cat) => {
                const layer = layers[cat];
                const prod = products.find(
                  (p) => p.slug === layer.productSlug
                );
                const shadeVal = prod?.shades[layer.shadeIdx];
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`tryon-layer-chip ${
                      layer.active ? "active" : ""
                    } ${activeTab === cat ? "focused" : ""}`}
                    onClick={() => {
                      setActiveTab(cat);
                      toggleLayer(cat);
                    }}
                    aria-pressed={layer.active}
                    aria-label={`${CATEGORY_LABELS[cat]} ${
                      layer.active ? "(on)" : "(off)"
                    }`}
                    title={CATEGORY_LABELS[cat]}
                  >
                    <span className="tryon-layer-icon">
                      <CategoryIcon cat={cat} />
                    </span>
                    {layer.active && shadeVal && (
                      <span
                        className="tryon-layer-chip-dot"
                        style={{ background: shadeVal.hex }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--nura-mute)",
                marginTop: 6,
              }}
            >
              Single-click toggles a layer on or off. Remove from the pills
              above the privacy note.
            </p>

            {COMING_SOON_CATS.length > 0 && (
              <div className="tryon-coming-soon">
                <div
                  className="filter-group-label"
                  style={{ marginTop: 10, marginBottom: 4 }}
                >
                  Coming soon
                </div>
                <div className="tryon-layer-row">
                  {COMING_SOON_CATS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className="tryon-layer-chip coming-soon"
                      disabled
                      aria-disabled
                      title={`${CATEGORY_LABELS[cat]} — coming soon`}
                    >
                      <span className="tryon-layer-icon">
                        <CategoryIcon cat={cat} />
                      </span>
                      <span className="tryon-layer-chip-soon">Soon</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tab detail — edit the activeTab layer */}
          <LayerDetail>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <strong style={{ fontSize: "0.95rem", display: "inline-flex", gap: 6, alignItems: "center" }}>
                <span className="tryon-layer-icon">
                  <CategoryIcon cat={activeTab} />
                </span>
                {CATEGORY_LABELS[activeTab]}
              </strong>
              <label
                className="tryon-toggle"
                aria-label={`Toggle ${CATEGORY_LABELS[activeTab]}`}
              >
                <input
                  type="checkbox"
                  checked={tabLayer.active}
                  onChange={(e) =>
                    updateLayer(activeTab, { active: e.target.checked })
                  }
                />
                <span className="tryon-toggle-track" />
              </label>
            </div>

            {tabCandidates.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div
                  className="filter-group-label"
                  style={{ marginBottom: 4 }}
                >
                  Product
                </div>
                <select
                  value={tabLayer.productSlug}
                  onChange={(e) =>
                    updateLayer(activeTab, {
                      productSlug: e.target.value,
                      shadeIdx: 0,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--nura-line)",
                    fontSize: "0.875rem",
                  }}
                >
                  {tabCandidates.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} — £{p.price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tabProduct && (
              <div style={{ marginBottom: 12 }}>
                <div
                  className="filter-group-label"
                  style={{ marginBottom: 4 }}
                >
                  Shade
                </div>
                <div className="tryon-shade-grid">
                  {tabProduct.shades.map((s, i) => {
                    const recommended =
                      detectedTone &&
                      s.recommendedFor?.includes(detectedTone as any);
                    return (
                      <div key={s.name} className="tryon-shade-item">
                        <button
                          type="button"
                          className={`swatch ${
                            i === tabLayer.shadeIdx ? "active" : ""
                          } ${recommended ? "swatch-recommended" : ""}`}
                          style={{ backgroundColor: s.hex }}
                          onClick={() =>
                            updateLayer(activeTab, { shadeIdx: i })
                          }
                          aria-label={`${s.name}${
                            recommended
                              ? " — recommended for your skin tone"
                              : ""
                          }`}
                          aria-pressed={i === tabLayer.shadeIdx}
                        />
                        <span>{s.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="tryon-shade-compare"
                  aria-label="Quick shade comparison"
                >
                  <span>Compare shades</span>
                  {tabProduct.shades.slice(0, 4).map((s, i) => (
                    <button
                      key={s.name}
                      type="button"
                      className={i === tabLayer.shadeIdx ? "active" : ""}
                      onClick={() => {
                        updateLayer(activeTab, { active: true, shadeIdx: i });
                        if (source !== "model") setCompareMode(true);
                      }}
                      aria-pressed={i === tabLayer.shadeIdx}
                    >
                      <span style={{ background: s.hex }} />
                      {s.name}
                    </button>
                  ))}
                </div>
                {detectedTone && (
                  <div className="tryon-recommend" style={{ marginTop: 8 }}>
                    ★ Starred shades match{" "}
                    {source === "model"
                      ? "this model's"
                      : "your detected"}{" "}
                    tone (
                    {skinTones.find((t) => t.slug === detectedTone)?.label})
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div className="filter-group-label" style={{ marginBottom: 4 }}>
                Intensity —{" "}
                <span style={{ fontWeight: 600 }}>
                  {Math.round(tabLayer.intensity * 100)}%
                </span>
              </div>
              <div className="tryon-intensity">
                <span style={{ fontSize: "0.78rem" }}>Soft</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={tabLayer.intensity}
                  onChange={(e) =>
                    updateLayer(activeTab, {
                      intensity: parseFloat(e.target.value),
                    })
                  }
                  aria-label="Intensity"
                />
                <span style={{ fontSize: "0.78rem" }}>Bold</span>
              </div>
            </div>

            {activeTab === "lipstick" && (
              <StyleChips<LipFinish>
                label="Finish"
                options={[
                  { value: "matte", label: "Matte" },
                  { value: "satin", label: "Satin" },
                  { value: "glossy", label: "Glossy" },
                  { value: "sheer", label: "Sheer" },
                  { value: "shimmer", label: "Shimmer" },
                ]}
                current={tabLayer.lipFinish ?? "matte"}
                onChange={(v) =>
                  updateLayer(activeTab, { lipFinish: v })
                }
              />
            )}

            {activeTab === "blush" && (
              <>
                <StyleChips<BlushPlacement>
                  label="Placement"
                  options={[
                    { value: "apples", label: "Apples" },
                    { value: "lifted", label: "Lifted" },
                    { value: "diffused", label: "Diffused" },
                  ]}
                  current={tabLayer.blushPlacement ?? "apples"}
                  onChange={(v) =>
                    updateLayer(activeTab, { blushPlacement: v })
                  }
                />
                <StyleChips<BlushFormula>
                  label="Formula"
                  options={[
                    { value: "cream", label: "Cream" },
                    { value: "powder", label: "Powder" },
                  ]}
                  current={tabLayer.blushFormula ?? "cream"}
                  onChange={(v) =>
                    updateLayer(activeTab, { blushFormula: v })
                  }
                />
              </>
            )}

            {activeTab === "eyeliner" && (
              <StyleChips<EyelinerStyle>
                label="Style"
                options={[
                  { value: "winged", label: "Winged" },
                  { value: "tightline", label: "Tightline" },
                  { value: "smudged", label: "Smudged" },
                ]}
                current={tabLayer.eyelinerStyle ?? "winged"}
                onChange={(v) =>
                  updateLayer(activeTab, { eyelinerStyle: v })
                }
              />
            )}

            {tabProduct && tabShade && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid var(--nura-line)",
                  padding: "12px 14px",
                  borderRadius: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>
                    {tabProduct.name}
                  </strong>
                  <div className="text-mute" style={{ fontSize: "0.8rem" }}>
                    {tabShade.name} · £{tabProduct.price.toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                  onClick={onAddToCart}
                >
                  Add to Cart
                </button>
              </div>
            )}
          </LayerDetail>

          <p
            className="text-mute"
            style={{ fontSize: "0.78rem", marginTop: 4 }}
          >
            Good lighting improves detection accuracy.{" "}
            <Link href="/halal">Halal assurance →</Link>
          </p>
        </ControlsPanel>
      </div>
    </div>
  );
}

export default function TryOnPage() {
  return (
    <Suspense fallback={<div className="container section">Loading try-on studio...</div>}>
      <TryOnClient />
    </Suspense>
  );
}
