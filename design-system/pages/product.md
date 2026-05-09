# Product (PDP) — Page Override

## Goals
- Make "add to bag" obvious. Support swatch exploration without losing context.
- Surface halal + ingredient trust before the CTA, not after.

## Structure
- Gallery (left ≥ 1024 px, top ≤ 1024 px): 4:5 primary + 3 thumbs. Thumbs are keyboard-accessible buttons, not just images.
- Right column:
  - Category micro-tag + product name (H1 display serif).
  - Price + availability.
  - Shade picker — swatch ring grid; selected shade state = 2 px plum ring + name label underneath.
  - Primary CTA: **Add to bag** (plum, full-width ≤ 640 px).
  - Secondary: **See on me → Try-On** (ghost, opens `/try-on?product=slug&shade=name`).
  - Micro-trust row: MUI · Wudu · UK.
- Tabs below (collapsed accordions on mobile):
  - Description
  - Ingredients (full INCI, allergens bolded)
  - Halal & MSDS (certificate link, MSDS request form)
  - Shipping & Returns
- Related products strip (carousel on mobile, grid on desktop).

## Mobile specifics
- Sticky bottom bar: shade name + Add-to-bag. Appears after gallery scrolls off.
- Image gallery uses `scroll-snap-type: x mandatory` on phone.

## Accessibility
- Swatch picker keyboard navigation: arrow keys move focus between swatches.
- `aria-live="polite"` on "Added to bag" confirmation.
