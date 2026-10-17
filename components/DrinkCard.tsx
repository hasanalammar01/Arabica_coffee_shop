import Image from "next/image";
import type { ReactNode } from "react";
import type { MenuItem } from "@/data/menu";
import { pick, t, type Lang } from "@/lib/i18n";
import { InfoHint, ItemInfo, itemDetails, SoldOut } from "./ItemInfo";
import { Price } from "./Price";

/**
 * Photo item: the cut-out photo stands on a cement-tile panel, like the cards in the printed menu.
 * Phones get a compact row (thumbnail + text) so prices stay scannable; wider screens get a tall card.
 * If the item has details, tapping it opens a small tab underneath. `action` is the order button.
 */
export function DrinkCard({
  item,
  lang,
  priority = false,
  action,
}: {
  item: MenuItem & { image: string };
  lang: Lang;
  priority?: boolean;
  action?: ReactNode;
}) {
  const details = itemDetails(item, lang);
  const soldOut = item.availability === "soldout";
  const name = pick(lang, item.name, item.nameAr);
  return (
    <article className={`group ${soldOut ? "opacity-60" : ""}`}>
      <ItemInfo
        itemId={item.id}
        label={`${name}: ${t(lang).menu.details}`}
        details={details}
        className="-m-1.5 p-1.5"
      >
        <div className="flex items-center gap-4 sm:block">
          <div className="tile relative aspect-square w-22 shrink-0 overflow-hidden rounded-2xl shadow-lift sm:aspect-[4/5] sm:w-auto sm:rounded-card">
            <Image
              src={item.image}
              alt={name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 88px"
              className={`drink-photo object-contain object-bottom px-[12%] pt-[12%] pb-[6%] drop-shadow-[0_10px_10px_rgb(0_0_0/0.35)] sm:pb-[8%] ${soldOut ? "grayscale" : ""}`}
            />
          </div>
          <div className="min-w-0 flex-1 sm:mt-3">
            <div className="flex items-baseline gap-3 sm:block">
              <h3 className="min-w-0 text-[1.0625rem] leading-snug font-medium">
                {name}
                {soldOut && <SoldOut lang={lang} />}
              </h3>
              <span className="leader sm:hidden" aria-hidden />
              <Price prices={item.prices} sizesAr={item.sizesAr} lang={lang} className="sm:text-muted" />
            </div>
            {item.options && (
              <p className="mt-1 text-sm text-muted">
                {item.options.map((o, i) => pick(lang, o, item.optionsAr?.[i])).join(" · ")}
              </p>
            )}
            {details && <InfoHint lang={lang} />}
          </div>
        </div>
      </ItemInfo>
      {action}
    </article>
  );
}
