# Shop — Page Override

## Goals
- Fastest path from browse → PDP.
- Filter by category, finish, undertone, halal status, price — without page reload.
- Result list always reflects URL state (deep-link friendly).

## Structure
- Breadcrumb: Home / Shop / {Category}.
- Page header: category name + result count + sort dropdown.
- **Filter drawer** (persistent sidebar ≥ 1024 px; bottom-sheet ≤ 1024 px).
  - Categories pill row up top.
  - Facets: finish, undertone, halal-only toggle, price range.
  - Clear-all button visible once any filter is active.
- **Product grid** — 2 cols ≤ 640 px, 3 cols 640–1024, 4 cols ≥ 1024.
- Each card: image (4:5), name, finish micro-tag, price, swatch dots (first 5).
- Empty state: illustration + "No shades match — try clearing a filter" + 1-tap clear button.

## Performance
- Product images lazy-loaded after the first row.
- Grid uses `content-visibility: auto` below the fold.
- Facet changes: optimistic UI + URL update via `router.replace` (shallow).

## Accessibility
- Filter dialog on mobile is a proper `<dialog>` with focus trap and ESC dismiss.
- Swatch dots each have `aria-label="{shade name}"`.
- Sort dropdown is a native `<select>` — no custom combobox needed.

## Anti-patterns
- Do not hide prices behind hover.
- Do not show infinite scroll without a "Load more" fallback.
