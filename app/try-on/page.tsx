"use client";
// NURA Virtual Try-On Studio v5
// ─────────────────────────────
// Pipeline:
//   1. User selects a source (live camera or uploaded photo).
//   2. FaceMesh loads lazily from CDN on first use.
//   3. Every animation frame: MediaPipe detection → render active layers on real face.
//   4. On scan complete: POST to /api/analyze → skin tone + undertone + face shape
//      + personalised shade recommendations returned from server.
//
// Architecture:
//   - All per-frame rendering is client-side (required for real-time AR).
//   - One-shot skin analysis and recommendations are server-side (/api/analyze).
//   - /api/products serves the full catalog with Cache-Control headers.

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
import CapturePhotoModal from "./_components/CapturePhotoModal";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type SourceMode = "camera" | "upload";
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
  // Capture modal — the on-spot webcam photo-booth flow.
  const [captureOpen, setCaptureOpen] = useState(false);

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
  // EXIF-corrected bitmap for uploaded photos (createImageBitmap applies orientation).
  const uploadBitmapRef = useRef<ImageBitmap | null>(null);
  // Stable ref to ensureModels so the RAF loop can call it without a dep.
  const ensureModelsRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // Counts consecutive no-detection frames on a static upload so we can
  // force a FaceMesh reset and trigger a fresh full-image detection pass.
  const noDetectUploadFrames = useRef(0);

  // Mutable copies of state for the stable render loop.
  const sourceRef = useRef<SourceMode>("upload");
  const layersRef = useRef(layers);
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
      // Keep stable ref in sync so the RAF loop can call ensureModels.
      ensureModelsRef.current = ensureModels;
      setStatus("ready");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Face tracking failed to load.");
      setStatus("engine-failed");
    }
  }, []);

  // Keep ensureModelsRef current after every render so the loop always has
  // the latest version without needing it in the loop's dependency array.
  useEffect(() => {
    ensureModelsRef.current = ensureModels;
  });

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


    // ── Source element resolution ────────────────────────────────────────────
    // For uploads we prefer the EXIF-corrected ImageBitmap (created in onUpload
    // via createImageBitmap({ imageOrientation: 'from-image' })). This fixes
    // portrait photos taken on phones where the raw pixel data is rotated 90°
    // but the EXIF tag says "display rotated" — drawImage on a plain <img>
    // ignores that tag in some browsers, sending a sideways face to MediaPipe.
    const bitmap = src === "upload" ? uploadBitmapRef.current : null;
    const srcEl: HTMLVideoElement | HTMLImageElement | null =
      src === "camera" ? videoRef.current : imgRef.current;

    // Bitmap dimensions take priority for uploads (they are post-EXIF dimensions).
    const w = (canvas.width = bitmap
      ? bitmap.width
      : srcEl
        ? (srcEl as HTMLVideoElement).videoWidth ||
          (srcEl as HTMLImageElement).naturalWidth ||
          640
        : 640);
    const h = (canvas.height = bitmap
      ? bitmap.height
      : srcEl
        ? (srcEl as HTMLVideoElement).videoHeight ||
          (srcEl as HTMLImageElement).naturalHeight ||
          800
        : 800);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // Guard: for upload mode we need either a bitmap or a fully decoded img.
    // Skip the frame (and retry next tick) until the source is ready.
    if (src === "upload" && !bitmap && srcEl && (srcEl as HTMLImageElement).naturalWidth === 0) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    // Also skip if upload mode but nothing is available yet at all.
    if (src === "upload" && !bitmap && !srcEl) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    if (bitmap) {
      // EXIF-corrected upload — draw directly from the ImageBitmap.
      try {
        ctx.drawImage(bitmap, 0, 0, w, h);
      } catch (drawErr: any) {
        console.warn("[NURA] bitmap drawImage error:", drawErr?.name, drawErr?.message);
      }
    } else if (srcEl) {
      try {
        if (src === "camera") {
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(srcEl as HTMLVideoElement, 0, 0, w, h);
          ctx.restore();
        } else {
          // Fallback for uploads on browsers where createImageBitmap isn't
          // available — modern browsers also apply EXIF via drawImage(<img>).
          ctx.drawImage(srcEl as HTMLImageElement, 0, 0, w, h);
        }
      } catch (drawErr: any) {
        console.warn("[NURA] drawImage error:", drawErr?.name, drawErr?.message);
        if (src === "camera") {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
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
      noDetectUploadFrames.current = 0;
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

      // ── Static-image tracker-lock reset ──────────────────────────────────
      // MediaPipe FaceMesh is designed for video: after it misses a face on
      // frame 1 of a static upload its tracker is never initialised, so ALL
      // subsequent sends also return empty — even with the same image sitting
      // there. Fix: after ~2 s (120 frames) of zero detections on an upload,
      // destroy and recreate the FaceMesh instance so the next send triggers a
      // full fresh detection pass instead of a tracking-only pass.
      if (sourceRef.current === "upload" && uploadBitmapRef.current) {
        noDetectUploadFrames.current++;
        if (noDetectUploadFrames.current >= 120 && faceMeshRef.current) {
          try { faceMeshRef.current.close?.(); } catch {}
          faceMeshRef.current = null;
          noDetectUploadFrames.current = 0;
          // ensureModels recreates the instance; the next loop iteration will
          // call send() once faceMeshRef.current is populated again.
          void ensureModelsRef.current();
        }
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

  // Manage camera + stream + loop on source change.
  useEffect(() => {
    // Reset detection state when source changes.
    latestLandmarks.current = null;
    smoothedLandmarks.current = null;
    noFaceFramesRef.current = 0;
    noDetectUploadFrames.current = 0;
    faceDetectedRef.current = false;
    setFaceDetected(false);
    detectedToneRef.current = null;
    setDetectedTone(null);

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
  }, [source, photoUrl, status, startCamera, stopCamera, loop]);

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

  // Reset scan + profile when source changes so each session gets a fresh analysis.
  useEffect(() => {
    scanTriggeredRef.current = false;
    setFlowStage("idle");
    setProfile(null);
    setRecommendations([]);
  }, [source]);

  // Called by FaceScanOverlay when the scan animation finishes. Move to
  // "curating", call /api/analyze with skin sample + landmarks, then reveal
  // the ProfileCard hero once results arrive.
  const onScanComplete = useCallback(async () => {
    setFlowStage("curating");
    const lm = latestLandmarks.current;
    const off = offscreenRef.current;

    // Sample skin pixels client-side (fast, no server trip needed for raw pixels)
    let skinSample = { r: 180, g: 140, b: 110 }; // safe fallback
    if (lm && off) {
      const ctx = off.getContext("2d");
      if (ctx) {
        const samplePts = [10, 50, 280, 1, 151];
        let r = 0, g = 0, b = 0, n = 0;
        for (const idx of samplePts) {
          const pt = lm[idx];
          if (!pt) continue;
          const px = Math.floor(pt.x * off.width);
          const py = Math.floor(pt.y * off.height);
          try {
            const d = ctx.getImageData(Math.max(0, px - 6), Math.max(0, py - 6), 12, 12).data;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
          } catch {}
        }
        if (n > 0) skinSample = { r: r/n, g: g/n, b: b/n };
      }
    }

    // Hit the backend for analysis — server handles tone/undertone/shape + recommendations
    let profileReady: FaceProfile | null = null;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinSample, landmarks: lm ?? [] }),
      });
      if (res.ok) {
        const data = await res.json();
        profileReady = {
          tone: data.skinTone.category,
          undertone: data.undertone,
          shape: data.faceShape,
        };
      }
    } catch {
      // Network error — fall back to client-side detection
      if (lm && off) {
        try {
          const tone = detectSkinTone(off, lm) as FaceProfile["tone"];
          const undertone = detectUndertone(off, lm);
          const shape = detectFaceShape(lm);
          profileReady = { tone, undertone, shape };
        } catch {}
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
    }, 600); // shorter delay since server already added latency
  }, []);

  const startScan = useCallback(() => {
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
    if (uploadBitmapRef.current) {
      uploadBitmapRef.current.close();
      uploadBitmapRef.current = null;
    }
    latestLandmarks.current = null;
    smoothedLandmarks.current = null;
    noDetectUploadFrames.current = 0;
    setFaceDetected(false);
    faceDetectedRef.current = false;
    setFlowStage("idle");
    setProfile(null);
    setRecommendations([]);
    setUploadError(null);
  }

  // Shared pipeline used by BOTH the file picker and the in-app camera
  // capture modal. Takes any image-bearing Blob (incl. File), runs it
  // through the EXIF-corrected bitmap path, and resets detection state so
  // the auto-scan can fire for the new face.
  const acceptBlob = useCallback(
    (blob: Blob) => {
      if (!ACCEPTED_UPLOAD_TYPES.includes(blob.type) && !blob.type.startsWith("image/")) {
        setUploadError("Please use a JPG, PNG, or WEBP image.");
        return;
      }
      if (blob.size > MAX_UPLOAD_BYTES) {
        setUploadError(`Image is too large. Please use one under ${MAX_UPLOAD_MB}MB.`);
        return;
      }

      // Close the previous bitmap to free GPU memory.
      if (uploadBitmapRef.current) {
        uploadBitmapRef.current.close();
        uploadBitmapRef.current = null;
      }

      // createImageBitmap with imageOrientation:'from-image' applies the
      // EXIF rotation tag so MediaPipe receives an upright face regardless
      // of how the phone was held. Falls back to null on unsupported
      // browsers — the loop will use the <img> element instead.
      if (typeof createImageBitmap === "function") {
        createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions)
          .then((bmp) => { uploadBitmapRef.current = bmp; })
          .catch(() => { /* fallback: loop uses imgRef */ });
      }

      const nextUrl = URL.createObjectURL(blob);
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
      noDetectUploadFrames.current = 0;
      scanTriggeredRef.current = false;
      setFaceDetected(false);
      setFlowStage("idle");
      setProfile(null);
      setRecommendations([]);
      setUploadError(null);
      setSource("upload");
    },
    [preserveLayersOnPhotoChange]
  );

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(f.type)) {
      setUploadError("Please upload a JPG, PNG, or WEBP image.");
      if (e.target) e.target.value = "";
      return;
    }
    acceptBlob(f);
    if (e.target) e.target.value = "";
  }

  function onCaptureFromCamera(blob: Blob) {
    // The capture modal hands us a JPEG blob already.
    acceptBlob(blob);
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
                compareMode
                  ? {
                      clipPath: `inset(0 ${100 - compareValue}% 0 0)`,
                    }
                  : undefined
              }
            />

            {compareMode && (
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
                <p className="tryon-placeholder-sub">Take a quick selfie or upload a photo. Detection runs in your browser — your image never leaves your device.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button className="btn btn-primary tryon-placeholder-cta" onClick={() => setCaptureOpen(true)}>
                    Take photo now
                  </button>
                  <button className="btn btn-ghost tryon-placeholder-cta" onClick={openFilePicker}>
                    Upload from device
                  </button>
                </div>
              </div>
            )}
            <FaceScanOverlay
              visible={
                flowStage === "scanning" &&
                faceDetected
              }
              onComplete={onScanComplete}
            />

            {flowStage === "curating" && (
              <CuratingOverlay />
            )}

            {flowStage === "idle" && faceDetected && (
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
            <button
              className="btn btn-ghost tryon-action-btn"
              onClick={() => setCompareMode((v) => !v)}
              aria-pressed={compareMode}
            >
              {compareMode ? "Hide Compare" : "Compare"}
            </button>
            <button
              className="btn btn-ghost tryon-action-btn"
              onClick={onReset}
              aria-label="Reset all layers"
            >
              Reset makeup
            </button>
            {source === "upload" && photoUrl && (
              <>
                <button className="btn btn-ghost tryon-action-btn" onClick={() => setCaptureOpen(true)}>
                  Retake photo
                </button>
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
              <button
                type="button"
                onClick={() => setCaptureOpen(true)}
                aria-label="Take a photo using your camera"
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M9 5.5 7.5 7.5H4a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 19.5h16a1.5 1.5 0 0 0 1.5-1.5V9A1.5 1.5 0 0 0 20 7.5h-3.5L15 5.5h-6Z"
                    fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
                  />
                  <circle
                    cx="12" cy="13.5" r="3.25"
                    fill="none" stroke="currentColor" strokeWidth="1.6"
                  />
                </svg>
                Take photo
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
              <button type="button" className="btn btn-primary" onClick={() => setCaptureOpen(true)}>
                {photoUrl ? "Take another" : "Take photo"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={openFilePicker}>
                {photoUrl ? "Upload another" : "Upload photo"}
              </button>
              {photoUrl && (
                <button type="button" className="btn btn-ghost" onClick={clearUploadedPhoto}>
                  Remove photo
                </button>
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
                        setCompareMode(true);
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
                    ★ Starred shades match your detected tone (
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

      {/* On-spot camera capture — opens an overlay with live preview, captures
          a single still, then hands the blob to acceptBlob() which runs it
          through the same EXIF-corrected pipeline as a file upload. The
          camera stream is stopped and released on close — no media leaves
          the device. */}
      <CapturePhotoModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={onCaptureFromCamera}
      />
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
