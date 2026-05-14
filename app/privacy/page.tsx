import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Notice — NURA Cosmetics",
  description:
    "How NURA Cosmetics collects, uses, stores and protects your personal data under the UK GDPR and Data Protection Act 2018.",
};

export default function PrivacyPage() {
  return (
    <div className="container section" style={{ maxWidth: 820 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Privacy Notice</h1>
        <p className="text-mute" style={{ margin: "6px 0 0 0" }}>
          Version <strong>2026-05-14.v1</strong> · Last updated 14 May 2026
        </p>
      </header>

      <section style={{ marginBottom: 28 }}>
        <p>
          NURA Cosmetics Ltd (&ldquo;NURA&rdquo;, &ldquo;we&rdquo;,
          &ldquo;our&rdquo;) is the data controller for the personal data we
          collect through this website. We are committed to handling your
          data lawfully, fairly and transparently in line with the{" "}
          <strong>UK GDPR</strong> and the{" "}
          <strong>Data Protection Act 2018</strong>, and to the standards
          published by the Information Commissioner&apos;s Office (ICO).
        </p>
      </section>

      <Section title="1. Who we are">
        <p>
          <strong>NURA Cosmetics Ltd</strong>
          <br />
          Registered in England &amp; Wales.
          <br />
          Privacy contact: <a href="mailto:privacy@nuracosmetics.co.uk">privacy@nuracosmetics.co.uk</a>
          <br />
          Data Protection Officer: <a href="mailto:dpo@nuracosmetics.co.uk">dpo@nuracosmetics.co.uk</a>
          <br />
          ICO registration: pending
        </p>
      </Section>

      <Section title="2. What data we collect and why">
        <Table
          rows={[
            ["Order details", "Name, address, email, phone, items, amount paid", "Contract (Art.6(1)(b))", "6 years (HMRC)"],
            ["Contact messages", "Name, email, subject, message body", "Legitimate interest (Art.6(1)(f))", "24 months"],
            ["Marketing email", "Email + preferences", "Consent (Art.6(1)(a))", "Until you unsubscribe"],
            ["Analytics", "Pages viewed, device type", "Consent (Art.6(1)(a))", "26 months"],
            ["Try-on face data", "Processed in your browser only — never sent to or stored by us", "—", "Not stored"],
          ]}
          headers={["Category", "What", "Lawful basis", "Retention"]}
        />
      </Section>

      <Section title="3. Virtual Try-On — biometric data">
        <p>
          When you upload a photo to the Virtual Try-On Studio, face
          detection runs <strong>entirely in your browser</strong> using
          Google&apos;s open-source MediaPipe library. The photo and the
          468-point face mesh it produces <strong>never leave your device</strong>.
        </p>
        <p>
          When you tap <em>Scan my face</em> we send back to our server
          only:
        </p>
        <ul>
          <li>An average RGB sample of three forehead/cheek pixels (3 numbers, ~10 bytes)</li>
          <li>The normalised face-mesh coordinates so we can pick a face-shape category</li>
        </ul>
        <p>
          We do <strong>not</strong> store this on our servers. The response
          is computed in-memory and returned to your browser. No raw image,
          no biometric template, no identifier. This is by design — biometric
          data is a special category under UK GDPR Art.9 and the right
          approach is to not handle it at all.
        </p>
      </Section>

      <Section title="4. Cookies and similar technologies">
        <p>
          We use a small number of strictly necessary cookies for the cart
          and login. With your opt-in consent we also use analytics and
          marketing cookies. You can review and change these at any time
          via the cookie banner — clear your <code>nura_consent_v1</code>{" "}
          local storage entry to re-prompt.
        </p>
      </Section>

      <Section title="5. Who we share data with">
        <p>We only share with third parties who help us run the service:</p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> — hosts the website. Data centres
            chosen for UK / EU presence. Contractual safeguards: UK
            International Data Transfer Addendum.
          </li>
          <li>
            <strong>Stripe (UK) Ltd</strong> — payment processing. Stripe
            is the data controller for the card details you enter; we
            never see them.
          </li>
          <li>
            <strong>Royal Mail / DPD UK</strong> — fulfilment partners.
            Receive name + address only.
          </li>
        </ul>
        <p>We never sell personal data.</p>
      </Section>

      <Section title="6. International transfers">
        <p>
          Where data is processed outside the UK, we rely on the UK
          International Data Transfer Addendum to the EU Standard
          Contractual Clauses, plus the supplementary measures required by
          the ICO&apos;s transfer risk assessment guidance.
        </p>
      </Section>

      <Section title="7. How we protect your data">
        <ul>
          <li>TLS 1.2+ in transit for everything.</li>
          <li>Personal data fields encrypted at rest in production.</li>
          <li>IP addresses hashed (SHA-256 + server salt) before storage.</li>
          <li>Strict no-store HTTP cache headers on all PII-bearing API responses.</li>
          <li>Per-endpoint rate limits to deter scraping and abuse.</li>
          <li>Access logs reviewed monthly; PII never written to logs.</li>
        </ul>
      </Section>

      <Section title="8. Your rights">
        <p>Under the UK GDPR you have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> — request a copy of your data. Email{" "}
            <a href="mailto:privacy@nuracosmetics.co.uk">
              privacy@nuracosmetics.co.uk
            </a>{" "}
            or POST <code>/api/data/export</code>.
          </li>
          <li>
            <strong>Rectification</strong> — ask us to correct inaccurate
            data.
          </li>
          <li>
            <strong>Erasure</strong> — ask us to delete your data. Order
            records are anonymised rather than deleted to satisfy our HMRC
            tax-record obligation (UK GDPR Art.17(3)(b)).
          </li>
          <li>
            <strong>Restriction</strong> and <strong>Objection</strong>{" "}
            — pause processing or stop us using your data for marketing.
          </li>
          <li>
            <strong>Portability</strong> — receive your data in a
            machine-readable format (we return JSON).
          </li>
          <li>
            <strong>Withdraw consent</strong> at any time, without
            affecting prior lawful processing.
          </li>
        </ul>
        <p>
          We respond within <strong>30 days</strong> (Art.12(3)). If you
          aren&apos;t happy, you can complain to the ICO at{" "}
          <a href="https://ico.org.uk/concerns/" target="_blank" rel="noreferrer">
            ico.org.uk/concerns
          </a>{" "}
          or by calling 0303 123 1113.
        </p>
      </Section>

      <Section title="9. Changes to this notice">
        <p>
          When we update this notice we bump the version number and our
          cookie banner re-prompts. The version in force when you placed an
          order is the one that applies to that order — every record carries
          its consent metadata.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          For any privacy question:{" "}
          <a href="mailto:privacy@nuracosmetics.co.uk">privacy@nuracosmetics.co.uk</a>.
          For a formal Data Subject Access Request please include
          &ldquo;DSAR&rdquo; in the subject line so we can route it directly
          to our DPO.
        </p>
      </Section>

      <p style={{ marginTop: 28 }}>
        <Link href="/" className="btn btn-ghost">
          ← Back to shop
        </Link>
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: "1.25rem", marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 12 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.9rem",
        }}
      >
        <thead>
          <tr style={{ textAlign: "left", background: "var(--nura-cream, #fbf7f3)" }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid var(--nura-line, #e5e5e5)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ verticalAlign: "top" }}>
              {r.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--nura-line, #e5e5e5)",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
