# NURA Cosmetics

UK-based halal beauty — MUI certified, wudu-friendly, built for British Muslim women of South Asian heritage. Official UK partner for Wardah by Paragon Technology and Innovation.

## Stack

- Next.js 14 (App Router) + TypeScript
- Vanilla CSS (no Tailwind). Design tokens in `styles/globals.css`.
- MediaPipe FaceMesh + Hands for the virtual try-on, loaded lazily from CDN
- React Context + `localStorage` for the cart
- No backend required. Fully static-exportable.

## Getting started

```bash
npm install
npm run dev        # localhost:3000
npm run build      # production build
```

## Project layout

```
app/
  layout.tsx                 Root layout, CartProvider, Nav, Footer
  page.tsx                   Homepage
  shop/page.tsx              Shop listing (filterable)
  product/[slug]/page.tsx    Product detail
  try-on/page.tsx            Virtual try-on studio (hero feature)
  halal/page.tsx             Halal assurance page
  about/page.tsx             About NURA + founder
  cart/page.tsx              Cart with localStorage persistence
  checkout/page.tsx          Checkout form + Stripe placeholder
  contact/page.tsx           Contact + FAQ
components/
  Nav.tsx Footer.tsx TrustStrip.tsx ProductCard.tsx
lib/
  cart.tsx                   Cart context (localStorage-backed)
  tryon-engine.ts            Landmark maps + canvas render functions
data/
  products.ts                Product catalogue
public/
  favicon.svg images/README.md
styles/
  globals.css                Design tokens + component styles
```

## Adding a new product

Open `data/products.ts` and append to the `products` array:

```ts
{
  slug: "nura-silk-lip-liner",
  name: "NURA Silk Lip Liner",
  subtitle: "Creamy halal lip liner",
  price: 12.0,
  category: "lips",
  tryOn: "lipstick",                 // category used by the try-on engine
  occasion: ["everyday", "eid"],
  description: "Your marketing copy.",
  ingredients: "INCI list…",
  shades: [
    { name: "Plum Noor", hex: "#4a1e3a", recommendedFor: ["tan", "deep"], finish: "matte" }
  ],
  wuduFriendly: true,
  hajjUmrah: false,
  halalCertified: true
}
```

The product auto-populates:
- Shop listing + filters
- Product detail page at `/product/nura-silk-lip-liner`
- Try-on studio shade picker (when the matching category tab is selected)

### Try-on categories

Allowed `tryOn` values map to the render functions in `lib/tryon-engine.ts`:

- `lipstick` · `lipgloss` · `blush` · `contour` · `eyeliner` · `eyeshadow` — uses FaceMesh
- `nails` — uses Hands

If you add a new category, add a corresponding render function in `lib/tryon-engine.ts` and extend the `switch` in `app/try-on/page.tsx`.

## Swapping placeholder imagery

See `public/images/README.md`. Drop real photos into `/public/images/` and update the matching `src` strings. Current placeholders are CSS gradients clearly labelled in the UI.

## Virtual Try-On — how it works

1. **Face landmarks** — MediaPipe FaceMesh (468 points) loaded from jsDelivr CDN.
2. **Hand landmarks** — MediaPipe Hands (21 points × up to 2 hands) for nail polish.
3. **Rendering** — Canvas 2D. Each category has a dedicated render function in `lib/tryon-engine.ts` using blend modes tuned per-product-type (multiply for lipstick, soft-light for blush, etc).
4. **Skin tone detection** — Samples the forehead + cheek pixels once per session and maps luminance to a five-tier range (fair / light / medium / tan / deep). Recommended shades get a star badge.
5. **Privacy** — Everything runs in the browser. No user media is uploaded. Stated explicitly in the UI.
6. **Fallback** — If MediaPipe fails to load, the stage shows an error message and the shade swatches still work as a static comparison.

### Performance notes

- FaceMesh with `refineLandmarks: true` gives a tighter lip contour at a modest performance cost. Toggle off for lower-end devices.
- The engine caches the MediaPipe instances in refs; the loop draws every frame but detection runs on each frame without queue buildup because both libraries are promise-based.
- Mobile Safari: `getUserMedia` requires HTTPS. Test on localhost or deployed HTTPS.

## Stripe integration

Left as a placeholder — search for `STRIPE_INTEGRATION_PLACEHOLDER` in `app/checkout/page.tsx`. Add a server action or an API route at `app/api/checkout/route.ts` that creates a Checkout Session, then redirect to it. Keys go in `.env.local` (see `.env.example`).

## Accessibility

- Semantic landmarks (`<header>`, `<main>`, `<footer>`, `<nav>`).
- Skip-to-content link.
- All interactive controls have `aria-label` where the visible text isn't descriptive.
- Focus ring on `:focus-visible` uses the brand plum.
- Color palette tested for WCAG 2.1 AA contrast on primary combinations.
- All images decorative or have `alt`/`aria-label`.

## Deployment

Any static Next host works: Vercel, Netlify, Cloudflare Pages.

```bash
npm run build && npm run start
```

For a pure static export (no server), `output: "export"` can be set in `next.config.mjs`.

## License

© NURA Cosmetics Ltd, United Kingdom. All rights reserved.
