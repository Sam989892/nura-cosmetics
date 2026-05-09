"use client";
// ProfileCard — post-scan summary + top recommendations.
// Shown after the scan overlay finishes. User can apply a single rec
// to the canvas in one click.

import { products, type Product, type Shade, type TryOnCategory } from "@/data/products";
import type { FaceProfile } from "@/lib/tryon-engine";

// Light-weight classifier: each face-shape has styling affinities used to
// nudge product picks. Not prescriptive, just a starting tilt.
const SHAPE_NUDGE: Record<FaceProfile["shape"], Partial<Record<TryOnCategory, number>>> = {
  oval:   { lipstick: 0, blush: 1, contour: 0, eyeshadow: 1, eyeliner: 1, nails: 0, lipgloss: 0 },
  round:  { contour: 2, lipstick: 1, blush: 1, eyeliner: 1 },
  square: { blush: 2, lipgloss: 1, eyeshadow: 1 },
  heart:  { blush: 2, lipstick: 1, nails: 1 },
  long:   { blush: 2, contour: 1, lipstick: 1 },
};

// Pick a product + shade for a category that best matches the profile.
// Returns null if no candidate matches the category at all.
function pickForCategory(
  cat: TryOnCategory,
  profile: FaceProfile
): { product: Product; shade: Shade; shadeIdx: number } | null {
  const candidates = products.filter((p) => p.tryOn === cat);
  if (candidates.length === 0) return null;

  let best: {
    product: Product;
    shade: Shade;
    shadeIdx: number;
    score: number;
  } | null = null;

  for (const p of candidates) {
    p.shades.forEach((s, i) => {
      let score = 0;
      if (s.recommendedFor?.includes(profile.tone)) score += 3;
      // Light undertone match: warm tones lean toward reds/browns/golds by
      // hex. This is coarse on purpose.
      const hex = s.hex.toLowerCase();
      const r = parseInt(hex.slice(1, 3), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      if (profile.undertone === "warm" && r > b + 20) score += 2;
      if (profile.undertone === "cool" && b > r - 30) score += 2;
      if (profile.undertone === "neutral") score += 1;
      if (p.occasion.includes("everyday")) score += 1;
      if (p.halalCertified) score += 1;

      if (!best || score > best.score) {
        best = { product: p, shade: s, shadeIdx: i, score };
      }
    });
  }
  return best;
}

export type Recommendation = {
  category: TryOnCategory;
  product: Product;
  shade: Shade;
  shadeIdx: number;
};

export function buildRecommendations(
  profile: FaceProfile
): Recommendation[] {
  // Score each category for this shape, pick top 3 categories, then pick
  // best product+shade per category.
  const cats: TryOnCategory[] = [
    "lipstick", "blush", "lipgloss", "eyeshadow", "eyeliner", "contour", "nails",
  ];
  const nudge = SHAPE_NUDGE[profile.shape] ?? {};
  const ranked = cats
    .map((c) => ({ c, n: nudge[c] ?? 0 }))
    .sort((a, b) => b.n - a.n);

  const out: Recommendation[] = [];
  for (const { c } of ranked) {
    if (out.length >= 3) break;
    const pick = pickForCategory(c, profile);
    if (!pick) continue;
    out.push({
      category: c,
      product: pick.product,
      shade: pick.shade,
      shadeIdx: pick.shadeIdx,
    });
  }
  return out;
}

export default function ProfileCard({
  profile,
  recommendations,
  onApply,
  onApplyAll,
  onDismiss,
}: {
  profile: FaceProfile;
  recommendations: Recommendation[];
  onApply: (rec: Recommendation) => void;
  onApplyAll: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="tryon-profile-card" role="region" aria-label="Your NURA profile">
      <div className="tryon-profile-head">
        <div>
          <div className="tryon-profile-eyebrow">Your NURA profile</div>
          <div className="tryon-profile-tags">
            <span className="tryon-profile-tag">Tone: {profile.tone}</span>
            <span className="tryon-profile-tag">Undertone: {profile.undertone}</span>
            <span className="tryon-profile-tag">Shape: {profile.shape}</span>
          </div>
        </div>
        <button
          type="button"
          className="tryon-profile-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss profile card"
        >
          ×
        </button>
      </div>

      <div className="tryon-profile-recs">
        {recommendations.map((rec) => (
          <button
            key={rec.category}
            type="button"
            className="tryon-profile-rec"
            onClick={() => onApply(rec)}
          >
            <span
              className="tryon-profile-rec-dot"
              style={{ background: rec.shade.hex }}
              aria-hidden
            />
            <span className="tryon-profile-rec-text">
              <span className="tryon-profile-rec-name">{rec.product.name}</span>
              <span className="tryon-profile-rec-shade">{rec.shade.name}</span>
            </span>
            <span className="tryon-profile-rec-cta">Apply</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="tryon-profile-all"
        onClick={onApplyAll}
      >
        Apply the full recommended look
      </button>
    </div>
  );
}
