import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DrinkCard } from "@/components/DrinkCard";
import { ItemInfoGroup } from "@/components/ItemInfo";
import { Logo } from "@/components/Logo";
import { Price } from "@/components/Price";
import { Gallery, storyParagraphs } from "@/components/Story";
import { Visit } from "@/components/Visit";
import type { MenuItem } from "@/data/menu";
import { getSite } from "@/lib/site";
import { alternates, href, isLang, pick, t, type Lang } from "@/lib/i18n";
import { getMenu, publicMenu } from "@/lib/menu";
import caramelFrappe from "@/public/menu/caramel-frappe.webp";
import espresso from "@/public/menu/espresso.webp";
import mixBerries from "@/public/menu/smoothie-mix-berries.webp";
import icedLatte from "@/public/menu/iced-latte.webp";
import strawberry from "@/public/menu/shake-strawberry.webp";

const SHELF = [espresso, icedLatte, strawberry, caramelFrappe, mixBerries];

const lowest = (items: MenuItem[]) => Math.min(...items.flatMap((i) => i.prices.map(([, p]) => p)));

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: alternates(isLang(lang) ? lang : "en", "/") };
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  const d = t(lang);
  const [publishedMenu, site] = await Promise.all([getMenu(), getSite()]);
  const menu = publicMenu(publishedMenu);
  const signature = menu.flatMap((c) => c.items).filter((i) => i.signature);
  const story = storyParagraphs(lang, site);
  const arrow =
    "transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1";

  return (
    <>
      <section className="tile text-on-espresso">
        <div className="mx-auto grid max-w-6xl gap-x-12 px-4 pt-12 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <Logo className="w-48 animate-rise text-crema sm:w-60 lg:col-start-2 lg:row-start-1 lg:w-full lg:max-w-md lg:self-center lg:justify-self-end" />
          <div className="mt-8 lg:col-start-1 lg:row-start-1 lg:mt-0">
            <h1 className="max-w-[14ch] animate-rise font-display text-hero [animation-delay:80ms]">
              {d.home.headline}
            </h1>
            <p className="mt-5 max-w-md animate-rise text-lg text-on-espresso-muted [animation-delay:160ms]">
              {d.home.sub}
            </p>
            <div className="mt-8 flex animate-rise flex-wrap gap-3 [animation-delay:240ms]">
              <Link
                href={href(lang, "/menu")}
                className="lift inline-flex min-h-12 items-center rounded-full bg-crema px-6 font-medium text-espresso hover:bg-on-espresso"
              >
                {d.home.viewMenu}
              </Link>
              <Link
                href={href(lang, "/contact")}
                className="lift inline-flex min-h-12 items-center rounded-full border border-on-espresso/40 px-6 font-medium hover:border-on-espresso hover:bg-on-espresso/10"
              >
                {d.home.findUs}
              </Link>
            </div>
          </div>

          {/* The shelf: drinks standing on a beige rail. */}
          <div className="mt-12 lg:col-span-2 lg:mt-16" aria-hidden>
            <div className="flex items-end justify-center gap-1 sm:gap-4 lg:justify-between lg:px-8">
              {SHELF.map((src, i) => (
                <Image
                  key={src.src}
                  src={src}
                  alt=""
                  priority
                  sizes="(min-width: 1024px) 168px, 19vw"
                  style={{ animationDelay: `${300 + i * 90}ms` }}
                  className="h-auto w-[19%] max-w-32 animate-rise drop-shadow-[0_18px_16px_rgb(0_0_0/0.45)] lg:max-w-42"
                />
              ))}
            </div>
            <div className="h-1.5 rounded-full bg-crema" />
            <div className="h-10 lg:h-14" />
          </div>
        </div>
      </section>

      {signature.length > 0 && (
        <section aria-labelledby="signature" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
          <h2 id="signature" className="reveal font-display text-title">
            {d.home.signature}
          </h2>
          <ItemInfoGroup>
            <div className="mt-8 grid items-start gap-4 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-4">
              {signature.map((i) =>
                i.image ? (
                  <DrinkCard key={i.id} item={{ ...i, image: i.image }} lang={lang} />
                ) : (
                  <div
                    key={i.id}
                    className="reveal flex flex-col justify-end rounded-card border border-line bg-surface p-5"
                  >
                    <h3 className="text-[1.0625rem] font-medium">{pick(lang, i.name, i.nameAr)}</h3>
                    <Price prices={i.prices} sizesAr={i.sizesAr} lang={lang} className="mt-1 text-muted" />
                  </div>
                ),
              )}
            </div>
          </ItemInfoGroup>
        </section>
      )}

      <section aria-labelledby="on-the-menu" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <h2 id="on-the-menu" className="reveal font-display text-title">
          {d.home.onTheMenu}
        </h2>
        <ul className="mt-8 border-t-2 border-ink">
          {menu.map((c) => (
            <li key={c.id} className="reveal border-b border-line">
              <Link
                href={`${href(lang, "/menu")}#${c.id}`}
                className="group flex min-h-16 items-center gap-4 py-4 transition-colors hover:text-caramel"
              >
                <span className="font-display text-2xl sm:text-3xl">{pick(lang, c.name, c.nameAr)}</span>
                <span className="hidden text-sm text-muted sm:inline">{d.home.items(c.items.length)}</span>
                <span className="ms-auto text-end text-sm text-muted">
                  {d.home.from} <Price prices={[["", lowest(c.items)]]} lang={lang} className="text-ink" />
                </span>
                <span aria-hidden className={arrow}>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {story.length > 0 && (
        <section className="mx-auto grid max-w-6xl gap-6 px-4 pt-24 sm:px-6 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <h2 className="reveal font-display text-title">
            {pick(lang, site.story.title, site.story.titleAr)}
          </h2>
          <div className="reveal space-y-4 text-lg text-muted">
            {story.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <Link
              href={href(lang, "/about")}
              className="inline-flex min-h-11 items-center font-medium text-caramel underline-offset-4 hover:underline"
            >
              {d.home.moreAbout}
            </Link>
          </div>
        </section>
      )}

      <Gallery lang={lang} title={d.home.gallery} />

      <section aria-label={d.home.hoursAndLocation} className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <Visit lang={lang} />
      </section>
    </>
  );
}
