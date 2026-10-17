import type { ReactNode } from "react";
import type { MenuItem } from "@/data/menu";
import { pick, t, type Lang } from "@/lib/i18n";

/** Description, ingredients and allergens for the tab; null when staff haven't added any. */
export function itemDetails(item: MenuItem, lang: Lang) {
  const d = t(lang);
  const description = pick(lang, item.description ?? "", item.descriptionAr);
  const ingredients = pick(lang, item.ingredients ?? "", item.ingredientsAr);
  const allergens = item.allergens?.map((a) => d.allergens[a]).join(lang === "ar" ? "، " : ", ");
  if (!description && !ingredients && !allergens) return null;
  return (
    <>
      {description && <span className="block">{description}</span>}
      {ingredients && (
        <span className="mt-1.5 block">
          <span className="font-medium text-ink">{d.menu.ingredients}: </span>
          {ingredients}
        </span>
      )}
      {allergens && (
        <span className="mt-1.5 block">
          <span className="font-medium text-ink">{d.menu.allergens}: </span>
          {allergens}
        </span>
      )}
    </>
  );
}

/**
 * Wraps a menu item. If it has details (what's in it, ingredients, allergens), tapping
 * the item opens a small tab underneath; tapping again closes it. Native <details>, so
 * it works with keyboard and screen readers and without JavaScript.
 */
export function ItemInfo({
  details,
  className = "",
  children,
}: {
  details: ReactNode | null;
  className?: string;
  children: ReactNode;
}) {
  if (!details) return <div className={className}>{children}</div>;
  return (
    <details className="group/info">
      <summary
        className={`block cursor-pointer list-none rounded-xl transition-colors hover:bg-surface/70 [&::-webkit-details-marker]:hidden ${className}`}
      >
        {children}
      </summary>
      <p className="relative mt-2.5 mb-2 animate-tab rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-muted shadow-lift ring-1 ring-line before:absolute before:start-5 before:-top-[7px] before:size-3 before:rotate-45 before:border-t before:border-l before:border-line before:bg-surface">
        {details}
      </p>
    </details>
  );
}

/** Small arrow after an item's name, showing it can be opened. Turns when open. */
export function InfoArrow() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ms-1.5 inline-block size-4 align-[-3px] text-muted transition-transform duration-200 group-open/info:rotate-180 print:hidden"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** "Sold out" badge. */
export function SoldOut({ lang }: { lang: Lang }) {
  return (
    <span className="ms-2 inline-block rounded-full bg-pomegranate/12 px-2 py-0.5 align-middle text-xs font-medium text-pomegranate">
      {t(lang).menu.soldOut}
    </span>
  );
}
