# Image Placeholders — where real photography goes

Every image in this project is currently a CSS gradient placeholder. Replace as follows:

- `/public/images/hero.jpg` — homepage hero model portrait (portrait, 4:5)
- `/public/images/founder.jpg` — Gulam Mohammed Saiyed portrait (square)
- `/public/images/products/{product-slug}.jpg` — per product shots (square)
- `/public/images/products/{product-slug}-{shade-slug}.jpg` — per shade shots
- `/public/images/models/model-1.jpg` ... `model-4.jpg` — diverse South Asian model reference photos for Try-On

After dropping the files, update the matching `src` strings in:
- `app/page.tsx` (hero + founder)
- `components/ProductCard.tsx` (product card image)
- `app/product/[slug]/page.tsx` (PDP gallery)
- `app/try-on/page.tsx` (MODELS array at top of file — point each model's `src` to `/images/models/...`)
