# Launch / Upload-Ready Checklist

_Runs from "feature-complete" to "safe to publish to the world". Group in three waves: Must (blocker), Should (quality), Nice (post-launch)._

## Wave 1 — Must (blocker)

### Correctness
- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] `npm run lint` — exit 0. No `no-page-custom-font`, no `no-img-element`.
- [ ] `npm run build` — succeeds; report bundle sizes per route.
- [ ] All pages render statically (or SSR) with no hydration mismatch.
- [ ] `robots.txt` present, allows indexing of public pages; disallows `/api/*`, `/admin`.
- [ ] `sitemap.xml` or `app/sitemap.ts` listing every public URL.
- [ ] `app/layout.tsx` has full OG + Twitter metadata, canonical URL, theme-color.
- [ ] Favicon + apple-touch-icon + web-manifest.

### Core Web Vitals
- [ ] LCP < 2.5 s on Moto-G4 4G emulation.
- [ ] CLS < 0.05 across home, shop, PDP, cart, try-on.
- [ ] INP < 200 ms — verified with Lighthouse 'Interact' trace.
- [ ] Hero image preloaded (`<link rel="preload" as="image">` or `<Image priority>`).

### Accessibility
- [ ] axe-core clean on home, shop, PDP, cart, try-on.
- [ ] Tab order correct everywhere. Focus rings visible.
- [ ] Reduced-motion respected globally.
- [ ] Forms have labels, `aria-describedby`, `role="alert"` on errors.
- [ ] Color contrast audit passed (4.5:1 body, 3:1 large, non-text icons 3:1).

### Content & legal
- [ ] Privacy policy page.
- [ ] Terms of service page.
- [ ] Cookie notice (granular consent: necessary/analytics/marketing).
- [ ] Accessibility statement.
- [ ] Contact / complaints channel + 20-day SLA for product-safety.
- [ ] MSDS request path works (form submits, confirmation page).
- [ ] Business address + company number in footer.

### Ethics
- [ ] Halal claims link to evidence.
- [ ] No pre-ticked consents anywhere.
- [ ] No fake urgency timers, no fake low-stock messages.
- [ ] Reviews (if any) marked verified or clearly marked "seed review".
- [ ] Accessibility of try-on disclosed: data stays in browser.

### Security
- [ ] `Content-Security-Policy` header configured (allow `'self'`, fonts.googleapis, MediaPipe CDN).
- [ ] `Strict-Transport-Security` via hosting provider.
- [ ] `X-Content-Type-Options: nosniff`.
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] No secrets or API keys in client bundle (`grep` the build output).

## Wave 2 — Should (quality)

- [ ] 404 page themed, with helpful links.
- [ ] 500 page themed, with contact info.
- [ ] Error boundaries at root + try-on route.
- [ ] Fonts loaded via `next/font`, self-hosted, `font-display: swap`.
- [ ] Images via `next/image` with `sizes` and `alt`.
- [ ] Route-level `dynamic` imports for heavy components (MediaPipe is already gated).
- [ ] `useReducedMotion` used for every JS animation.
- [ ] Copy editing pass (no placeholder text, no lorem ipsum).
- [ ] Analytics consented before firing (GA/Plausible behind cookie consent).
- [ ] Newsletter double-opt-in email flow.

## Wave 3 — Nice (post-launch)

- [ ] Dark mode companion palette.
- [ ] Localized copy scaffolding (`en-GB` default, easy to add `ur`, `ar`).
- [ ] PWA manifest + offline shell for Shop + PDP.
- [ ] Schema.org `Product`, `BreadcrumbList`, `Organization` JSON-LD.
- [ ] Sentry or PostHog (cookie-consent gated).
- [ ] Web-vitals RUM.
- [ ] End-to-end Playwright tests (checkout + try-on happy paths).
