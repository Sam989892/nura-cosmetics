import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "About NURA — Halal Beauty. Real You." };

export default function AboutPage() {
  return (
    <div className="container section">
      <header style={{ maxWidth: 760 }}>
        <span className="badge">Our Story</span>
        <h1>Built in Britain, grounded in faith.</h1>
        <p className="text-mute" style={{ fontSize: "1.15rem" }}>
          NURA Cosmetics is a UK-based halal beauty house for the British Muslim woman
          who refuses to choose between her faith and her face.
        </p>
      </header>

      <section className="grid-2 section" style={{ alignItems: "center" }}>
        <div>
          <h2>The founder</h2>
          <p>
            Gulam Mohammed Saiyed founded NURA in the United Kingdom after years of
            watching the British Muslim beauty market be served either by mass-market
            brands with no halal integrity, or by halal-certified imports with no
            distribution, no marketing, and no cultural fluency in what South Asian
            Muslim women actually want to wear.
          </p>
          <p>
            NURA exists to fix that. Our mission, in plain English: be the number one
            halal beauty brand in the UK — with uncompromising halal credentials and
            a shade range curated for Pakistani, Bangladeshi, and Indian skin tones.
          </p>
        </div>
        <div style={{ aspectRatio: "1", borderRadius: "var(--radius-lg)", position: "relative", overflow: "hidden" }}>
          <Image src="/images/site/about-story.png" alt="NURA community portrait" fill sizes="(max-width: 900px) 100vw, 50vw" />
        </div>
      </section>

      <div className="ornament">✦  ✦  ✦</div>

      <section className="section-sm">
        <h2>Our partnership with Wardah</h2>
        <p style={{ maxWidth: 760 }}>
          NURA is the official UK partner for Wardah, Indonesia&apos;s leading halal
          cosmetics brand, produced by Paragon Technology and Innovation in Jakarta.
          Wardah holds MUI halal certification and is the benchmark for halal
          cosmetics globally. We import direct through an authorised route, which
          means every product you receive is the identical formulation Wardah ships
          to millions of women across Southeast Asia — now curated for the UK market.
        </p>
      </section>

      <section className="section-sm">
        <h2>What we stand for</h2>
        <div className="grid-2">
          <div>
            <h3>Halal integrity, not branding</h3>
            <p className="text-mute">
              MUI certified formulas, wudu-friendly review, Hajj and Umrah
              permissibility on selected lines, full MSDS on request.
            </p>
          </div>
          <div>
            <h3>South Asian shade range</h3>
            <p className="text-mute">
              Every shade is tested against the full spectrum of South Asian
              undertones, from fair Kashmiri through deep Tamil skin.
            </p>
          </div>
          <div>
            <h3>Privacy in beauty tech</h3>
            <p className="text-mute">
              Our virtual try-on runs entirely in your browser — no photos uploaded,
              ever. Modest by design.
            </p>
          </div>
          <div>
            <h3>Real UK delivery</h3>
            <p className="text-mute">
              Warehoused and dispatched from the UK. 3–5 working day delivery, not
              8 weeks from overseas.
            </p>
          </div>
        </div>
      </section>

      <section style={{
        background: "linear-gradient(135deg, var(--nura-plum) 0%, var(--nura-plum-deep) 100%)",
        color: "var(--nura-cream)",
        borderRadius: "var(--radius-lg)",
        padding: 48, textAlign: "center", marginTop: 32
      }}>
        <h2 style={{ color: "var(--nura-gold)" }}>Ready to try NURA?</h2>
        <p style={{ color: "rgba(255,255,255,0.85)", maxWidth: 520, margin: "0 auto 20px" }}>
          Shop the edit, or open our upload-first try-on studio. Every shade, private by default.
        </p>
        <div style={{ display: "inline-flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/shop" className="btn btn-gold">Shop the Edit</Link>
          <Link href="/try-on" className="btn btn-ghost" style={{ borderColor: "var(--nura-cream)", color: "var(--nura-cream)" }}>Open Try-On Studio</Link>
        </div>
      </section>
    </div>
  );
}
