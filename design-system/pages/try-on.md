# Try-On Studio — Page Override

_Canonical overrides for `/try-on`. Builds on Cursor's 2026-04-23 overhaul._

## Flow
`idle → scanning → curating → showingProfile → playing`

1. **idle** — camera opens, face locks, no layers applied. Floating `ScanCTA` card: "Let us find your perfect look" + "Scan my face" button.
2. **scanning** — `FaceScanOverlay` animates (~2.6 s). Controls dim.
3. **curating** — branded orb + 3-cycle copy. 1.4 s bridge.
4. **showingProfile** — hero `ProfileCard` above preview. Top-3 recs, per-row Apply, Apply-All.
5. **playing** — full controls unlocked. User toggles, changes shade, adjusts intensity.

## Layout (desktop ≥ 1024 px)
```
┌──────────── Profile hero (only after scan) ────────────┐
├──────────────────────────┬───────────────────────────┤
│   Preview stage (1.25fr) │   Controls (1fr, sticky)  │
│   — camera / upload / model                            │
│   — scan CTA overlay when idle                         │
│                          │                             │
│                          │   Source tabs (icon+label)  │
│                          │   Layer chips + detail     │
└──────────────────────────┴───────────────────────────┘
```

## Layout (mobile ≤ 640 px)
- Stage: full-bleed 100vw, max-height 68 vh.
- Controls: scrollable column below stage.
- Source selector: icon-tab strip, horizontal-snap.
- Shade grid: horizontal scroll with `scroll-snap`.
- **Sticky bottom action bar** with `env(safe-area-inset-bottom)`: "Apply" + "Reset" + layer count pill.
- Touch targets ≥ 44 px.

## Interaction rules
- Nothing paints until the user explicitly taps Scan or toggles a chip. No pre-applied filters.
- Source switch (camera ↔ upload ↔ model) never interrupts a scan.
- Camera permission denial: show a graceful fallback ("Browse model looks" button).
- Performance banner: if the device drops below 20 fps for 2 s, offer "Reduce effects" (disables blur layers).

## Engine quality goals
- Contour reads as a plane shadow, never a stroke. Highlights paint forehead / nose / chin / cheekbone tops.
- Eyeliner holds at close range (< 30 cm) and from > 1 m.
- Wings land at the outer canthus. Tightline reads as 1 px hair-line, not a slab.
- Blink detection gates liner paint during closed-eye frames.

## Accessibility
- Stage has `aria-label` describing current state.
- All toggles have keyboard-accessible labels.
- Reduce-motion: overlays animate opacity only, no pulse/scale.
- "Open help" button explaining each category in plain language (halal + wudu + finish).

## Privacy / ethics copy
Always visible under stage: "Video and landmark data never leave your device." Plus a 1-click "What we do and don't collect" expandable paragraph.
