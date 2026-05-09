"use client";
import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { products, categories, occasions, skinTones } from "@/data/products";

export default function ShopPage() {
  const [cat, setCat] = useState<string | null>(null);
  const [occ, setOcc] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (occ && !p.occasion.includes(occ as any)) return false;
      if (tone) {
        const has = p.shades.some((s) => s.recommendedFor?.includes(tone as any));
        if (!has) return false;
      }
      return true;
    });
  }, [cat, occ, tone]);

  return (
    <div className="container section">
      <div className="ecommerce-path">
        <span>Discover</span>
        <span>Filter</span>
        <span>Try On</span>
        <span>Checkout</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Shop the Edit</h1>
          <p className="text-mute">Find your shade fast with category, occasion, and skin-tone filters, then open try-on from any product card.</p>
        </div>
        <p className="text-mute" style={{ fontSize: "0.9rem" }}>
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="filter-bar" role="region" aria-label="Filter products">
        <div className="filter-group-label">Category</div>
        <button className={`filter-chip ${cat === null ? "active" : ""}`} onClick={() => setCat(null)}>All</button>
        {categories.map((c) => (
          <button key={c.slug} className={`filter-chip ${cat === c.slug ? "active" : ""}`} onClick={() => setCat(c.slug)}>{c.label}</button>
        ))}

        <div className="filter-group-label">Occasion</div>
        <button className={`filter-chip ${occ === null ? "active" : ""}`} onClick={() => setOcc(null)}>Any</button>
        {occasions.map((o) => (
          <button key={o.slug} className={`filter-chip ${occ === o.slug ? "active" : ""}`} onClick={() => setOcc(o.slug)}>{o.label}</button>
        ))}

        <div className="filter-group-label">Skin tone match</div>
        <button className={`filter-chip ${tone === null ? "active" : ""}`} onClick={() => setTone(null)}>Any</button>
        {skinTones.map((t) => (
          <button
            key={t.slug}
            className={`filter-chip ${tone === t.slug ? "active" : ""}`}
            onClick={() => setTone(t.slug)}
            aria-label={`Filter by ${t.label} skin tone`}
          >
            <span style={{
              display: "inline-block", width: 14, height: 14, borderRadius: "50%",
              background: t.hex, marginRight: 6, verticalAlign: "middle",
              border: "1px solid rgba(0,0,0,0.1)"
            }} />
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center" style={{ padding: 64 }}>
          <p className="text-mute">No products match these filters. Try clearing a filter.</p>
          <button className="btn btn-ghost" onClick={() => { setCat(null); setOcc(null); setTone(null); }}>Reset filters</button>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      )}
    </div>
  );
}
