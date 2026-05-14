import { NextResponse } from "next/server";
import {
  getStorage,
  hashIp,
  ticketRetainUntil,
  type ConsentRecord,
  type ContactTicket,
} from "@/lib/db";
import { PRIVACY_VERSION, NO_STORE_HEADERS } from "@/lib/privacy";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type ContactPayload = {
  name: string;
  email: string;
  subject?: string;
  message: string;
  consent?: {
    privacyVersion?: string;
    termsAccepted?: boolean;
    marketingOptIn?: boolean;
  };
};

// Conservative rate limit on contact form: 5 messages per IP per ~5 min.
const CONTACT_LIMIT = { capacity: 5, refillPerSec: 5 / 300 };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "contact", CONTACT_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many messages. Please wait before sending another." },
      { status: 429, headers: { ...NO_STORE_HEADERS, "Retry-After": String(rl.retryAfter) } }
    );
  }

  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const { name, email, message } = payload || {};

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email and message are required." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (message.trim().length < 10) {
    return NextResponse.json(
      { error: "Message must be at least 10 characters." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (message.length > 5000) {
    return NextResponse.json(
      { error: "Message is too long (5000 char max)." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!payload.consent?.termsAccepted) {
    return NextResponse.json(
      { error: "Please accept the privacy notice to send your message." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const ticketId = `NURA-MSG-${Date.now().toString(36).toUpperCase()}`;
  const receivedAt = new Date().toISOString();

  const consent: ConsentRecord = {
    version: payload.consent.privacyVersion || PRIVACY_VERSION,
    acceptedAt: receivedAt,
    ip: hashIp(ip),
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    marketing: !!payload.consent.marketingOptIn,
    analytics: false,
  };

  const ticket: ContactTicket = {
    id: ticketId,
    receivedAt,
    name,
    email: email.toLowerCase(),
    subject: payload.subject,
    message,
    consent,
    retainUntil: ticketRetainUntil(new Date(receivedAt)),
  };

  try {
    await getStorage().tickets.insert(ticket);
  } catch (err) {
    console.error("[contact] persistence failed:", (err as Error)?.message);
    return NextResponse.json(
      { error: "We could not record your message. Please try again." },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ticketId,
      receivedAt,
      status: "received",
      note:
        "Email delivery hook ready. Wire SENDGRID_API_KEY or RESEND_API_KEY to forward to hello@nuracosmetics.co.uk.",
    },
    { headers: NO_STORE_HEADERS }
  );
}
