// NURA — Privacy & consent constants
// ───────────────────────────────────
// Central place to bump when the privacy notice changes. Every record we
// persist captures the version in force at the time of consent so we can
// honour DSARs and prove lawful basis years later.

export const PRIVACY_VERSION = "2026-05-14.v1";

export const PRIVACY_CONTACT_EMAIL = "privacy@nuracosmetics.co.uk";
export const DPO_EMAIL = "dpo@nuracosmetics.co.uk";

export const RETENTION_POLICY = {
  // HMRC requires tax records (incl. invoices) for 6 years.
  orders: "6 years from order date — UK Finance Act / HMRC §VAT-700",
  // ICO guidance — reasonable retention for customer-service correspondence.
  tickets: "24 months from last interaction",
  // Try-on uses only ephemeral client-side biometric processing. No server
  // retention. We only persist the derived non-biometric outputs (skin tone
  // band, undertone) if the user accepts personalised recommendations.
  tryon: "Not stored on our servers — all face detection runs in your browser",
  // Cookies: see CookieConsent component.
  consent: "24 months from acceptance, then re-prompt",
} as const;

// Headers that should never cache personal-data responses.  Applied to every
// `/api/...` route that touches identifiable data.
export const NO_STORE_HEADERS: HeadersInit = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  "Surrogate-Control": "no-store",
};
