import Image from "next/image";
import type { MenuItem } from "@/data/menu";
import { InfoArrow, ItemInfo } from "./ItemInfo";
import { Price } from "./Price";

/**
 * Photo item: the cut-out photo stands on a cement-tile panel, like the cards in the printed menu.
 * Phones get a compact row (thumbnail + text) so prices stay scannable; wider screens get a tall card.
 * If the item has a description, tapping it opens a small tab underneath.
 */
export function DrinkCard({
  item,
  priority = false,
}: {
  item: MenuItem & { image: string };
  priority?: boolean;
}) {
  return (
    <article className="group">
      <ItemInfo description={item.description} className="-m-1.5 p-1.5">
        <div className="flex items-center gap-4 sm:block">
          <div className="tile relative aspect-square w-22 shrink-0 overflow-hidden rounded-2xl shadow-lift sm:aspect-[4/5] sm:w-auto sm:rounded-card">
            <Image
              src={item.image}
              alt={item.name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 88px"
              className="object-contain object-bottom px-[12%] pt-[12%] pb-[6%] drop-shadow-[0_10px_10px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-out group-hover:-translate-y-1.5 sm:pb-[8%]"
            />
          </div>
          <div className="min-w-0 flex-1 sm:mt-3">
            <div className="flex items-baseline gap-3 sm:block">
              <h3 className="min-w-0 text-[1.0625rem] leading-snug font-medium">
                {item.name}
                {item.description && <InfoArrow />}
              </h3>
              <span className="leader sm:hidden" aria-hidden />
              <Price prices={item.prices} className="sm:text-muted" />
            </div>
            {item.options && <p className="mt-1 text-sm text-muted">{item.options.join(" · ")}</p>}
          </div>
        </div>
      </ItemInfo>
    </article>
  );
}
