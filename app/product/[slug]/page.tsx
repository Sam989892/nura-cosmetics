"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getProduct } from "@/data/products";
import { useCart } from "@/lib/cart";
import { notFound } from "next/navigation";

export default function ProductPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const product = getProduct(slug);
  const { add } = useCart();
  const [shadeIdx, setShadeIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    notFound();
  }
  const shade = product.shades[shadeIdx];

  function onAdd() {
    if (!product) return;
    add({
      slug: product.slug,
      name: product.name,
      shadeName: shade.name,
      shadeHex: shade.hex,
      price: product.price,
      qty
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2400);
  }

  return (
    <div className="container">
      <nav aria-label="Breadcrumb" style={{ fontSize: "0.85rem", color: "var(--nura-mute)", padding: "20px 0" }}>
        <Link href="/">Home</Link> · <Link href="/shop">Shop</Link> · <span>{product.name}</span>
      </nav>

      <div className="pdp">
        <div>
          <div
            className="pdp-gallery"
            aria-label={`${product.name} in ${shade.name}`}
            style={{
              background: `linear-gradient(135deg, ${shade.hex}55 0%, var(--nura-cream) 100%)`,
              transition: "background 0.3s ease"
            }}
          >
            {product.image ? (
              <Image src={product.image} alt={`${product.name} pack shot`} fill sizes="(max-width: 900px) 100vw, 50vw" />
            ) : null}
          </div>
        </div>

        <div className="pdp-info">
          <div className="pdp-meta">
            {product.halalCertified && <span className="badge badge-halal">MUI Halal Certified</span>}
            {product.wuduFriendly && <span className="badge badge-wudu">Wudu-friendly</span>}
            {product.hajjUmrah && <span className="badge">Permissible for Hajj & Umrah</span>}
            {product.iconLabel && <span className="badge">{product.iconLabel.replace("-", " ")}</span>}
          </div>
          <h1>{product.name}</h1>
          <p className="text-mute">{product.subtitle}</p>
          <div className="pdp-price">£{product.price.toFixed(2)}</div>
          <p>{product.description}</p>
          {product.sourceTags && product.sourceTags.length > 0 && (
            <div className="pdp-source-tags">
              {product.sourceTags.slice(0, 3).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}

          <div className="pdp-section">
            <strong>Shade: {shade.name}</strong>
            {shade.finish && <span className="text-mute" style={{ marginLeft: 8 }}>· {shade.finish}</span>}
            <div className="swatch-row" style={{ marginTop: 12 }} role="radiogroup" aria-label="Choose a shade">
              {product.shades.map((s, i) => (
                <button
                  key={s.name}
                  className={`swatch ${i === shadeIdx ? "active" : ""}`}
                  style={{ backgroundColor: s.hex, border: "2px solid #fff" }}
                  onClick={() => setShadeIdx(i)}
                  aria-label={`Select ${s.name}`}
                  aria-pressed={i === shadeIdx}
                  title={s.name}
                />
              ))}
            </div>
          </div>

          <div className="pdp-section">
            <div className="pdp-cta-row">
              <div className="qty-selector" aria-label="Quantity">
                <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity">−</button>
                <input value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} aria-label="Quantity" />
                <button onClick={() => setQty(qty + 1)} aria-label="Increase quantity">+</button>
              </div>
              <button className="btn btn-primary" onClick={onAdd}>
                {added ? "✓ Added" : "Add to Cart"}
              </button>
              <Link href={`/try-on?product=${product.slug}&shade=${encodeURIComponent(shade.name)}`} className="btn btn-gold">
                Try This Shade on Your Photo
              </Link>
            </div>
          </div>

          <details className="accordion-item">
            <summary className="accordion-q">Ingredients</summary>
            <p className="accordion-a">{product.ingredients}</p>
          </details>
          <details className="accordion-item">
            <summary className="accordion-q">Halal Assurance</summary>
            <p className="accordion-a">
              MUI Halal certified through Wardah by Paragon Technology and Innovation.
              UK Halal validation in progress with HMC/HFA.
              {product.wuduFriendly && " This formula is wudu-friendly — water can pass through during ablution."}
              {product.hajjUmrah && " Suitable for Hajj and Umrah: fragrance-free and alcohol-free."}
              {" "}<Link href="/halal">Read full halal assurance →</Link>
            </p>
          </details>
          <details className="accordion-item">
            <summary className="accordion-q">Delivery & Returns</summary>
            <p className="accordion-a">
              Free UK delivery on orders over £40. Standard delivery 3–5 working days.
              Returns accepted within 14 days, unopened.
            </p>
          </details>
          <details className="accordion-item">
            <summary className="accordion-q">Checkout status</summary>
            <p className="accordion-a">
              Checkout currently uses a simulated payment capture for pre-launch QA. Orders are not charged in this environment.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
