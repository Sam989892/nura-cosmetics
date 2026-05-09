# Home — Page Override

_Inherits MASTER.md. Overrides below._

## Goals
1. Communicate brand in < 5 s: "halal beauty, luxury-adjacent".
2. Direct first-time visitors to Try-On (discovery) or Shop (intent).
3. Build trust (halal cert, UK origin, Wardah partnership) before scroll-2.

## Structure (top → bottom)

1. **Hero** — one H1, one lede, one primary CTA ("Shop the Edit"), one secondary ghost CTA ("Open Try-On Studio").
   - Hero image right (desktop) / below text (mobile). `<Image priority>`, 4:5 portrait, ~120 KB AVIF.
   - Trust ribbon under CTAs: MUI · Wudu-friendly · UK.
2. **Trust strip** — thin section, 4 icons + 4 micro-claims. Static, no animation.
3. **The Edit** — 4 featured products in a responsive grid (1 / 2 / 4 cols).
4. **Founder story** — 2-column editorial block with a soft-gold pull quote.
5. **Try-On CTA band** — plum gradient + gold heading. Single button ("Open Studio").
6. **Certification ribbon** — MUI + Wardah + UK logos, linked to halal page.
7. **Newsletter opt-in** — single email field + checkbox consent, not pre-checked.

## Rules
- Hero H1: `--fs-display`, line-height 1.05, weight 600.
- First-view total network weight ≤ 250 KB gz (document + critical CSS + hero image).
- First scroll reveals Founder Story; animate it with a one-shot 240 ms fade-up (`transform: translateY(12px)` → 0). Respect `prefers-reduced-motion`.
- Do NOT auto-play any video on mobile.

## Mobile specifics
- Hero image stacks below text at ≤ 640 px, max-height 60 vh.
- Sticky CTA does NOT appear on home — only on product pages.
- Trust strip wraps to 2 × 2 grid on small phones.
