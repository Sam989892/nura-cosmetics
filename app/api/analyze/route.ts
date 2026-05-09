import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type SkinDepth = "fair" | "light" | "medium" | "tan" | "deep";
type Undertone = "warm" | "cool" | "neutral";
type FaceShape = "oval" | "round" | "square" | "heart" | "long";
type TryOnCategory = "lipstick" | "blush" | "eyeliner" | "eyeshadow";

interface Point { x: number; y: number; z?: number }

interface AnalyzeRequest {
  // Average RGB of skin pixels sampled at landmark points [10, 50, 280, 1, 151]
  skinSample: { r: number; g: number; b: number };
  // All 468 normalised landmarks [{x,y,z}] — only the subset we need is read
  landmarks: Point[];
}

interface ShadeRec {
  productSlug: string;
  productName: string;
  shadeName: string;
  shadeHex: string;
  shadeIdx: number;
  score: number;
}

interface AnalyzeResponse {
  skinTone: { category: SkinDepth; hex: string; label: string };
  undertone: Undertone;
  faceShape: FaceShape;
  recommendations: Record<TryOnCategory, ShadeRec[]>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Skin-tone detection — luminance thresholds (matches client-side engine)
// ──────────────────────────────────────────────────────────────────────────────

function classifySkinTone(r: number, g: number, b: number): SkinDepth {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 200) return "fair";
  if (lum > 170) return "light";
  if (lum > 135) return "medium";
  if (lum > 95)  return "tan";
  return "deep";
}

function skinToneHex(category: SkinDepth): string {
  const map: Record<SkinDepth, string> = {
    fair:   "#f5e0d0",
    light:  "#e3b999",
    medium: "#c89878",
    tan:    "#a37353",
    deep:   "#6d4733",
  };
  return map[category];
}

function skinToneLabel(category: SkinDepth): string {
  const map: Record<SkinDepth, string> = {
    fair:   "Fair Porcelain",
    light:  "Light Ivory",
    medium: "Warm Sand",
    tan:    "Golden Tan",
    deep:   "Rich Espresso",
  };
  return map[category];
}

// ──────────────────────────────────────────────────────────────────────────────
// Undertone detection (mirrors client-side heuristic)
// ──────────────────────────────────────────────────────────────────────────────

function classifyUndertone(r: number, g: number, b: number): Undertone {
  const sum = r + g + b;
  if (sum === 0) return "neutral";
  const warmness = r / sum - 0.34;
  const coolness  = b / sum - 0.30;
  if (warmness > coolness + 0.01) return "warm";
  if (coolness > warmness + 0.01) return "cool";
  return "neutral";
}

// ──────────────────────────────────────────────────────────────────────────────
// Face-shape detection from normalised landmarks (identical to engine export)
// ──────────────────────────────────────────────────────────────────────────────

function detectFaceShape(lm: Point[]): FaceShape {
  const top      = lm[10];
  const chin     = lm[152];
  const cheekL   = lm[234];
  const cheekR   = lm[454];
  const jawL     = lm[172];
  const jawR     = lm[397];
  const templeL  = lm[21];
  const templeR  = lm[251];
  if (!top || !chin || !cheekL || !cheekR || !jawL || !jawR) return "oval";

  const faceH      = Math.abs(chin.y - top.y);
  const cheekW     = Math.abs(cheekR.x - cheekL.x);
  const jawW       = Math.abs(jawR.x  - jawL.x);
  const foreheadW  = templeL && templeR
    ? Math.abs(templeR.x - templeL.x)
    : cheekW * 0.85;

  if (cheekW === 0) return "oval";
  const heightRatio   = faceH / cheekW;
  const jawRatio      = jawW / cheekW;
  const foreheadRatio = foreheadW / cheekW;

  if (heightRatio > 1.45) return "long";
  if (heightRatio < 1.05) return jawRatio > 0.88 ? "square" : "round";
  if (foreheadRatio > 1.05 && jawRatio < 0.82) return "heart";
  return "oval";
}

// ──────────────────────────────────────────────────────────────────────────────
// Product recommendations — scored by skin tone match, then undertone,
// then best-seller flag. Returns top-3 shades per category.
// ──────────────────────────────────────────────────────────────────────────────

const CAT_TO_TRY_ON: Record<TryOnCategory, string> = {
  lipstick:  "lipstick",
  blush:     "blush",
  eyeliner:  "eyeliner",
  eyeshadow: "eyeshadow",
};

// Undertone → shade warmth bias mapping (used for secondary scoring)
const UNDERTONE_BIAS: Record<Undertone, Record<string, number>> = {
  warm:    { matte: 1.0, satin: 0.9, shimmer: 0.7, gloss: 0.8 },
  cool:    { matte: 0.8, satin: 1.0, shimmer: 1.0, gloss: 0.9 },
  neutral: { matte: 1.0, satin: 1.0, shimmer: 1.0, gloss: 1.0 },
};

function buildRecommendations(
  tone: SkinDepth,
  undertone: Undertone
): Record<TryOnCategory, ShadeRec[]> {
  const result = {} as Record<TryOnCategory, ShadeRec[]>;

  for (const cat of Object.keys(CAT_TO_TRY_ON) as TryOnCategory[]) {
    const tryOnTag = CAT_TO_TRY_ON[cat];
    const candidates: ShadeRec[] = [];

    for (const product of products) {
      if (product.tryOn !== tryOnTag) continue;

      product.shades.forEach((shade, idx) => {
        // Base score: 10 for exact tone match, 6 for adjacent, 2 for anything else
        let score = 2;
        if (shade.recommendedFor) {
          if (shade.recommendedFor.includes(tone)) {
            score = 10;
          } else {
            // adjacent tones
            const toneOrder: SkinDepth[] = ["fair","light","medium","tan","deep"];
            const toneIdx  = toneOrder.indexOf(tone);
            const hasAdjacent = shade.recommendedFor.some(
              t => Math.abs(toneOrder.indexOf(t) - toneIdx) === 1
            );
            if (hasAdjacent) score = 6;
          }
        }

        // Undertone bias on finish
        const finish = shade.finish ?? "matte";
        score *= UNDERTONE_BIAS[undertone][finish] ?? 1.0;

        // Best-seller bonus
        if (product.iconLabel === "best-seller") score += 1;

        candidates.push({
          productSlug: product.slug,
          productName: product.name,
          shadeName:   shade.name,
          shadeHex:    shade.hex,
          shadeIdx:    idx,
          score,
        });
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    result[cat] = candidates.slice(0, 3);
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Route handler
// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { skinSample, landmarks } = body;

  if (
    !skinSample ||
    typeof skinSample.r !== "number" ||
    !Array.isArray(landmarks) ||
    landmarks.length < 468
  ) {
    return NextResponse.json(
      { error: "Required: skinSample {r,g,b} and landmarks[468]" },
      { status: 400 }
    );
  }

  const { r, g, b } = skinSample;

  const toneCategory = classifySkinTone(r, g, b);
  const undertone    = classifyUndertone(r, g, b);
  const faceShape    = detectFaceShape(landmarks);
  const recommendations = buildRecommendations(toneCategory, undertone);

  const response: AnalyzeResponse = {
    skinTone: {
      category: toneCategory,
      hex:      skinToneHex(toneCategory),
      label:    skinToneLabel(toneCategory),
    },
    undertone,
    faceShape,
    recommendations,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type":  "application/json",
    },
  });
}
