# NURA Image Prompt Library (Nano Banana Pro)

Use with Nano Banana Pro or any text-to-image model.

## 1) Brand Hero
`Luxury beauty campaign photo, South Asian British Muslim woman, modest fashion styling, warm studio light, plum and rose-gold color palette, clean premium background with whitespace for headline, photorealistic, high-end editorial, ecommerce ready, no text, no logo`

## 2) Founder Portrait
`Professional founder portrait, South Asian entrepreneur, confident expression, premium cosmetics brand aesthetic, neutral studio backdrop with subtle plum gradient, soft key light, photorealistic, clean wardrobe, no text, no logo`

## 3) Upload Try-On Visual
`Beauty technology product scene, phone and laptop showing upload-first virtual makeup try-on, privacy lock symbol, subtle facial overlay graphics, plum and champagne accents, premium SaaS-meets-beauty visual style, realistic lighting, no text`

## 4) Product Packshot (General)
`Studio packshot of halal cosmetic product, centered composition, soft shadow, reflective base, premium beauty lighting, warm cream background, 4k product photography, no text, no watermark`

## 5) Lip Product Packshot
`Close-up packshot of premium matte lip cream tube, rose-plum shade accent, luxury lighting, clean cream backdrop, subtle specular highlights, ecommerce-ready, no text`

## 6) Blush/Contour Packshot
`Top-down beauty product photo of blush and contour compact, elegant shadows, warm gold and plum color styling, premium editorial quality, no text`

## 7) Eyes Product Packshot
`High-end packshot of kohl liner and eyeshadow palette, dramatic but clean studio light, deep plum accents, premium ecommerce finish, no text`

## 8) About/Community Visual
`Editorial portrait of diverse South Asian women in elegant modest styling, warm authentic expression, soft natural light, premium brand campaign look, no text, no logos`

## Reproducible Pipeline
1. Install prompts skill:
   - `npx skills add YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill --agent cursor codex -y`
2. Generate assets in your preferred model UI/API using prompts above.
3. Export to `/public/images/site` and `/public/images/products`.
4. Run `npm run build` and verify all image paths resolve.

## Current Asset Status (2026-04-28)
Photo-quality PNG assets have been generated and wired in for launch. Replace any of them in-place by re-running the same prompt at higher fidelity if desired.

### Site (`public/images/site/`)
- `hero-model.png` — homepage hero
- `founder-portrait.png` — founder section on home/about
- `about-story.png` — about page community visual

### Products (`public/images/products/`)
- `lip-cream.png`
- `lip-gloss.png`
- `nail-polish.png`
- `blush.png`
- `contour.png`
- `liner.png`
- `eyeshadow.png`

All product paths are wired through `data/products.ts` -> `product.image`. The OG image in `app/layout.tsx` points at `hero-model.png`.
