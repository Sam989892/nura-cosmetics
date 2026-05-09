"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="nav-logo" aria-label="NURA Cosmetics home">
          NURA<span>.</span>
        </Link>
        <button className="nav-toggle" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          ☰
        </button>
        <ul className={`nav-links ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
          <li><Link href="/shop">Shop</Link></li>
          <li><Link href="/try-on">Try-On Studio</Link></li>
          <li><Link href="/checkout">Checkout</Link></li>
          <li><Link href="/halal">Halal Assurance</Link></li>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/contact">Contact</Link></li>
          <li>
            <Link href="/cart" className="nav-cart">
              Cart
              {count > 0 && <span className="nav-cart-count" aria-label={`${count} items in cart`}>{count}</span>}
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
