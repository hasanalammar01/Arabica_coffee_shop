"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuCategory, MenuItem, Tag } from "@/data/menu";
import { DrinkCard } from "./DrinkCard";
import { Price } from "./Price";

const TAG_LABELS: Record<Tag, string> = {
  vegan: "Vegan",
  "gluten-free": "Gluten-free",
  spicy: "Spicy",
  new: "New",
  bestseller: "Bestseller",
};

const hasImage = (i: MenuItem): i is MenuItem & { image: string } => Boolean(i.image);

export function MenuBrowser({ menu }: { menu: MenuCategory[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<Tag | null>(null);
  const [active, setActive] = useState(menu[0]?.id);
  const bar = useRef<HTMLUListElement>(null);

  // Dietary filter only appears once the menu actually has tags.
  const tags = useMemo(() => [...new Set(menu.flatMap((c) => c.items.flatMap((i) => i.tags ?? [])))], [menu]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      menu
        .map((c) => ({
          ...c,
          items: c.items.filter(
            (i) =>
              (!tag || i.tags?.includes(tag)) &&
              (!q ||
                [c.name, i.name, i.description, ...(i.options ?? [])].some((s) =>
                  s?.toLowerCase().includes(q),
                )),
          ),
        }))
        .filter((c) => c.items.length),
    [menu, q, tag],
  );
  const visibleIds = visible.map((c) => c.id).join();

  // Scroll-spy: highlight the category currently under the sticky bar.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-25% 0px -70% 0px" },
    );
    const sections = document.querySelectorAll("[data-menu-section]");
    sections.forEach((s) => observer.observe(s));
    // The last section is often too short to reach the trigger line; activate it at the page bottom.
    const onScroll = () => {
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && sections.length) setActive(sections[sections.length - 1].id);
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      removeEventListener("scroll", onScroll);
    };
  }, [visibleIds]);

  // Keep the active chip in view inside the horizontal bar.
  useEffect(() => {
    const chip = bar.current?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (chip && bar.current)
      bar.current.scrollTo({
        left: chip.offsetLeft - (bar.current.clientWidth - chip.offsetWidth) / 2,
        behavior: "smooth",
      });
  }, [active]);

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 print:hidden">
        <label htmlFor="menu-search" className="sr-only">
          Search the menu
        </label>
        <input
          id="menu-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: latte, mango, labneh…"
          autoComplete="off"
          className="h-12 w-full rounded-full border border-line bg-surface px-5 text-base placeholder:text-muted focus:border-ink sm:max-w-sm"
        />
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
                className="min-h-11 rounded-full border border-line px-4 text-sm aria-pressed:border-espresso aria-pressed:bg-espresso aria-pressed:text-on-espresso"
              >
                {TAG_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav
        aria-label="Menu categories"
        className="sticky top-0 z-20 mt-6 border-b border-line bg-paper/90 backdrop-blur-md print:hidden"
      >
        <ul ref={bar} className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 sm:px-5">
          {visible.map((c) => (
            <li key={c.id} className="shrink-0">
              <a
                href={`#${c.id}`}
                data-chip={c.id}
                aria-current={active === c.id ? "true" : undefined}
                className="flex min-h-11 items-center rounded-full px-4 whitespace-nowrap text-muted transition-colors hover:text-ink aria-[current=true]:bg-espresso aria-[current=true]:text-on-espresso"
              >
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {visible.length === 0 && (
          <div className="py-20 text-center" role="status">
            <p className="font-display text-2xl">Nothing matches “{query.trim() || TAG_LABELS[tag!]}”.</p>
            <button
              type="button"
              onClick={() => (setQuery(""), setTag(null))}
              className="mt-6 min-h-11 rounded-full bg-espresso px-6 text-on-espresso"
            >
              Show the full menu
            </button>
          </div>
        )}

        {visible.map((c, ci) => {
          const photos = c.items.filter(hasImage);
          const rows = c.items.filter((i) => !i.image && !i.addon);
          const addons = c.items.filter((i) => i.addon);
          return (
            <section
              key={c.id}
              id={c.id}
              data-menu-section
              aria-labelledby={`${c.id}-title`}
              className="scroll-mt-20 break-inside-avoid-page pt-14"
            >
              <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
                <h2 id={`${c.id}-title`} className="font-display text-title">
                  {c.name}
                </h2>
                <span className="text-sm text-muted">
                  {c.items.length} {c.items.length === 1 ? "item" : "items"}
                </span>
              </div>

              {photos.length > 0 && (
                <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-5 print:grid-cols-4">
                  {photos.map((i, ii) => (
                    <DrinkCard key={i.id} item={i} priority={ci === 0 && ii < 2} />
                  ))}
                </div>
              )}

              {rows.length > 0 && (
                <ul className="mt-6 lg:columns-2 lg:gap-x-16">
                  {rows.map((i) => (
                    <MenuRow key={i.id} item={i} />
                  ))}
                </ul>
              )}

              {addons.length > 0 && (
                <ul className="mt-2 border-t border-dashed border-line pt-2 text-sm text-muted lg:w-1/2 lg:pr-8">
                  {addons.map((i) => (
                    <MenuRow key={i.id} item={i} small />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function MenuRow({ item, small = false }: { item: MenuItem; small?: boolean }) {
  return (
    <li className={`break-inside-avoid ${small ? "py-2" : "py-3"}`}>
      <div className="flex items-baseline gap-3">
        <h3 className={`min-w-0 ${small ? "" : "text-[1.0625rem] font-medium"}`}>{item.name}</h3>
        <span className="leader" aria-hidden />
        <Price prices={item.prices} />
      </div>
      {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
      {item.options && <p className="mt-1 text-sm text-muted">{item.options.join(" · ")}</p>}
      {item.tags && item.tags.length > 0 && (
        <ul className="mt-2 flex gap-1.5" aria-label="Tags">
          {item.tags.map((t) => (
            <li
              key={t}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                t === "new" ? "bg-pomegranate/12 text-pomegranate" : "bg-surface text-caramel"
              }`}
            >
              {TAG_LABELS[t]}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
