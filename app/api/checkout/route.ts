import { NextResponse } from "next/server";

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
};

const SHIPPING_COSTS: Record<CheckoutPayload["delivery"], number> = {
  standard: 3.95,
  express: 6.95,
  collect: 0,
};

const FREE_THRESHOLD = 40;

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
  let payload: CheckoutPayload;

  try {
    payload = (await request.json()) as CheckoutPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload?.items?.length) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }

  const c = payload.customer;
  if (!c?.name || !c?.email || !c?.address1 || !c?.city || !c?.postcode) {
    return NextResponse.json({ error: "Missing required address fields." }, { status: 400 });
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  if (!isValidPostcode(c.postcode)) {
    return NextResponse.json({ error: "Invalid UK postcode." }, { status: 400 });
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

  return NextResponse.json({
    orderId,
    placedAt,
    subtotal: +subtotal.toFixed(2),
    shipping: +shipping.toFixed(2),
    grandTotal,
    delivery,
    eta,
    paymentStatus: "simulated_paid",
    note:
      "Stripe integration ready. Connect NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY to switch from simulated to live capture.",
  });
}
