import { NextResponse } from "next/server";

type ContactPayload = {
  name: string;
  email: string;
  subject?: string;
  message: string;
};

export async function POST(request: Request) {
  let payload: ContactPayload;

  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, email, message } = payload || {};

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email and message are required." },
      { status: 400 }
    );
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  if (message.trim().length < 10) {
    return NextResponse.json(
      { error: "Message must be at least 10 characters." },
      { status: 400 }
    );
  }

  const ticketId = `NURA-MSG-${Date.now().toString(36).toUpperCase()}`;
  const receivedAt = new Date().toISOString();

  if (process.env.NODE_ENV !== "production") {
    console.log("[contact]", {
      ticketId,
      receivedAt,
      from: email,
      subject: payload.subject ?? "(no subject)",
    });
  }

  return NextResponse.json({
    ticketId,
    receivedAt,
    status: "received",
    note:
      "Email delivery hook ready. Wire SENDGRID_API_KEY or RESEND_API_KEY to forward to hello@nuracosmetics.co.uk.",
  });
}
