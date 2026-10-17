"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MAX_QTY, type CartLine, type PublicPayment } from "@/lib/orders-core";

/* ---------- The cart: kept in this browser so it survives a reload ---------- */

const KEY = "arabica-cart";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let lines: CartLine[] | null = null;

function read(): CartLine[] {
  if (lines) return lines;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    lines = Array.isArray(stored) ? stored : EMPTY;
  } catch {
    lines = EMPTY;
  }
  return lines;
}

function write(next: CartLine[]) {
  lines = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage blocked: the cart still works until the page closes.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the cart.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    lines = null;
    listener();
  };
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

export const useCart = () => useSyncExternalStore(subscribe, read, () => EMPTY);

const sameChoice = (a: CartLine, b: CartLine) =>
  a.id === b.id && a.size === b.size && a.option === b.option && [...a.mods].sort().join() === [...b.mods].sort().join();

export const cart = {
  /** Adds a line, or raises the quantity of the same item with the same choices. */
  add(line: CartLine) {
    const current = read();
    const i = current.findIndex((l) => sameChoice(l, line));
    if (i < 0) return write([...current, line]);
    write(current.map((l, j) => (j === i ? { ...l, qty: Math.min(MAX_QTY, l.qty + line.qty) } : l)));
  },
  setQty(index: number, qty: number) {
    const current = read();
    write(qty < 1 ? current.filter((_, i) => i !== index) : current.map((l, i) => (i === index ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)));
  },
  clear: () => write([]),
};

/* ---------- Is ordering on? Asked once per page load ---------- */

export type OrderingConfig = {
  enabled: boolean;
  open: boolean;
  payments: PublicPayment[];
};

let config: Promise<OrderingConfig> | null = null;
const OFF: OrderingConfig = { enabled: false, open: false, payments: [] };

/** null while loading. Ordering stays hidden if the server can't be reached. */
export function useOrdering() {
  const [value, setValue] = useState<OrderingConfig | null>(null);
  useEffect(() => {
    config ??= fetch("/api/orders", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<OrderingConfig>) : OFF))
      .catch(() => OFF);
    config.then(setValue);
  }, []);
  return value;
}
