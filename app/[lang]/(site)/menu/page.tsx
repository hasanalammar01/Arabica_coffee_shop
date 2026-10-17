import type { Metadata } from "next";
import Link from "next/link";
import { MenuBrowser } from "@/components/MenuBrowser";
import { currency } from "@/data/menu";
import { site } from "@/data/site";
import { alternates, href, isLang, pick, t, type Lang } from "@/lib/i18n";
import { getMenu, publicMenu } from "@/lib/menu";
import { scriptJson } from "@/lib/script-json";

export async function generateMetadata({ params }: PageProps<"/[lang]/menu">): Promise<Metadata> {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  const d = t(lang);
  return { title: d.menu.title, description: d.menu.description, alternates: alternates(lang, "/menu") };
}

export default async function MenuPage({ params }: PageProps<"/[lang]/menu">) {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  const d = t(lang);
  const menu = publicMenu(getMenu());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `${pick(lang, site.name, site.nameAr)} – ${d.menu.title}`,
    url: `${site.url}${href(lang, "/menu")}`,
    inLanguage: lang,
    hasMenuSection: menu.map((c) => ({
      "@type": "MenuSection",
      name: pick(lang, c.name, c.nameAr),
      hasMenuItem: c.items.map((i) => ({
        "@type": "MenuItem",
        name: pick(lang, i.name, i.nameAr),
        description: pick(lang, i.description ?? "", i.descriptionAr) || undefined,
        image: i.image && `${site.url}${i.image}`,
        offers: i.prices.map(([size, price]) => ({
          "@type": "Offer",
          name: size || undefined,
          price,
          priceCurrency: currency.code,
          availability: i.availability === "soldout" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        })),
      })),
    })),
  };

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-6 sm:px-6 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-hero">{d.menu.title}</h1>
            <p className="mt-2 text-muted">{d.menu.prices}</p>
          </div>
          <Link
            href={href(lang, "/menu/print")}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-medium hover:border-ink print:hidden"
          >
            {d.menu.print}
          </Link>
        </div>
      </div>
      <MenuBrowser menu={menu} lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(jsonLd) }} />
    </>
  );
}
