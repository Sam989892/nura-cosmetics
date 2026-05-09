// NURA Cosmetics — Product Catalogue
// Wardah product data sourced from PK Lip Wardah document.
// NURA face/eye/nail products are the brand's own formulations via Wardah partnership.

export type TryOnCategory =
  | "lipstick"
  | "lipgloss"
  | "blush"
  | "contour"
  | "eyeliner"
  | "eyeshadow"
  | "nails";

export type Shade = {
  name: string;
  hex: string;
  recommendedFor?: ("fair" | "light" | "medium" | "tan" | "deep")[];
  finish?: "matte" | "gloss" | "satin" | "shimmer";
};

export type Product = {
  slug: string;
  name: string;
  subtitle: string;
  price: number; // GBP
  category: "lips" | "nails" | "face" | "eyes";
  tryOn: TryOnCategory;
  occasion: ("everyday" | "eid" | "ramadan" | "hajj" | "umrah")[];
  description: string;
  ingredients: string;
  shades: Shade[];
  wuduFriendly: boolean;
  hajjUmrah: boolean;
  halalCertified: boolean;
  image?: string;
  iconLabel?: "new" | "best-seller" | "wardah-lip-expert";
  sourceTags?: string[];
};

export const products: Product[] = [
  // ----------------------------------------------------------------
  // WARDAH MATTE LIP CREAM
  // 28+ shades. Source: PK Lip Wardah pp.17-21
  // 12H Creamy-Moist, trinity oils, SPF 20 PA++, highly pigmented
  // ----------------------------------------------------------------
  {
    slug: "wardah-matte-lip-cream",
    name: "Wardah Matte Lip Cream",
    subtitle: "Long-wear matte finish",
    price: 14.5,
    category: "lips",
    tryOn: "lipstick",
    occasion: ["everyday", "eid", "ramadan"],
    description:
      "Velvety matte lip cream with 12-hour creamy-moist wear. Trinity oil complex prevents drying. Highly pigmented for full coverage on darker lip tones. SPF 20 PA++. MUI Halal certified by Wardah, Indonesia's No.1 halal cosmetics house.",
    ingredients:
      "Isododecane, Dimethicone, Trimethylsiloxysilicate, Jojoba Oil, Argan Oil, Rosehip Oil (trinity oils), Mica, Iron Oxides (CI 77491, 77492, 77499), Titanium Dioxide CI 77891, Tocopheryl Acetate.",
    shades: [
      { name: "Unbeetable", hex: "#7d2b45", recommendedFor: ["medium", "tan", "deep"], finish: "matte" },
      { name: "Pink-a-boo", hex: "#d0607a", recommendedFor: ["fair", "light", "medium"], finish: "matte" },
      { name: "Beehave", hex: "#b07060", recommendedFor: ["light", "medium", "tan"], finish: "matte" },
      { name: "Teddy Brown", hex: "#7d4e3a", recommendedFor: ["medium", "tan", "deep"], finish: "matte" },
      { name: "Rouge Flare", hex: "#a01e2a", recommendedFor: ["medium", "tan", "deep"], finish: "matte" },
      { name: "Petal Blush", hex: "#d49090", recommendedFor: ["fair", "light"], finish: "matte" },
      { name: "Ombre Sheen", hex: "#c07860", recommendedFor: ["light", "medium", "tan"], finish: "matte" },
      { name: "Shine Sorbet", hex: "#e08080", recommendedFor: ["fair", "light", "medium"], finish: "matte" },
      { name: "Pumpkin Drip", hex: "#c46040", recommendedFor: ["medium", "tan"], finish: "matte" },
      { name: "Fudge Toffee", hex: "#8b5e40", recommendedFor: ["tan", "deep"], finish: "matte" },
      { name: "Plum It Up", hex: "#612a3e", recommendedFor: ["tan", "deep"], finish: "matte" },
    ],
    wuduFriendly: true,
    hajjUmrah: false,
    halalCertified: true,
    image: "/images/products/lip-cream.png",
    iconLabel: "best-seller",
    sourceTags: ["12H Creamy-Moist", "SPF 20 PA++", "Trinity Oils", "MUI Halal Certified"],
  },

  // ----------------------------------------------------------------
  // WARDAH GLASTING LIQUID LIP
  // 6 shades. Source: PK Lip Wardah pp.11-13
  // Mirror-like glass-lip effect, GlassCushion technology, 20H wear, transferproof
  // ----------------------------------------------------------------
  {
    slug: "wardah-lip-glasting",
    name: "Wardah Glasting Liquid Lip",
    subtitle: "Mirror glass-lip effect",
    price: 12.0,
    category: "lips",
    tryOn: "lipgloss",
    occasion: ["everyday", "eid"],
    description:
      "Next-level gloss with GlassCushion technology for a mirror-like glass-lip effect. 20-hour transferproof wear. Smooth and plumping, highly pigmented. Perfect for Eid looks.",
    ingredients:
      "Polybutene, Diisostearyl Malate, Hydrogenated Polyisobutene, GlassCushion Complex, Tocopheryl Acetate, Mica, Calcium Aluminum Borosilicate, Iron Oxides.",
    shades: [
      { name: "Caramel Coat", hex: "#c9956a", recommendedFor: ["light", "medium", "tan"], finish: "gloss" },
      { name: "Peach Polish", hex: "#e8a585", recommendedFor: ["fair", "light", "medium"], finish: "gloss" },
      { name: "Dazzle Maple", hex: "#c4663c", recommendedFor: ["medium", "tan"], finish: "gloss" },
      { name: "Rosewood Radiance", hex: "#c07070", recommendedFor: ["fair", "light", "medium"], finish: "gloss" },
      { name: "Glazing Berry", hex: "#8b3b5a", recommendedFor: ["medium", "tan", "deep"], finish: "gloss" },
      { name: "Ruby Sparks", hex: "#9b2335", recommendedFor: ["tan", "deep"], finish: "gloss" },
    ],
    wuduFriendly: true,
    hajjUmrah: false,
    halalCertified: true,
    image: "/images/products/lip-gloss.png",
    iconLabel: "new",
    sourceTags: ["GlassCushion Technology", "20H Transferproof", "Glass-Lip Effect"],
  },

  // ----------------------------------------------------------------
  // WARDAH LIP STAIN
  // 8 shades. Source: PK Lip Wardah pp.9-10
  // Soft flushed-lip, low-shine, airbrush-like, all-day stain
  // ----------------------------------------------------------------
  {
    slug: "wardah-lip-stain",
    name: "Wardah Lip Stain",
    subtitle: "Soft flushed-lip, all-day stain",
    price: 11.0,
    category: "lips",
    tryOn: "lipstick",
    occasion: ["everyday", "ramadan"],
    description:
      "Achieve naturally flushed lips with this effortless airbrush-like stain. Low-shine satin finish that builds from sheer to full coverage. Lightweight and comfortable for all-day Ramadan and everyday wear.",
    ingredients:
      "Cyclopentasiloxane, Dimethicone Crosspolymer, Isododecane, Iron Oxides, Mica, Tocopheryl Acetate, Water.",
    shades: [
      { name: "Roseivy", hex: "#c07060", recommendedFor: ["fair", "light", "medium"], finish: "satin" },
      { name: "Persimoon", hex: "#d0704a", recommendedFor: ["light", "medium", "tan"], finish: "satin" },
      { name: "Peachsun", hex: "#e09070", recommendedFor: ["fair", "light"], finish: "satin" },
      { name: "Rouges", hex: "#a83040", recommendedFor: ["medium", "tan", "deep"], finish: "satin" },
      { name: "Gingerbread", hex: "#9b4e30", recommendedFor: ["tan", "deep"], finish: "satin" },
      { name: "Cherrie", hex: "#9b2535", recommendedFor: ["medium", "tan", "deep"], finish: "satin" },
      { name: "Crimsoul", hex: "#8b1530", recommendedFor: ["tan", "deep"], finish: "satin" },
      { name: "Mauver", hex: "#9b6070", recommendedFor: ["fair", "light", "medium"], finish: "satin" },
    ],
    wuduFriendly: true,
    hajjUmrah: false,
    halalCertified: true,
    image: "/images/products/lip-stain-product.jpg",
    iconLabel: "new",
    sourceTags: ["Airbrush-like Stain", "Low-Shine Satin", "All-day Wear"],
  },

  // ----------------------------------------------------------------
  // WARDAH HYDRABALM LIP CARE
  // Source: PK Lip Wardah pp.5-6
  // 12H Fresh Healthy Lips, Re-hydration Tech, sheer natural colour
  // ----------------------------------------------------------------
  {
    slug: "wardah-hydrabalm",
    name: "Wardah Hydrabalm Lip Care",
    subtitle: "12H fresh, healthy, hydrated lips",
    price: 9.5,
    category: "lips",
    tryOn: "lipgloss",
    occasion: ["everyday", "hajj", "umrah", "ramadan"],
    description:
      "Advanced Re-hydration Technology for 12-hour non-greasy moisture. Enriched with shea butter and nourishing oils for soft, supple, healthy-looking lips. Ideal for Hajj and Umrah. Sheer natural colour.",
    ingredients:
      "Caprylic Triglyceride, Shea Butter, Sweet Almond Oil, Jojoba Seed Oil, Tocopheryl Acetate, Beeswax (halal-certified), Mica, Iron Oxides.",
    shades: [
      { name: "Natural Sheer", hex: "#e8c4a8", recommendedFor: ["fair", "light", "medium", "tan", "deep"], finish: "gloss" },
      { name: "Rose Tint", hex: "#d09090", recommendedFor: ["fair", "light", "medium"], finish: "satin" },
      { name: "Berry Glow", hex: "#b07080", recommendedFor: ["medium", "tan", "deep"], finish: "satin" },
    ],
    wuduFriendly: true,
    hajjUmrah: true,
    halalCertified: true,
    image: "/images/products/hydrabalm-hero.jpg",
    sourceTags: ["Re-hydration Tech", "12H Moisture", "Hajj & Umrah Safe"],
  },

  // ----------------------------------------------------------------
  // WARDAH LIP RESCUE JELLY BALM
  // Source: PK Lip Wardah pp.2-4
  // Tinted, Vit-C, 10X hydrating shea butter, multi-repairing, pillow plump
  // ----------------------------------------------------------------
  {
    slug: "wardah-lip-rescue",
    name: "Wardah Lip Rescue Jelly Balm",
    subtitle: "Tinted repair balm with Vitamin C",
    price: 10.5,
    category: "lips",
    tryOn: "lipgloss",
    occasion: ["everyday", "ramadan", "hajj", "umrah"],
    description:
      "Brighter and pillowy plump lips with this multi-repairing jelly balm. 3% Vitamin C for brightening, 10x hydrating shea butter, and nourishing oils. Sheer tint and peptide-plump complex. New 9g upgraded formula.",
    ingredients:
      "Polyisobutene, Castor Oil, Petrolatum (halal), Shea Butter, 3% Ascorbic Acid, Peptide Complex, Tocopheryl Acetate, Beeswax (halal-certified), Iron Oxides, Mica.",
    shades: [
      { name: "Berry Slushie", hex: "#c06080", recommendedFor: ["fair", "light", "medium", "tan", "deep"], finish: "gloss" },
      { name: "Sparkling Peach", hex: "#e0986a", recommendedFor: ["fair", "light", "medium", "tan", "deep"], finish: "shimmer" },
    ],
    wuduFriendly: true,
    hajjUmrah: true,
    halalCertified: true,
    image: "/images/products/lip-rescue-hero.jpg",
    iconLabel: "new",
    sourceTags: ["3% Vitamin C", "10X Hydrating Shea Butter", "Peptide Plump", "9g New Formula"],
  },

  // ----------------------------------------------------------------
  // NURA brand products (Wardah partnership formulations)
  // ----------------------------------------------------------------
  {
    slug: "wardah-halal-nail-polish",
    name: "Wardah Halal Nail Polish",
    subtitle: "Wudu-friendly breathable formula",
    price: 9.5,
    category: "nails",
    tryOn: "nails",
    occasion: ["everyday", "eid", "ramadan", "hajj", "umrah"],
    description:
      "Breathable nail polish designed to allow water passage, maintaining wudu validity per MUI guidance. Ideal for Hajj and Umrah. Long-wearing, chip-resistant.",
    ingredients:
      "Ethyl Acetate, Butyl Acetate, Isopropyl Alcohol-free base, Acetyl Tributyl Citrate, CI 77891, natural film-formers.",
    shades: [
      { name: "Ivory Pearl", hex: "#efe4d4", finish: "shimmer" },
      { name: "Rose Henna", hex: "#b06a6a", finish: "satin" },
      { name: "Umrah Nude", hex: "#c9a27f", finish: "satin" },
      { name: "Jannah Plum", hex: "#5a263d", finish: "satin" },
      { name: "Madinah Rose", hex: "#9e4b5d", finish: "shimmer" },
      { name: "Clear Wudu", hex: "#f7ecdf", finish: "gloss" },
    ],
    wuduFriendly: true,
    hajjUmrah: true,
    halalCertified: true,
    image: "/images/products/nail-polish.png",
    sourceTags: ["Wudu-friendly", "Breathable formula", "Hajj & Umrah Safe"],
  },
  {
    slug: "nura-velvet-blush",
    name: "NURA Velvet Blush",
    subtitle: "Buildable cheek colour",
    price: 16.0,
    category: "face",
    tryOn: "blush",
    occasion: ["everyday", "eid"],
    description:
      "Silky powder-to-cream hybrid blush that melts into skin. Flattering on warm South Asian undertones. Buildable from a natural flush to a bold cheek.",
    ingredients:
      "Isononyl Isononanoate, Dimethicone, Silica, Iron Oxides, Mica, Tocopheryl Acetate.",
    shades: [
      { name: "Peach Saffron", hex: "#e0907a", recommendedFor: ["fair", "light"], finish: "satin" },
      { name: "Rose Mitti", hex: "#c86b72", recommendedFor: ["light", "medium"], finish: "satin" },
      { name: "Terracotta", hex: "#a2533e", recommendedFor: ["medium", "tan", "deep"], finish: "matte" },
      { name: "Plum Kiss", hex: "#7d3a4f", recommendedFor: ["tan", "deep"], finish: "satin" },
    ],
    wuduFriendly: true,
    hajjUmrah: false,
    halalCertified: true,
    image: "/images/products/blush.png",
    sourceTags: ["Buildable", "South Asian undertones"],
  },
  {
    slug: "nura-sculpt-contour",
    name: "NURA Sculpt Contour",
    subtitle: "Warm-tone cream contour",
    price: 18.0,
    category: "face",
    tryOn: "contour",
    occasion: ["everyday", "eid"],
    description:
      "Warm-tone cream contour that blends seamlessly into medium-to-deep skin. Developed specifically for South Asian complexions. Never muddy, never grey.",
    ingredients:
      "Caprylic Triglyceride, Beeswax (halal-certified), Iron Oxides, Squalane, Tocopheryl Acetate.",
    shades: [
      { name: "Chai Light", hex: "#a87552", recommendedFor: ["fair", "light"], finish: "matte" },
      { name: "Walnut", hex: "#815138", recommendedFor: ["light", "medium", "tan"], finish: "matte" },
      { name: "Espresso", hex: "#533224", recommendedFor: ["tan", "deep"], finish: "matte" },
    ],
    wuduFriendly: true,
    hajjUmrah: false,
    halalCertified: true,
    image: "/images/products/contour.png",
    sourceTags: ["Warm contour", "Blendable cream"],
  },
  {
    slug: "nura-kohl-liner",
    name: "NURA Kohl Liner",
    subtitle: "Intense halal eyeliner",
    price: 11.0,
    category: "eyes",
    tryOn: "eyeliner",
    occasion: ["everyday", "eid", "ramadan"],
    description:
      "Rich, smudge-proof kohl liner with 10-hour wear. MUI halal certified with no animal-derived glycerin. Deep black pigment for defined eyes.",
    ingredients:
      "Cyclopentasiloxane, Trimethylsiloxysilicate, Iron Oxides (CI 77499), Carnauba Wax, Tocopheryl Acetate.",
    shades: [
      { name: "Noor Black", hex: "#0b0b0b", finish: "matte" },
      { name: "Madina Brown", hex: "#3d2419", finish: "matte" },
      { name: "Kohl Plum", hex: "#2a1420", finish: "matte" },
    ],
    wuduFriendly: true,
    hajjUmrah: false,
    halalCertified: true,
    image: "/images/products/liner.png",
    sourceTags: ["Smudge-proof", "10-hour wear"],
  },
  {
    slug: "nura-silk-eyeshadow",
    name: "NURA Silk Eyeshadow",
    subtitle: "Satin jewel-tone palette",
    price: 24.0,
    category: "eyes",
    tryOn: "eyeshadow",
    occasion: ["everyday", "eid"],
    description:
      "Five-shade jewel-tone palette curated for South Asian eyes. Buildable, blendable, halal. Pigment-rich formula with carmine-free colourants.",
    ingredients:
      "Talc, Mica, Zinc Stearate, Iron Oxides, Ultramarines, carmine-free pigments, Tocopheryl Acetate.",
    shades: [
      { name: "Ivory Silk", hex: "#f1e4d1", finish: "shimmer" },
      { name: "Rose Dust", hex: "#c98d8a", finish: "satin" },
      { name: "Bronze Zari", hex: "#8e6338", finish: "shimmer" },
      { name: "Plum Velvet", hex: "#5a2a3c", finish: "satin" },
      { name: "Emerald Noor", hex: "#2f5444", finish: "shimmer" },
    ],
    wuduFriendly: true,
    hajjUmrah: false,
    halalCertified: true,
    image: "/images/products/eyeshadow.png",
    sourceTags: ["Jewel-tone palette", "Blendable"],
  },
];

export const categories = [
  { slug: "lips", label: "Lips" },
  { slug: "nails", label: "Nails" },
  { slug: "face", label: "Face" },
  { slug: "eyes", label: "Eyes" },
];

export const occasions = [
  { slug: "everyday", label: "Everyday" },
  { slug: "eid", label: "Eid" },
  { slug: "ramadan", label: "Ramadan" },
  { slug: "hajj", label: "Hajj" },
  { slug: "umrah", label: "Umrah" },
];

export const skinTones = [
  { slug: "fair", label: "Fair", hex: "#f0d6c2" },
  { slug: "light", label: "Light", hex: "#e3b999" },
  { slug: "medium", label: "Medium", hex: "#c89878" },
  { slug: "tan", label: "Tan", hex: "#a37353" },
  { slug: "deep", label: "Deep", hex: "#6d4733" },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
