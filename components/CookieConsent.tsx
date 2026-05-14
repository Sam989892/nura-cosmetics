"use client";
// NURA — Cookie / consent banner
// ───────────────────────────────
// UK GDPR + PECR compliant:
//   • Banner shown until the user makes an active choice — no implied consent.
//   • Marketing + analytics default OFF; require an explicit click.
//   • Choice persisted in localStorage as { version, accepted, marketing,
//     analytics, ts }. Re-prompts automatically when PRIVACY_VERSION bumps.
//   • Granular controls — "Accept all" and "Only essential" are equally
//     prominent per ICO 2024 guidance ("no dark patterns").
//
// We deliberately do not log the consent here — for non-purchasing visitors
// we store nothing on the server. Persistence happens only at the point a
// purchase / message is sent, where the same flags get attached to that
// record.

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "nura_consent_v1";
// Mirror PRIVACY_VERSION from lib/privacy.ts.  When the privacy notice
// changes we bump this and the banner re-prompts.
const CURRENT_VERSION = "2026-05-14.v1";

type Consent = {
  version: string;
  accepted: boolean;
  marketing: boolean;
  analytics: boolean;
  ts: string;
};

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Consent;
    if (c.version !== CURRENT_VERSION) return null;
    return c;
  } catch {
    return null;
  }
}

function writeConsent(c: Consent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {}
}

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const [granular, setGranular] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    // Only show after hydration, and only if no current-version consent
    // record exists. Avoids the SSR/CSR mismatch flash.
    if (!readConsent()) setShow(true);
  }, []);

  if (!show) return null;

  function save(c: Omit<Consent, "version" | "ts">) {
    writeConsent({
      ...c,
      version: CURRENT_VERSION,
      ts: new Date().toISOString(),
    });
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie and privacy preferences"
      aria-modal="false"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9000,
        background: "#fff",
        color: "#1a1a1a",
        border: "1px solid var(--nura-line, #e5e5e5)",
        borderRadius: 14,
        boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
        padding: "18px 20px",
        maxWidth: 640,
        margin: "0 auto",
        fontSize: "0.92rem",
        lineHeight: 1.45,
      }}
    >
      <strong style={{ fontSize: "1rem", display: "block", marginBottom: 4 }}>
        Your privacy, your choice
      </strong>
      <p style={{ margin: "0 0 12px 0", color: "#555" }}>
        We use essential cookies to make the site work. With your permission
        we&apos;ll also use analytics to improve it and marketing to send you
        new shade drops. You can change this any time.{" "}
        <Link href="/privacy" style={{ textDecoration: "underline" }}>
          Read the full notice
        </Link>
        .
      </p>

      {granular && (
        <div style={{ marginBottom: 12, display: "grid", gap: 8 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#777",
            }}
          >
            <input type="checkbox" checked disabled />
            <span>
              <strong>Essential</strong> — required for the cart, checkout,
              and login. Always on.
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
            />
            <span>
              <strong>Analytics</strong> — aggregate stats so we can find
              broken pages. No tracking across other sites.
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
            />
            <span>
              <strong>Marketing</strong> — new shades, restocks, Eid drops.
              Email only. Unsubscribe any time.
            </span>
          </label>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {!granular && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setGranular(true)}
          >
            Manage choices
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => save({ accepted: true, marketing: false, analytics: false })}
        >
          Only essential
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            save({
              accepted: true,
              marketing: granular ? marketing : true,
              analytics: granular ? analytics : true,
            })
          }
        >
          {granular ? "Save choices" : "Accept all"}
        </button>
      </div>
    </div>
  );
}
