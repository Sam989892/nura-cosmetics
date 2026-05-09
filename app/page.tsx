import Link from "next/link";
import Image from "next/image";
import TrustStrip from "@/components/TrustStrip";
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";

export default function HomePage() {
  const featured = products.slice(0, 4);
  return (
    <>
      {/* HERO */}
      <section className="hero" aria-label="Hero">
        <div className="container hero-inner">
          <div>
            <span className="badge badge-halal" style={{ marginBottom: 16 }}>✦ MUI Halal Certified</span>
            <h1>Shop Halal Beauty With Confidence.</h1>
            <p className="hero-lede">
              Discover bestselling shades first, then use private upload try-on to confirm your perfect match before checkout.
            </p>
            <div className="hero-cta">
              <Link href="/shop" className="btn btn-primary">Start Shopping</Link>
              <Link href="/try-on" className="btn btn-ghost">Try Before You Buy</Link>
            </div>
            <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span className="badge badge-wudu">✓ Wudu-friendly</span>
              <span className="badge">Permissible for Hajj & Umrah</span>
              <span className="badge">UK Delivery 3–5 days</span>
            </div>
          </div>
          <div className="hero-image">
            <Image src="/images/site/hero-model.png" alt="South Asian model wearing NURA lip colour" fill priority sizes="(max-width: 900px) 100vw, 50vw" />
          </div>
        </div>
      </section>

      <TrustStrip />

      <section className="section-sm">
        <div className="container ecommerce-funnel">
          <div><strong>1. Browse</strong><span>Shop lip, face, eye essentials</span></div>
          <div><strong>2. Try On</strong><span>Upload a photo and test shades privately</span></div>
          <div><strong>3. Checkout</strong><span>Add to cart and place your order in minutes</span></div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="section">
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>The Edit</h2>
              <p className="text-mute" style={{ margin: 0 }}>Hand-picked shades. Every one of them, halal.</p>
            </div>
            <Link href="/shop" className="btn btn-ghost">Shop all →</Link>
          </div>
          <div className="product-grid">
            {featured.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </div>
      </section>

      <div className="ornament">✦  ✦  ✦</div>

      {/* BRAND STORY */}
      <section className="section" style={{ background: "var(--nura-cream)" }}>
        <div className="container grid-2" style={{ alignItems: "center" }}>
          <div>
            <h2>A beauty brand built on faith, not compromise.</h2>
            <p>
              NURA was founded in the UK by Gulam Mohammed Saiyed to answer a simple question: why
              should a British Muslim woman choose between halal integrity and world-class beauty?
              She shouldn&apos;t. We partner directly with Wardah — Indonesia&apos;s number one MUI
              halal-certified cosmetics house — to bring you formulations engineered for modern
              Muslim life.
            </p>
            <p>
              Every shade in our edit was selected for South Asian undertones. Every formula is
              reviewed for wudu-friendliness, fragrance-free Hajj options, and ingredient
              transparency. MSDS documents available on request.
            </p>
            <Link href="/about" className="btn btn-gold">Our story</Link>
          </div>
          <div style={{ aspectRatio: "4/5", borderRadius: "var(--radius-lg)", position: "relative", overflow: "hidden" }}>
            <Image src="/images/site/founder-portrait.png" alt="NURA founder portrait" fill sizes="(max-width: 900px) 100vw, 50vw" />
          </div>
        </div>
      </section>

      {/* TRY-ON CTA */}
      <section className="section">
        <div className="container">
          <div className="home-tryon-cta">
            <div>
              <h2 style={{ color: "var(--nura-gold)", margin: 0 }}>Try every shade before you buy.</h2>
              <p style={{ color: "rgba(255,255,255,0.85)", marginTop: 8, maxWidth: 600 }}>
                Upload a photo, run a private face scan, and test curated shades instantly.
                All detection stays in your browser.
              </p>
            </div>
            <Link href="/try-on" className="btn btn-gold">Open Studio →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
