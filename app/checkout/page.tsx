"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";

type Delivery = "standard" | "express" | "collect";

const SHIPPING_COSTS: Record<Delivery, number> = {
  standard: 3.95,
  express: 6.95,
  collect: 0,
};

const FREE_THRESHOLD = 40;

function computeShipping(subtotal: number, delivery: Delivery) {
  if (delivery === "collect") return 0;
  if (delivery === "standard" && subtotal >= FREE_THRESHOLD) return 0;
  return SHIPPING_COSTS[delivery];
}

export default function CheckoutPage() {
  const { items, total, clear } = useCart();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    postcode: "",
    delivery: "standard" as Delivery,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    orderId: string;
    eta: string;
    grandTotal: number;
  } | null>(null);

  const shipping = useMemo(
    () => computeShipping(total, form.delivery),
    [total, form.delivery]
  );
  const grand = total + shipping;

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            address1: form.address1,
            address2: form.address2,
            city: form.city,
            postcode: form.postcode,
          },
          delivery: form.delivery,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Checkout failed. Please try again.");
      }

      setReceipt({
        orderId: data.orderId,
        eta: data.eta,
        grandTotal: data.grandTotal,
      });
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <div
        className="container section text-center"
        style={{ paddingTop: 80, maxWidth: 640 }}
      >
        <div style={{ fontSize: "3rem", marginBottom: 12 }}>✦</div>
        <h1>Thank you, {form.name.split(" ")[0] || "friend"}.</h1>
        <p className="text-mute">
          Order <strong>{receipt.orderId}</strong> confirmed. A receipt is on
          its way to <strong>{form.email}</strong>.
        </p>
        <div
          style={{
            background: "var(--nura-cream)",
            border: "1px solid var(--nura-gold)",
            padding: 20,
            borderRadius: "var(--radius-md)",
            margin: "24px auto",
            maxWidth: 480,
          }}
        >
          <strong style={{ color: "var(--nura-gold-deep)" }}>
            Halal-certified and ethically sourced.
          </strong>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "0.9rem",
              color: "var(--nura-mute)",
            }}
          >
            Estimated delivery: {receipt.eta} · Paid £
            {receipt.grandTotal.toFixed(2)}
          </p>
        </div>
        <Link href="/shop" className="btn btn-primary">
          Continue shopping
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container section text-center">
        <h1>No items to checkout</h1>
        <Link href="/shop" className="btn btn-primary">
          Shop the Edit
        </Link>
      </div>
    );
  }

  const standardLabel =
    total >= FREE_THRESHOLD ? "Free" : `£${SHIPPING_COSTS.standard.toFixed(2)}`;

  return (
    <div className="container section">
      <h1>Checkout</h1>
      <p className="text-mute" style={{ marginTop: -6 }}>
        Checkout is streamlined for speed. Payment is currently simulated for pre-launch testing, and no live charge is captured.
      </p>
      <div className="cart-layout">
        <form onSubmit={onSubmit} aria-label="Checkout form" noValidate>
          <h3>Contact</h3>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                name="name"
                required
                autoComplete="name"
                value={form.name}
                onChange={onChange}
              />
            </div>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={onChange}
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="phone">Phone (for delivery updates)</label>
            <input
              id="phone"
              name="phone"
              type="tel"
                pattern="^[0-9+()\\-\\s]{7,20}$"
              autoComplete="tel"
              value={form.phone}
              onChange={onChange}
            />
          </div>

          <h3 style={{ marginTop: 24 }}>UK Delivery Address</h3>
          <div className="form-field">
            <label htmlFor="address1">Address line 1</label>
            <input
              id="address1"
              name="address1"
              required
              autoComplete="address-line1"
              value={form.address1}
              onChange={onChange}
            />
          </div>
          <div className="form-field">
            <label htmlFor="address2">Address line 2 (optional)</label>
            <input
              id="address2"
              name="address2"
              autoComplete="address-line2"
              value={form.address2}
              onChange={onChange}
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                required
                autoComplete="address-level2"
                value={form.city}
                onChange={onChange}
              />
            </div>
            <div className="form-field">
              <label htmlFor="postcode">Postcode</label>
              <input
                id="postcode"
                name="postcode"
                required
                pattern="^[A-Za-z0-9\\s-]{4,10}$"
                autoComplete="postal-code"
                value={form.postcode}
                onChange={onChange}
                placeholder="e.g. SW1A 1AA"
              />
            </div>
          </div>

          <h3 style={{ marginTop: 24 }}>Delivery preference</h3>
          <div className="form-field">
            <label htmlFor="delivery">Option</label>
            <select
              id="delivery"
              name="delivery"
              value={form.delivery}
              onChange={onChange}
            >
              <option value="standard">
                Standard (3–5 working days) — {standardLabel}
              </option>
              <option value="express">
                Express (1–2 working days) — £
                {SHIPPING_COSTS.express.toFixed(2)}
              </option>
              <option value="collect">
                Click &amp; Collect (London only) — Free
              </option>
            </select>
          </div>

          <div
            style={{
              background: "var(--nura-cream)",
              padding: 16,
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--nura-gold)",
              margin: "24px 0",
              fontSize: "0.85rem",
              color: "var(--nura-mute)",
            }}
          >
            <strong>Payment:</strong> Stripe integration ready. This build runs
            a simulated capture through <code>/api/checkout</code>. Add{" "}
            <code>STRIPE_SECRET_KEY</code> and swap the route body to{" "}
            <code>stripe.checkout.sessions.create</code> to go live.
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
                marginBottom: 16,
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={submitting}
          >
            {submitting
              ? "Placing order…"
              : `Place Order — £${grand.toFixed(2)}`}
          </button>
        </form>

        <aside className="cart-summary">
          <h3>Order Summary</h3>
          {items.map((it) => (
            <div
              key={`${it.slug}-${it.shadeName}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.9rem",
                padding: "6px 0",
              }}
            >
              <span>
                {it.name}{" "}
                <span className="text-mute">
                  — {it.shadeName} × {it.qty}
                </span>
              </span>
              <span>£{(it.price * it.qty).toFixed(2)}</span>
            </div>
          ))}
          <hr
            style={{
              border: 0,
              borderTop: "1px solid var(--nura-line)",
              margin: "12px 0",
            }}
          />
          <div
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <span>Subtotal</span>
            <span>£{total.toFixed(2)}</span>
          </div>
          <div
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <span>Shipping</span>
            <span>
              {shipping === 0 ? "Free" : `£${shipping.toFixed(2)}`}
            </span>
          </div>
          <hr
            style={{
              border: 0,
              borderTop: "1px solid var(--nura-line)",
              margin: "12px 0",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 600,
            }}
          >
            <span>Total</span>
            <span>£{grand.toFixed(2)}</span>
          </div>
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#efe5d1",
              borderRadius: 6,
              fontSize: "0.8rem",
            }}
          >
            ✦ Every item MUI halal certified and ethically sourced.
          </div>
        </aside>
      </div>
    </div>
  );
}
