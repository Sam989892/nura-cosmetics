// NURA — Right to Erasure endpoint (UK GDPR Art.17)
// ──────────────────────────────────────────────────
// Hard-deletes contact tickets and ANONYMISES orders (we must retain
// financial records for 6 years per HMRC — Art.17(3)(b) override).
//
// Same soft verification token as /api/data/export.  In production
// replace with a verified-email magic-link step.

import { NextResponse } from "next/server";
import { getStorage, hashEmail } from "@/lib/db";
import { NO_STORE_HEADERS } from "@/lib/privacy";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const DELETE_LIMIT = { capacity: 3, refillPerSec: 3 / 900 };

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "dsar-delete", DELETE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { ...NO_STORE_HEADERS, "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body: { email?: string; verificationToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "Provide a valid email." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const expected = process.env.NURA_PRIVACY_REQUEST_TOKEN;
  if (expected && body.verificationToken !== expected) {
    return NextResponse.json(
      {
        error:
          "Verification required. Email privacy@nuracosmetics.co.uk and " +
          "we will verify your identity and process the erasure within " +
          "30 days as required by UK GDPR.",
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const eh = hashEmail(email);
  const store = getStorage();

  // Tickets: full hard delete.  No legal-hold exception.
  const ticketsDeleted = await store.tickets.deleteByEmail(eh);

  // Orders: ANONYMISE (strip PII, keep financial fields).  HMRC requires
  // tax records for 6 years — Art.17(3)(b) "compliance with a legal
  // obligation" overrides erasure for the order itself, but we must still
  // remove identifying personal data.
  const ordersAnonymised = await store.orders.anonymiseByEmail(eh);

  return NextResponse.json(
    {
      processedAt: new Date().toISOString(),
      ticketsDeleted,
      ordersAnonymised,
      note:
        "Contact tickets fully deleted. Order records retained for HMRC " +
        "(6-year statutory obligation) but personal data redacted. " +
        "Try-on data is never stored on our servers.",
    },
    { headers: NO_STORE_HEADERS }
  );
}
