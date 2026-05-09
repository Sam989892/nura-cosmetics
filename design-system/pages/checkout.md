# Checkout — Page Override

## Goals
- One screen, three sections (progressive disclosure), zero surprises.
- Autosave each step to local storage so refresh doesn't nuke progress.

## Structure
1. Contact (email + marketing opt-in, not pre-checked).
2. Shipping address (UK-first; postcode lookup).
3. Payment (Stripe Elements or Shopify-hosted — DO NOT roll your own card form).
4. Order summary (sticky on desktop, collapsible on mobile).

## Rules
- One primary "Continue" / "Place order" button per step.
- Errors inline under the field, with `role="alert"`. After submit, focus jumps to first invalid field.
- Postcode field: inputmode, auto-uppercase, live validation on blur.
- Card inputs: proper `autocomplete` tokens (`cc-number`, `cc-exp`, `cc-csc`).
- Price breakdown: subtotal, shipping (live), VAT line, total. All pre-rendered, no surprise fees on the last tap.

## Ethics
- Display total **inclusive of VAT** and shipping before payment step.
- Consent checkboxes: **never pre-ticked**.
- Returns window and dispute path linked directly from this page.
- Save-card offer is opt-in only, with explicit language.

## Mobile specifics
- Sticky "Place order" bar with safe-area padding.
- Avoid `100vh` — use `min-height: 100dvh`.
- Numeric keypads via `inputmode="numeric" pattern="[0-9]*"` on postcode, card number, CSC.
