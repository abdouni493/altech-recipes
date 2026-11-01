"use client";
// Website order basket, kept in the visitor's browser between the shop, recipe and order pages.
import { useCallback, useEffect, useState } from "react";

export type CartItemType = "RECIPE" | "PACK" | "PRODUCT";
/** `tierId`: a product quantity offer (e.g. 5 kg); `quantity` then counts offers. */
export type CartItem = { type: CartItemType; id: string; quantity: number; tierId?: string | null };

const KEY = "altech-order-cart";
const EVENT = "altech-cart-change";

export const sameLine = (a: Pick<CartItem, "type" | "id" | "tierId">, b: Pick<CartItem, "type" | "id" | "tierId">) =>
  a.type === b.type && a.id === b.id && (a.tierId ?? null) === (b.tierId ?? null);

function read(): CartItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((i) => i && typeof i.id === "string" && ["RECIPE", "PACK", "PRODUCT"].includes(i.type)) : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable: the basket only lives in memory */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useSiteCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const set = useCallback((next: CartItem[]) => { setItems(next); write(next); }, []);
  const add = useCallback((type: CartItemType, id: string, quantity = 1, tierId: string | null = null) => {
    const cur = read();
    const line = { type, id, tierId };
    const i = cur.findIndex((x) => sameLine(x, line));
    const next = i >= 0 ? cur.map((x, j) => (j === i ? { ...x, quantity: x.quantity + quantity } : x)) : [...cur, { ...line, quantity }];
    set(next);
  }, [set]);
  return { items, set, add, clear: () => set([]) };
}
