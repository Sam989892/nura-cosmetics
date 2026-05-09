import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="nav-logo" style={{ color: "var(--nura-gold)" }}>NURA<span style={{ color: "var(--nura-rose-soft)" }}>.</span></div>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,0.75)", fontSize: "0.9rem" }}>
              Halal beauty. Real you. UK-based, MUI Halal certified, wudu-friendly formulations —
              the official UK partner of Wardah by Paragon Technology and Innovation.
            </p>
          </div>
          <div>
            <h4>Shop</h4>
            <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
              <li><Link href="/shop?category=lips">Lips</Link></li>
              <li><Link href="/shop?category=nails">Nails</Link></li>
              <li><Link href="/shop?category=face">Face</Link></li>
              <li><Link href="/shop?category=eyes">Eyes</Link></li>
            </ul>
          </div>
          <div>
            <h4>Brand</h4>
            <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
              <li><Link href="/about">About NURA</Link></li>
              <li><Link href="/halal">Halal Assurance</Link></li>
              <li><Link href="/try-on">Virtual Try-On</Link></li>
              <li><Link href="/contact">Contact & FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4>Customer</h4>
            <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
              <li><Link href="/cart">Cart</Link></li>
              <li><Link href="/contact">Delivery (UK)</Link></li>
              <li><Link href="/contact">Returns</Link></li>
              <li><Link href="/contact">MSDS Request</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© {new Date().getFullYear()} NURA Cosmetics Ltd, United Kingdom</div>
          <div>MUI Halal Certified · Wudu-Friendly · Ethically Sourced</div>
        </div>
      </div>
    </footer>
  );
}
