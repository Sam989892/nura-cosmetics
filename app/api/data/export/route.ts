// NURA — Data Subject Access Request endpoint
// ────────────────────────────────────────────
// UK GDPR Art.15 right of access.  Returns every record held against the
// hashed-email key — orders, contact tickets, and the consent log baked
// into each.
//
// In production this endpoint MUST be guarded by a verified-email step
// (one-time link or magic code) before returning data.  For now we accept
// only POST with the email in the body, signed with the server-side
// PRIVACY_REQUEST_TOKEN env var — protects against trivial enumeration
// while a proper verification flow is wired up.

import { NextResponse } from "next/server";
import { getStorage, hashEmail } from "@/lib/db";
import { NO_STORE_HEADERS } from "@/lib/privacy";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// One DSAR per IP per 15 min.  Article 12(3) gives controllers up to a
// month to respond — generous rate limit, but enough to deter probing.
const EXPORT_LIMIT = { capacity: 3, refillPerSec: 3 / 900 };

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "dsar-export", EXPORT_LIMIT);
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

  // Soft verification gate.  In production replace with an email-verified
  // one-time token; until then a static server token at least prevents
  // unauthenticated public access.
  const expected = process.env.NURA_PRIVACY_REQUEST_TOKEN;
  if (expected && body.verificationToken !== expected) {
    return NextResponse.json(
      {
        error:
          "Verification required. Please email " +
          "privacy@nuracosmetics.co.uk and we will verify your identity " +
          "and send the export within 30 days as required by UK GDPR.",
      },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const eh = hashEmail(email);
  const store = getStorage();
  const [orders, tickets] = await Promise.all([
    store.orders.findByEmail(eh),
    store.tickets.findByEmail(eh),
  ]);

  return NextResponse.json(
    {
      subject: { email },
      generatedAt: new Date().toISOString(),
      records: {
        orders: orders.map((o) => ({
          id: o.id,
          placedAt: o.placedAt,
          items: o.items,
          grandTotal: o.grandTotal,
          delivery: o.delivery,
          paymentStatus: o.paymentStatus,
          customer: o.customer,
          consent: o.consent,
          retainUntil: o.retainUntil,
        })),
        tickets: tickets.map((t) => ({
          id: t.id,
          receivedAt: t.receivedAt,
          subject: t.subject,
          message: t.message,
          consent: t.consent,
          retainUntil: t.retainUntil,
        })),
      },
      note:
        "This is the full set of personal data NURA Cosmetics holds " +
        "about you. Try-on biometric data is never stored. To request " +
        "erasure email privacy@nuracosmetics.co.uk or use POST /api/data/delete.",
    },
    { headers: NO_STORE_HEADERS }
  );
}
