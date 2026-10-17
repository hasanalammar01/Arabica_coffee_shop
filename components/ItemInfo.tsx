import type { ReactNode } from "react";
import type { MenuItem } from "@/data/menu";
import { pick, t, type Lang } from "@/lib/i18n";
import { ItemDisclosure } from "./ItemDisclosure";

export { ItemInfoGroup } from "./ItemDisclosure";

/** Owner-supplied details only; null when staff haven't added any. */
export function itemDetails(item: MenuItem, lang: Lang) {
  const d = t(lang);
  const description = pick(lang, item.description ?? "", item.descriptionAr).trim();
  const ingredients = pick(lang, item.ingredients ?? "", item.ingredientsAr).trim();
  const allergens = item.allergens ?? [];
  const options = (item.options ?? []).map((o, i) => pick(lang, o, item.optionsAr?.[i]));
  if (!description && !options.length && !ingredients && !allergens.length) return null;
  return (
    <>
      {description && (
        <p dir="auto" className="[overflow-wrap:anywhere]">
          {description}
        </p>
      )}
      {options.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-ink">{d.menu.options}</p>
          <ul className="space-y-0.5">
            {options.map((o) => (
              <li key={o} dir="auto" className="[overflow-wrap:anywhere]">
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ingredients && (
        <p className="[overflow-wrap:anywhere]">
          <span className="mb-1 block font-medium text-ink">{d.menu.ingredients}</span>
          <span dir="auto">{ingredients}</span>
        </p>
      )}
      {allergens.length > 0 && (
        <div>
          <p className="mb-1.5 font-medium text-ink">{d.menu.allergens}</p>
          <ul className="flex flex-wrap gap-1.5" aria-label={d.menu.allergens}>
            {allergens.map((allergen) => (
              <li
                key={allergen}
                className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-medium text-ink"
              >
                {d.allergens[allergen]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Wraps a menu item. If it has details (what's in it, ingredients, allergens), tapping
 * the item opens a small panel underneath; tapping again closes it.
 */
export function ItemInfo({
  itemId,
  label,
  details,
  className = "",
  children,
}: {
  itemId: string;
  label: string;
  details: ReactNode | null;
  className?: string;
  children: ReactNode;
}) {
  if (!details) return <div className={className}>{children}</div>;
  return (
    <ItemDisclosure itemId={itemId} label={label} details={details} className={className}>
      {children}
    </ItemDisclosure>
  );
}

/** A quiet, localized tap hint; the information glyph pulses only on its first view. */
export function InfoHint({ lang }: { lang: Lang }) {
  return (
    <span
      className="item-info-hint mt-2 flex items-center gap-1.5 text-xs font-medium text-caramel print:hidden"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        className="item-info-icon size-3.5 shrink-0"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5m0-8h.01" />
      </svg>
      {t(lang).menu.details}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="item-info-chevron size-3.5 shrink-0"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
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
