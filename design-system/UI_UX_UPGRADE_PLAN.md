# NURA — UI / UX Upgrade Plan

_Phased plan to take nura-cosmetics from "working site" to "$100k DTC beauty feel". Pairs with MASTER.md + page overrides. Ordered so each phase is independently shippable._

---

## Phase 0 — Foundations (1–2 days, invisible but load-bearing)

**Goal:** set up tokens, motion, reduced-motion, font strategy. Zero visual regression; everything after this phase relies on these.

1. Move Google Fonts from `<link>` to `next/font/google` (eliminates the `no-page-custom-font` lint warning, enables self-hosting + `font-display: swap`).
2. Introduce CSS token block in `styles/globals.css` from MASTER §2.4 — aliases old `--nura-*` vars so no existing CSS breaks.
3. Add `@media (prefers-reduced-motion: reduce)` override block that disables transforms, long transitions, and blurs globally.
4. Add `@media (prefers-contrast: more)` override that strengthens borders.
5. Introduce type-scale utility classes (`.fs-display`, `.fs-h1`, …) as thin wrappers.
6. Global focus-visible style, reset on `:focus:not(:focus-visible)`.
7. Replace all remaining `<img>` with `next/image` (fixes `no-img-element`).
8. Add a top-level `ErrorBoundary` in `app/layout.tsx` wrapping `main`.

**Validation:** `tsc --noEmit`, `npm run lint`, `npm run build`. Visual regression check on home, shop, try-on.

---

## Phase 1 — Navigation & shell (1 day)

1. Sticky header: translucent on scroll (`backdrop-filter: saturate(140%) blur(12px)`), solid on top-of-page.
2. Mobile drawer: slide-in from right, focus trap, scroll-lock, ESC dismiss.
3. Cart count pill animates a 180 ms pop on add.
4. Footer: add Legal column (Privacy, Terms, Cookies, Accessibility).
5. Breadcrumbs component for Shop + PDP + Contact.

## Phase 2 — Home (1 day)

1. Rework hero: one H1, one lede, one primary CTA, one ghost CTA. Secondary trust ribbon underneath.
2. Hero image: real AVIF at 4:5, preloaded via `<Image priority fetchPriority="high">`.
3. Remove inline styles on the home page; move to CSS classes.
4. Founder story: pull-quote in Cormorant 500, gold accent rule.
5. Certification ribbon section (new).
6. Newsletter opt-in section with honest copy + no pre-ticked consent.
7. Entrance animations: single 240 ms fade-up per section, cap at 3 animated sections on screen at once.

## Phase 3 — Shop + filters (1–2 days)

1. Replace query-string filter parsing with a `useSearchParams`-driven hook.
2. Mobile filter bottom-sheet using `<dialog>`.
3. Facet chips with active-state count.
4. Empty state component with 1-tap clear.
5. Product grid: CSS grid auto-fill + `content-visibility: auto` below fold.
6. Skeleton cards while client navigation swaps product lists.

## Phase 4 — PDP (1–2 days)

1. Gallery: thumbnail strip + keyboard nav + pinch-zoom on mobile.
2. Swatch picker: roving-tabindex, arrow-key navigation.
3. Sticky bottom Add-to-bag bar on mobile with shade name.
4. Tabs → accordion on mobile; ingredient / MSDS sections live here.
5. "See on me" deep-links into `/try-on?product=&shade=`.

## Phase 5 — Cart + Checkout (2 days)

1. Cart: undo toast on remove, debounced quantity stepper.
2. Shipping threshold progress line ("£X to free UK shipping") using a meter, not a bar, and never with a countdown.
3. Checkout: 3-step with progress indicator. Autosave to `localStorage` under a namespaced key.
4. Inline validation on blur. `role="alert"` + focus jump on submit error.

## Phase 6 — Try-On polish (bundled with engine work)

Already scoped in Cursor's overhaul. This phase adds:
1. Performance banner at < 20 fps → offer "Reduce effects".
2. Camera-denial fallback: "Browse model looks" path.
3. `aria-live` stage announcements.
4. Deep-link support for preselecting product + shade.
5. Blink-gated eyeliner paint (see engine work).

## Phase 7 — Content, legal, SEO (1 day)

1. `app/sitemap.ts` + `app/robots.ts`.
2. Full metadata (OG image 1200×630, Twitter card) per page via `generateMetadata`.
3. JSON-LD schema for Organization + Product + Breadcrumb.
4. Privacy, Terms, Cookie, Accessibility pages.

## Phase 8 — Performance pass (1 day)

1. Lazy-load MediaPipe only on `Start scan`.
2. Preconnect to `fonts.gstatic.com` (already there) + MediaPipe CDN at idle.
3. Audit third-party scripts (none yet); keep it that way at launch.
4. Lighthouse CI config with budgets from MASTER §9.
5. Throw the site against Moto-G + 4G in DevTools; fix any remaining long tasks.

## Phase 9 — QA + launch (1 day)

Run LAUNCH_CHECKLIST.md. Fix every "Must" before publishing. File "Should" as follow-ups.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Liquid-glass blur tanks perf on low-end Android | Use sparingly, `@supports (backdrop-filter)` + fallback, `prefers-reduced-motion` and FPS-watchdog disable |
| MediaPipe wasm cold start feels broken | Skeleton + copy "warming up your mirror…", preload wasm at idle after scroll |
| Font-swap FOUT visible on slow networks | `size-adjust`, `ascent-override`, `line-gap-override` on local fallback |
| Checkout error spam on typo | Validate on blur, not keystroke |
| Legal copy unpublished at launch | Phase 7 cannot be skipped — block merge on missing pages |

---

## Ownership

- **Cursor (Partner A)** — components, layout, styles, next/font migration.
- **Claude (Partner B)** — engine work, copy passes, accessibility audits, performance budgets, legal/ethics guardrails.

Cross-ownership edits are logged in `DECISIONS.md` per protocol.
