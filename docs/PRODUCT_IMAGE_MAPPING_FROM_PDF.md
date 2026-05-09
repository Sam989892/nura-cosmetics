# PK Lip Wardah PDF Mapping

Source: `PRODUCT IMAGES/PK Lip Wardah.pdf`

## Extracted Product Mapping (implemented)

- `wardah-matte-lip-cream`
  - PDF cues: "MATTE LIP CREAM STORY", "12H Creamy-Moist", "SPF 20 PA++"
  - Shade refs: `25 UNBEETABLE`, `26 PINK-A-BOO`, `27 BEEHAVE`, `28 TEDDY BROWN`
  - Current mapped image: `/images/products/lip-cream.png`
  - Source photo reference: `d42be501-d53e-4da5-a62b-b3c1b14d36df.JPG`
- `wardah-lip-glasting`
  - PDF cues: "GLASTING LIQUID LIP", "GLASSCUSHION TM technology", "Transferproof", "20H GLASS-LIP EFFECT"
  - Shade refs: `16 Peony Gleam`, `17 Almond Melt`, `18 Mauve Ripple`, `19 Tawny Silk`
  - Current mapped image: `/images/products/lip-gloss.png`
  - Source photo reference: `943cbd2c-42ff-4414-841e-d9197e272b16.JPG`

## Manual Drop-In Filenames (fallback)

If you want true catalog packshots from the PDF/JPG source folder, export and place these files in `public/images/products/`:

- `wardah-matte-lip-cream.jpg`
- `wardah-glasting-liquid-lip.jpg`
- `wardah-halal-nail-polish.jpg`
- `nura-velvet-blush.jpg`
- `nura-sculpt-contour.jpg`
- `nura-kohl-liner.jpg`
- `nura-silk-eyeshadow.jpg`

Then update each `image` field in `data/products.ts` from `.png` to the corresponding `.jpg`.

## Limitation

Direct embedded-image extraction from the PDF is not automated in this repo tooling. The current implementation uses extracted text metadata and explicit filename mapping so image assets can be swapped in without code changes.
