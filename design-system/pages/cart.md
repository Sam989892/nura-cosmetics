# Cart — Page Override

## Goals
- Make it trivially easy to adjust quantity, remove, and checkout.
- Surface shipping threshold ("£X to free UK shipping") without dark-pattern urgency.

## Structure
- Page header: "Your bag" + item count.
- Empty state: illustration + "Your bag is empty" + "Shop the Edit" CTA.
- Line items:
  - Thumbnail (64×80 at ≤ 640 px, 96×120 ≥ 1024 px)
  - Name, shade, finish micro-tag
  - Quantity stepper (− / value / +) — ≥ 44 px targets
  - Price (each + line total)
  - Remove (icon + "Remove" label, tinted in danger only on hover)
- Right column (desktop) / sticky footer (mobile): subtotal, shipping note, "Checkout" primary CTA.
- Trust micro-row under checkout button: secure payment · UK-based · 14-day returns.

## Interactions
- Remove triggers an Undo toast (5 s) that restores the item.
- Quantity change debounces at 250 ms to avoid spam re-renders.
- Empty cart after remove animates gracefully (fade + message), not a flash swap.

## Mobile specifics
- Sticky checkout bar bottom with safe-area padding.
- Quantity steppers do not reflow siblings when tapped.
