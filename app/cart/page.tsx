"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart";

export default function CartPage() {
  const { items, setQty, remove, total } = useCart();
  const shipping = total >= 40 ? 0 : total > 0 ? 3.95 : 0;
  const grand = total + shipping;

  if (items.length === 0) {
    return (
      <div className="container section text-center" style={{ paddingTop: 80 }}>
        <h1>Your bag is empty.</h1>
        <p className="text-mute">Add a shade you love — or try a few on first.</p>
        <div style={{ display: "inline-flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <Link href="/shop" className="btn btn-primary">Shop the Edit</Link>
          <Link href="/try-on" className="btn btn-ghost">Virtual Try-On</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <h1>Your Bag</h1>
      <p className="text-mute">Review your shades, then continue to secure checkout. All items are dispatched from the UK.</p>

      <div className="cart-layout" style={{ marginTop: 24 }}>
        <div>
          {items.map((it) => (
            <div className="cart-row" key={`${it.slug}-${it.shadeName}`}>
              <div className="cart-row-image" style={{ background: `linear-gradient(135deg, ${it.shadeHex} 0%, var(--nura-cream) 100%)` }} aria-hidden />
              <div>
                <strong>{it.name}</strong>
                <div className="text-mute" style={{ fontSize: "0.85rem" }}>Shade: {it.shadeName}</div>
              </div>
              <div className="qty-selector" aria-label={`Quantity for ${it.name}`}>
                <button onClick={() => setQty(it.slug, it.shadeName, it.qty - 1)} aria-label="Decrease">−</button>
                <input value={it.qty} onChange={(e) => setQty(it.slug, it.shadeName, parseInt(e.target.value) || 1)} aria-label="Quantity" />
                <button onClick={() => setQty(it.slug, it.shadeName, it.qty + 1)} aria-label="Increase">+</button>
              </div>
              <div style={{ textAlign: "right", fontWeight: 500 }}>£{(it.price * it.qty).toFixed(2)}</div>
              <button
                onClick={() => remove(it.slug, it.shadeName)}
                aria-label={`Remove ${it.name}`}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--nura-mute)", fontSize: "1.2rem" }}
              >×</button>
            </div>
          ))}
          <Link href="/shop" className="btn btn-ghost" style={{ marginTop: 20 }}>← Continue shopping</Link>
        </div>

        <aside className="cart-summary" aria-label="Order summary">
          <h3 style={{ margin: "0 0 12px" }}>Order Summary</h3>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
            <span>Subtotal</span><span>£{total.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
            <span>UK delivery</span>
            <span>{shipping === 0 ? "Free" : `£${shipping.toFixed(2)}`}</span>
          </div>
          {shipping === 0 && <p className="text-mute" style={{ fontSize: "0.8rem", margin: "8px 0" }}>Free delivery unlocked</p>}
          <hr style={{ border: 0, borderTop: "1px solid var(--nura-line)", margin: "12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: "1.1rem" }}>
            <span>Total</span><span>£{grand.toFixed(2)}</span>
          </div>
          <Link href="/checkout" className="btn btn-primary" style={{ width: "100%", marginTop: 16 }}>
            Continue to Checkout
          </Link>
          <div style={{ marginTop: 12, textAlign: "center", fontSize: "0.8rem", color: "var(--nura-mute)" }}>
            <span className="badge badge-halal" style={{ marginRight: 6 }}>✦ Halal</span>
            <span className="badge badge-wudu">✓ Wudu-friendly</span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--nura-mute)", marginTop: 12 }}>
            Estimated delivery: 3–5 working days. UK only initially.
          </p>
        </aside>
      </div>
    </div>
  );
}
