import Link from "next/link";

export const metadata = { title: "Halal Assurance — NURA Cosmetics" };

export default function HalalPage() {
  return (
    <div className="container section">
      <header style={{ maxWidth: 720, marginBottom: 32 }}>
        <span className="badge badge-halal">✦ MUI Halal Certified</span>
        <h1>Halal Assurance</h1>
        <p className="text-mute">
          At NURA, halal integrity is not a marketing line — it is the reason this brand exists.
          Here is exactly what that means for the products you put on your skin.
        </p>
      </header>

      <section className="grid-2" style={{ marginBottom: 48 }}>
        <div className="cert-card">
          <div className="cert-card-icon">✦</div>
          <h3>MUI Halal Certification</h3>
          <p className="text-mute">
            Every Wardah formulation in our range is certified by Majelis Ulama Indonesia (MUI) —
            the Indonesian Ulema Council — the world&apos;s most respected halal authority for
            cosmetics. Certificates are available on request.
          </p>
        </div>
        <div className="cert-card">
          <div className="cert-card-icon">✓</div>
          <h3>Wudu-Friendly Formulations</h3>
          <p className="text-mute">
            Our nail polishes use a breathable film that permits water passage, and our makeup
            formulas do not form an occlusive layer that blocks wudu. Water can reach the skin
            underneath.
          </p>
        </div>
        <div className="cert-card">
          <div className="cert-card-icon">✻</div>
          <h3>Permissible for Hajj & Umrah</h3>
          <p className="text-mute">
            Selected products are fragrance-free and alcohol-free, making them permissible
            during Hajj and Umrah when ihram restrictions apply. Look for the
            &ldquo;Hajj &amp; Umrah&rdquo; badge.
          </p>
        </div>
        <div className="cert-card">
          <div className="cert-card-icon">📄</div>
          <h3>MSDS on Request</h3>
          <p className="text-mute">
            Material Safety Data Sheets and full ingredient provenance documentation
            are available on request for every product.
            <br />
            <Link href="/contact">Request MSDS →</Link>
          </p>
        </div>
      </section>

      <div className="ornament">✦  ✦  ✦</div>

      <section style={{ maxWidth: 760 }}>
        <h2>How we verify halal</h2>
        <p>
          NURA sources exclusively through an authorised UK import route from Wardah by Paragon
          Technology and Innovation (Jakarta, Indonesia). Wardah holds MUI halal certification,
          which audits: ingredient origins (no pork-derived, no alcohol from khamr, no blood or
          carrion derivatives), manufacturing separation from non-halal lines, and full supply
          chain traceability.
        </p>
        <p>
          On the UK side, NURA is in active discussions for secondary validation with the
          Halal Monitoring Committee (HMC) and the Halal Food Authority (HFA). This is an
          ongoing process, and we will publish each certificate as it is granted.
        </p>

        <h2 style={{ marginTop: 40 }}>Understanding wudu-friendly</h2>
        <p>
          Conventional nail polish forms a waterproof seal that prevents water from reaching
          the nail, which invalidates wudu. Our halal nail polish uses a porous film structure
          tested to allow water passage under normal ablution conditions. For the strictest
          interpretation during Hajj or Umrah, we recommend using the polishes flagged with
          the &ldquo;Hajj &amp; Umrah&rdquo; badge, which have been reviewed specifically for
          that ihram context.
        </p>

        <h2 style={{ marginTop: 40 }}>Frequently asked</h2>
        <details className="accordion-item">
          <summary className="accordion-q">Is this brand certified halal in the UK?</summary>
          <p className="accordion-a">
            The formulations are MUI halal certified. UK-side validation via HMC/HFA is in
            progress and we will publish certificates as they are granted.
          </p>
        </details>
        <details className="accordion-item">
          <summary className="accordion-q">Does the makeup contain alcohol?</summary>
          <p className="accordion-a">
            Our core range is alcohol-free. Products suitable for Hajj and Umrah are
            additionally fragrance-free.
          </p>
        </details>
        <details className="accordion-item">
          <summary className="accordion-q">Can I perform wudu with the nail polish on?</summary>
          <p className="accordion-a">
            Yes, our wudu-friendly nail polish uses a breathable formula designed to permit
            water passage. We publish independent test references on request.
          </p>
        </details>
        <details className="accordion-item">
          <summary className="accordion-q">Are ingredients animal-derived?</summary>
          <p className="accordion-a">
            No pork-derived ingredients and no carmine. Any animal-derived ingredient (e.g., beeswax)
            is sourced to halal standards and audited under the MUI certification.
          </p>
        </details>
      </section>
    </div>
  );
}
