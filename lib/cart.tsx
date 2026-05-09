"use client";
// NURA Cart Context — localStorage-backed. Persists across sessions.

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type CartItem = {
  slug: string;
  name: string;
  shadeName: string;
  shadeHex: string;
  price: number;
  qty: number;
};

type CartState = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (slug: string, shadeName: string) => void;
  setQty: (slug: string, shadeName: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = "nura_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items, hydrated]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.slug === item.slug && x.shadeName === item.shadeName);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + item.qty };
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const remove = useCallback((slug: string, shadeName: string) => {
    setItems((prev) => prev.filter((x) => !(x.slug === slug && x.shadeName === shadeName)));
  }, []);

  const setQty = useCallback((slug: string, shadeName: string, qty: number) => {
    setItems((prev) => prev.map((x) =>
      x.slug === slug && x.shadeName === shadeName ? { ...x, qty: Math.max(1, qty) } : x
    ));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, setQty, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
