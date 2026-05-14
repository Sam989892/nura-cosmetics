"use client";
import { useState } from "react";
import Link from "next/link";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "general",
    message: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setError(null);
    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          consent: {
            privacyVersion: "2026-05-14.v1",
            termsAccepted,
            marketingOptIn,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Message could not be sent.");
      }
      setTicketId(data.ticketId);
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed to send.");
      setStatus("error");
    }
  }

  const sending = status === "sending";
  const sent = status === "sent";

  return (
    <div className="container section">
      <header style={{ maxWidth: 720 }}>
        <h1>Contact &amp; FAQ</h1>
        <p className="text-mute">
          We reply in UK business hours, typically within 24 hours.
        </p>
      </header>

      <div className="grid-2" style={{ marginTop: 32 }}>
        <div>
          <h2>Get in touch</h2>
          {sent ? (
            <div
              style={{
                background: "var(--nura-cream)",
                border: "1px solid var(--nura-gold)",
                padding: 20,
                borderRadius: "var(--radius-md)",
              }}
            >
              <strong>Message received.</strong>
              <p style={{ margin: "8px 0 0", color: "var(--nura-mute)" }}>
                Reference <strong>{ticketId}</strong>. We&apos;ll get back to
                you at <strong>{form.email}</strong>.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setStatus("idle");
                  setTicketId(null);
                  setForm({
                    name: "",
                    email: "",
                    subject: "general",
                    message: "",
                  });
                }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="c-name">Name</label>
                  <input
                    id="c-name"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="c-email">Email</label>
                  <input
                    id="c-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="c-subject">Reason</label>
                <select
                  id="c-subject"
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                >
                  <option value="general">General question</option>
                  <option value="halal">Halal assurance question</option>
                  <option value="order">Order issue</option>
                  <option value="wholesale">Wholesale / stockist</option>
                  <option value="msds">Request MSDS / ingredient docs</option>
                  <option value="press">Press enquiry</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="c-msg">Message</label>
                <textarea
                  id="c-msg"
                  rows={6}
                  required
                  minLength={10}
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                />
              </div>

              <div style={{ marginTop: 12, marginBottom: 12, fontSize: "0.85rem", lineHeight: 1.4 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    required
                  />
                  <span>
                    I&apos;ve read the{" "}
                    <Link href="/privacy" target="_blank">privacy notice</Link>{" "}
                    and accept it. <span style={{ color: "#b94a3e" }}>*</span>
                  </span>
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                  />
                  <span>Send me NURA news and shade drops.</span>
                </label>
              </div>

              {error && (
                <div
                  role="alert"
                  style={{
                    background: "#fdecea",
                    border: "1px solid #f5b5b0",
                    color: "#8a1c13",
                    padding: 12,
                    borderRadius: "var(--radius-sm)",
                    marginBottom: 12,
                    fontSize: "0.9rem",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending || !termsAccepted}
              >
                {sending ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>

        <div>
          <h2>FAQ</h2>
          <details className="accordion-item" open>
            <summary className="accordion-q">Where do you ship?</summary>
            <p className="accordion-a">
              Currently UK only. Standard delivery is 3–5 working days; express
              1–2 days.
            </p>
          </details>
          <details className="accordion-item">
            <summary className="accordion-q">
              Is the packaging halal-compliant?
            </summary>
            <p className="accordion-a">
              Yes — no leather and no animal-derived adhesives. Fully
              recyclable where local services support it.
            </p>
          </details>
          <details className="accordion-item">
            <summary className="accordion-q">
              Can I wear NURA during Hajj or Umrah?
            </summary>
            <p className="accordion-a">
              Products marked with the &ldquo;Hajj &amp; Umrah&rdquo; badge are
              fragrance-free and alcohol-free, making them permissible during
              ihram. See our <a href="/halal">halal assurance page</a>.
            </p>
          </details>
          <details className="accordion-item">
            <summary className="accordion-q">How do I return an item?</summary>
            <p className="accordion-a">
              Email us within 14 days of receipt, unopened. We&apos;ll send a
              prepaid label.
            </p>
          </details>
          <details className="accordion-item">
            <summary className="accordion-q">
              Do the virtual try-on photos get uploaded?
            </summary>
            <p className="accordion-a">
              No. Everything runs in your browser — no media leaves your
              device.
            </p>
          </details>
          <details className="accordion-item">
            <summary className="accordion-q">How do I request MSDS?</summary>
            <p className="accordion-a">
              Use the contact form with &ldquo;Request MSDS&rdquo; selected.
              We&apos;ll email you the full documentation.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
