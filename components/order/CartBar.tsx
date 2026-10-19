"use client";

import Link from "next/link";
import { useMemo } from "react";
import { currency, type MenuCategory } from "@/data/menu";
import { formatAmount } from "@/lib/format";
import { href, t, type Lang } from "@/lib/i18n";
import { menuItems, priceLine } from "@/lib/orders-core";
import { useCart, type OrderingConfig } from "./cart";

/** "3 items · 1,200,000 L.L → View your order", floating at the bottom while the cart has something. */
export function CartBar({ menu, lang, ordering, phoneBar }: { menu: MenuCategory[]; lang: Lang; ordering: OrderingConfig | null; phoneBar: boolean }) {
  const d = t(lang).order;
  const lines = useCart();
  const items = useMemo(() => menuItems(menu), [menu]);
  const priced = lines.map((l) => priceLine(items, l)).filter((l) => l !== null);
  if (!ordering?.enabled || !priced.length) return null;
  const count = priced.reduce((n, l) => n + l.qty, 0);
  const total = priced.reduce((n, l) => n + l.total, 0);
  return (
    <>
      <div className="h-24 print:hidden" aria-hidden />
      <Link
        href={href(lang, "/order")}
        className={`cart-bar fixed inset-x-4 z-40 mx-auto flex min-h-14 max-w-xl items-center justify-between gap-3 rounded-full bg-espresso px-6 text-on-espresso shadow-lift print:hidden ${
          phoneBar ? "bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="grid size-7 place-items-center rounded-full bg-crema text-sm font-semibold text-espresso tabular-nums">
            {count}
          </span>
          <span className="font-medium">{d.viewOrder}</span>
        </span>
        <span className="tabular-nums" dir="ltr">
          {formatAmount(total)} {lang === "ar" ? currency.labelAr : currency.label}
        </span>
      </Link>
    </>
  );
}
