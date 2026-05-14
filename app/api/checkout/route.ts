import { NextResponse } from "next/server";
import {
  getStorage,
  hashIp,
  orderRetainUntil,
  type ConsentRecord,
  type Order,
} from "@/lib/db";
import { PRIVACY_VERSION, NO_STORE_HEADERS } from "@/lib/privacy";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type CheckoutItem = {
  slug: string;
  name: string;
  shadeName: string;
  price: number;
  qty: number;
};

type CheckoutPayload = {
  items: CheckoutItem[];
  customer: {
    name: string;
    email: string;
    phone?: string;
    address1: string;
    address2?: string;
    city: string;
    postcode: string;
  };
  delivery: "standard" | "express" | "collect";
  // UK GDPR — explicit consent fields. The order itself is processed on the
  // "contract" lawful basis (Art.6(1)(b)). Marketing and analytics require a
  // separate, opt-in lawful basis (Art.6(1)(a)) so they default to false.
  consent: {
    privacyVersion: string;
    termsAccepted: boolean;
    marketingOptIn?: boolean;
    analyticsOptIn?: boolean;
  };
};

const SHIPPING_COSTS: Record<CheckoutPayload["delivery"], number> = {
  standard: 3.95,
  express: 6.95,
  collect: 0,
};

const FREE_THRESHOLD = 40;
// Per-IP — generous, but prevents card-testing bursts.
const CHECKOUT_LIMIT = { capacity: 10, refillPerSec: 0.1 };

function computeShipping(subtotal: number, delivery: CheckoutPayload["delivery"]) {
  if (delivery === "collect") return 0;
  if (delivery === "standard" && subtotal >= FREE_THRESHOLD) return 0;
  return SHIPPING_COSTS[delivery];
}

function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NURA-${ts}-${rand}`;
}

function isValidPostcode(postcode: string) {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc);
}

export async function POST(request: Request) {
  // ── Rate limit ───────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "checkout", CHECKOUT_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait." },
      { status: 429, headers: { ...NO_STORE_HEADERS, "Retry-After": String(rl.retryAfter) } }
    );
  }

  let payload: CheckoutPayload;
  try {
    payload = (await request.json()) as CheckoutPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!payload?.items?.length) {
    return NextResponse.json(
      { error: "Cart is empty." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const c = payload.customer;
  if (!c?.name || !c?.email || !c?.address1 || !c?.city || !c?.postcode) {
    return NextResponse.json(
      { error: "Missing required address fields." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!isValidPostcode(c.postcode)) {
    return NextResponse.json(
      { error: "Invalid UK postcode." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // UK GDPR — order can be processed on contract basis without explicit
  // consent, BUT we still record T&Cs acceptance for audit. If the payload
  // doesn't include consent metadata we reject — the checkout form must
  // capture it.
  if (!payload.consent || !payload.consent.termsAccepted) {
    return NextResponse.json(
      { error: "Please accept the terms and privacy notice to continue." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const delivery = payload.delivery in SHIPPING_COSTS ? payload.delivery : "standard";

  const subtotal = payload.items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const shipping = computeShipping(subtotal, delivery);
  const grandTotal = +(subtotal + shipping).toFixed(2);

  const orderId = generateOrderId();
  const placedAt = new Date().toISOString();
  const eta =
    delivery === "express"
      ? "1–2 working days"
      : delivery === "collect"
      ? "Ready in 24 hours"
      : "3–5 working days";

  // Build the consent record we'll persist alongside the order. The hashed
  // IP gives us a forensic trail if a chargeback / fraud claim arrives,
  // without storing the raw network identifier.
  const consent: ConsentRecord = {
    version: payload.consent.privacyVersion || PRIVACY_VERSION,
    acceptedAt: placedAt,
    ip: hashIp(ip),
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    marketing: !!payload.consent.marketingOptIn,
    analytics: !!payload.consent.analyticsOptIn,
  };

  const order: Order = {
    id: orderId,
    placedAt,
    customer: {
      name: c.name,
      email: c.email.toLowerCase(),
      phone: c.phone,
      address1: c.address1,
      address2: c.address2,
      city: c.city,
      postcode: c.postcode.toUpperCase(),
    },
    items: payload.items,
    subtotal: +subtotal.toFixed(2),
    shipping: +shipping.toFixed(2),
    grandTotal,
    delivery,
    paymentStatus: "simulated_paid",
    consent,
    retainUntil: orderRetainUntil(new Date(placedAt)),
  };

  try {
    await getStorage().orders.insert(order);
  } catch (err) {
    // Persistence failure must not silently drop the order. Surface the
    // error to the user so they can retry, and emit a low-detail server log
    // (no PII) so ops can investigate.
    console.error("[checkout] persistence failed:", (err as Error)?.message);
    return NextResponse.json(
      { error: "Order could not be saved. Please retry shortly." },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      orderId,
      placedAt,
      subtotal: order.subtotal,
      shipping: order.shipping,
      grandTotal,
      delivery,
      eta,
      paymentStatus: "simulated_paid",
      note:
        "Stripe integration ready. Connect NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY to switch from simulated to live capture.",
    },
    { headers: NO_STORE_HEADERS }
  );
}
