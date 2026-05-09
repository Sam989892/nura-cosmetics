# NURA Cosmetics — Design System (MASTER)

_Source of truth. Page-level overrides live under `design-system/pages/`._

Last updated: 2026-04-23 (Partner B — Claude, ui-ux-pro-max pass)

---

## 1. North Star

**Target feel:** a $100k DTC beauty site — editorial, quiet-luxury, faith-respectful. Think _Glossier × Aesop × Goop × MAC_, filtered through halal/modest-beauty brand language.

**UX philosophy:** "walk in a garden" — the visitor should never hunt for a button. Every path is pre-thought; every next step is visible before the current step ends.

**Non-negotiables:**
- WCAG 2.2 AA across the whole surface (contrast, focus, labels, reduced-motion).
- Mobile-first, 375 → 1440 px fluid scale. No horizontal scroll anywhere.
- Perceived TTI < 2.5 s on 4G Moto-G; CLS < 0.05; no jank during try-on.
- Privacy and halal claims visible on every purchase path.

---

## 2. Recommended System (from ui-ux-pro-max)

### Base style: **Soft UI Evolution** (excellent perf, WCAG AA+)
Subtle depth, modern shadows (softer than flat, cleaner than neumorphism), 200–300 ms micro-interactions, light-first.

### Premium accents: _sparingly_ **Liquid Glass**
Reserved for the try-on chrome (controls header, scan CTA card, profile-card hero) and the home hero scrim. Used with `content-visibility: auto` and reduced-motion fallbacks because it can be expensive.

### Layout pattern: **Editorial / Minimal Single Column** on landing + key-moment pages
Single primary CTA per fold. Long typography. Heavy whitespace. No nav overload.

### Typography pairing: **Display serif + Neutral sans**
| Role | Family | Weights | Notes |
|------|--------|---------|-------|
| Display / headings | Cormorant Garamond (kept for brand continuity) | 400, 500, 600 | Editorial serif, close cousin to recommended Playfair Display |
| Body / UI | Inter | 400, 500, 600 | Neutral sans; pairs with any serif |

Load via `next/font/google` (not `<link>`) to eliminate the `no-page-custom-font` warning and enable `font-display: swap` + self-hosting.

### Color tokens (WCAG-checked brand continuation)
Keep NURA's existing plum/rose/gold palette — it's brand identity. Re-express as semantic tokens and confirm contrast:

```css
:root {
  /* Surface */
  --surface-ivory:  #F8F3EC;  /* background */
  --surface-cream:  #FBF6EF;  /* alt background */
  --surface-card:   #FFFFFF;

  /* Ink */
  --ink-900:        #1F1A1C;  /* body — 13.8:1 on ivory ✓ */
  --ink-700:        #3A2E34;  /* headings on cream */
  --ink-500:        #6A5D63;  /* muted — use ≥16 px only (4.6:1 ✓) */

  /* Brand */
  --plum-900:       #2E1225;  /* buttons primary bg — 12.1:1 ✓ */
  --plum-700:       #4A1E3A;  /* default brand */
  --rose-500:       #B76E79;  /* accent — large text only (3.8:1) */
  --rose-200:       #E8C3C8;  /* decorative */
  --gold-600:       #9E8247;  /* on light bg — 4.7:1 ✓ */
  --gold-400:       #C8A96A;  /* on dark bg only */

  /* Semantic */
  --ok-600:         #2E6A4D;  /* halal / in-stock — 5.1:1 ✓ */
  --warn-600:       #A0510F;
  --danger-600:     #B42318;

  /* Line / hairline */
  --line-100:       #EFE8DC;
  --line-200:       #E7DFD5;

  /* Elevation */
  --shadow-xs:      0 1px 2px rgba(31, 26, 28, 0.04);
  --shadow-sm:      0 2px 8px rgba(31, 26, 28, 0.06);
  --shadow-md:      0 8px 24px rgba(74, 30, 58, 0.08);
  --shadow-lg:      0 24px 64px rgba(74, 30, 58, 0.12);

  /* Motion */
  --ease-out:       cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in:        cubic-bezier(0.55, 0, 0.68, 0.53);
  --dur-xs:         120ms;
  --dur-sm:         200ms;
  --dur-md:         280ms;
  --dur-lg:         420ms;

  /* Radius */
  --r-xs:           6px;
  --r-sm:           10px;
  --r-md:           14px;
  --r-lg:           20px;
  --r-pill:         999px;
}
```

_Accent #B76E79 fails AA as body text — must be used at ≥ 18 px / ≥ 14 px bold, never for body copy._

### Type scale (mobile → desktop, `clamp`)

| Token | Size | Usage |
|-------|------|-------|
| `--fs-display` | `clamp(2.25rem, 4.5vw + 1rem, 4rem)` | Hero H1 only |
| `--fs-h1`      | `clamp(1.875rem, 2.5vw + 1rem, 3rem)` | Section headers |
| `--fs-h2`      | `clamp(1.5rem, 1.5vw + 1rem, 2rem)` |  |
| `--fs-h3`      | `clamp(1.25rem, 0.8vw + 1rem, 1.5rem)` |  |
| `--fs-body`    | `1rem` (never < 16 px on mobile) |  |
| `--fs-small`   | `0.875rem` | Captions, fine print |
| `--fs-micro`   | `0.75rem` | Badges, tags — with letter-spacing 0.06em |

Line-heights: 1.05 display, 1.15 H1–H3, 1.6 body.

### Spacing — 4 pt scale
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128`. Exposed as `--sp-1..--sp-12`.

### Breakpoints
`320 / 375 / 480 / 640 / 768 / 1024 / 1280 / 1536`. Mobile-first in CSS (`min-width` queries).

---

## 3. Global UX rules

1. **One primary CTA per fold.** Secondary actions are ghost or text.
2. **Every destructive action confirms.** Cart remove → undo toast (5 s).
3. **Every async > 300 ms** shows skeleton or progress — never blank.
4. **Every form field labels outside the input.** Placeholders are hints, not labels.
5. **Error messages state cause + recovery.** Never just "Invalid".
6. **All interactive elements ≥ 44 × 44 px** tap target.
7. **Focus rings always visible** (2 px `--plum-700`, 2 px offset). Never `outline: none` without a replacement.
8. **`prefers-reduced-motion`** disables parallax, scale-in, and Liquid-Glass blur animation.
9. **Back navigation preserves scroll + filter state.**
10. **Deep links work for every product, every category.**

---

## 4. Navigation

**Header (persistent):**
- Logo · Shop · Try-On · Halal · About · Contact · Cart (with count pill)
- Sticky, translucent on scroll (backdrop-blur-md, ivory-tinted); on small screens collapses to a hamburger drawer that slides from the right with body-scroll lock and focus trap.

**Footer:** four columns — Shop / Brand / Customer / Legal. Legal column must include Privacy, Terms, Cookie Notice, Accessibility, MSDS request.

**Breadcrumbs** on Shop (category → product) and on Contact sub-topics.

---

## 5. Component specs

Every component follows `Rest → Hover → Focus-visible → Active → Disabled → Loading` states.

Covered in detail in `design-system/pages/*.md` (per-page overrides):
- `home.md` — hero, story block, featured edit, try-on CTA
- `shop.md` — filter bar, category pills, product grid, empty state
- `product.md` — PDP gallery, swatch picker, "See on me" try-on hook, add-to-bag, MSDS disclosure
- `try-on.md` — full overhaul spec (already captured in HANDOFF.md; port here)
- `cart.md` — line items, quantity stepper, promo, sticky summary
- `checkout.md` — 3-step progressive, autosave, address autocomplete, errors inline
- `halal.md` — trust page, certifications, ingredient deep-dive
- `about.md` — founder, partner, values
- `contact.md` — form + FAQ accordions

---

## 6. Motion rules

- Enter: 200–280 ms `--ease-out`. Exit: 60 % of enter.
- Animate `transform` / `opacity` only. Never `width` / `height` / `top` / `left`.
- Stagger list entrances by 30–50 ms per item, cap at 6 items animated.
- Page transitions respect direction: forward = slide-in-from-right + fade; back = slide-in-from-left + fade.
- Reduced-motion: all non-essential animation collapses to instant opacity-only fade.

---

## 7. Accessibility pass

- Skip-link to `#main` (already present).
- All icon-only buttons carry `aria-label`.
- Color is never the only signal: halal badge uses ✓ + text, out-of-stock uses strikethrough + text.
- Every form field: visible label + `aria-describedby` for helper/error.
- Form errors also read by screen readers via `role="alert"`.
- Dynamic type: nothing fixed-height — containers grow with text.
- Camera permission screen (try-on) has non-camera text alternative ("Browse model looks").

---

## 8. Ethics & Trust (brand-critical)

1. **Halal claims are sourced.** Every halal page/badge links to the MUI certificate evidence.
2. **Ingredients are transparent.** PDP shows full INCI + allergen list, downloadable MSDS.
3. **Privacy-first.** Try-on copy states "nothing leaves your device" with a technical footnote.
4. **No dark patterns.** No fake timers, no pre-checked consents, no forced account creation.
5. **Modest imagery.** Image guidelines exclude hyper-sexualised or hijab-mocking styling.
6. **Reviews are real.** When added, show verified-purchase marker; no paid-review insertion.
7. **Clear returns.** Returns + refund windows visible before checkout, not buried.
8. **UK consumer law** compliance block in footer: VAT, business address, complaints path.
9. **Accessibility statement** linked in footer with commitments + contact.
10. **Cookie consent** granular (necessary / analytics / marketing), no pre-tick.

---

## 9. Performance budget (upload-ready)

| Metric | Target | Notes |
|--------|--------|-------|
| LCP     | < 2.5 s on 4G | Hero image preloaded, `<Image priority>` |
| CLS     | < 0.05 | `aspect-ratio` on every hero & product image |
| INP     | < 200 ms | No main-thread blocks > 50 ms |
| JS TBT  | < 300 ms | Dynamic-import try-on + MediaPipe |
| Bundle (first route) | < 180 KB gz | Home is static |
| Fonts   | ≤ 2 families, self-hosted via `next/font` | `font-display: swap` |
| Images  | WebP/AVIF with `sizes` | `<Image>` everywhere |

**Code-split** `app/try-on/page.tsx` as its own chunk (it already is via route). MediaPipe loader gated behind "Start scan" — never loaded on mount.

---

## 10. Upload-readiness checklist

Covered in `design-system/LAUNCH_CHECKLIST.md`.
