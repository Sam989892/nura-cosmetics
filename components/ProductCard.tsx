import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/data/products";

export default function ProductCard({ product }: { product: Product }) {
  const trustBadges = [
    product.halalCertified ? "Halal Certified" : null,
    product.wuduFriendly ? "Wudu-friendly" : null,
    product.hajjUmrah ? "Hajj and Umrah" : null,
  ].filter(Boolean) as string[];

  return (
    <Link href={`/product/${product.slug}`} className="product-card" aria-label={`View ${product.name}`}>
      <div className="product-card-image" aria-hidden>
        {product.image ? (
          <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 100vw, 280px" />
        ) : (
          <span style={{ opacity: 0.6 }}>{product.name.split(" ").slice(-1)[0]}</span>
        )}
      </div>
      <div className="product-card-body">
        {product.iconLabel && <span className="product-card-kicker">{product.iconLabel.replace("-", " ")}</span>}
        <h3>{product.name}</h3>
        <p className="product-card-desc">{product.subtitle}</p>
        <div className="swatch-row" style={{ marginBottom: 10 }} aria-label="Available shades">
          {product.shades.slice(0, 5).map((s) => (
            <span key={s.name} className="swatch" style={{ backgroundColor: s.hex, width: 22, height: 22 }} title={s.name} />
          ))}
          {product.shades.length > 5 && <span style={{ fontSize: "0.75rem", color: "var(--nura-mute)", alignSelf: "center" }}>+{product.shades.length - 5}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="product-card-price">£{product.price.toFixed(2)}</span>
          <span style={{ fontSize: "0.8rem", color: "var(--nura-rose)" }}>Try it on →</span>
        </div>
        <div className="product-card-badges">
          {trustBadges.map((badge) => <span key={badge} className="badge">{badge}</span>)}
        </div>
      </div>
    </Link>
  );
}
