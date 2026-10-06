import type { Metadata } from "next";
import { MenuBrowser } from "@/components/MenuBrowser";
import { currency } from "@/data/menu";
import { site } from "@/data/site";
import { scriptJson } from "@/lib/script-json";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = {
  title: "Menu",
  description: "Hot and cold drinks, shakes, smoothies, saj, desserts and shisha, with prices.",
  alternates: { canonical: "/menu" },
};

export default function MenuPage() {
  const menu = getMenu();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `${site.name} menu`,
    url: `${site.url}/menu`,
    hasMenuSection: menu.map((c) => ({
      "@type": "MenuSection",
      name: c.name,
      hasMenuItem: c.items.map((i) => ({
        "@type": "MenuItem",
        name: i.name,
        description: i.description,
        image: i.image && `${site.url}${i.image}`,
        offers: i.prices.map(([size, price]) => ({
          "@type": "Offer",
          name: size || undefined,
          price,
          priceCurrency: currency.code,
        })),
      })),
    })),
  };

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-6 sm:px-6 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-hero">Menu</h1>
            <p className="mt-2 text-muted">Prices in Lebanese pounds ({currency.label}).</p>
          </div>
          <a
            href="/arabica-menu.pdf"
            download
            className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-medium hover:border-ink print:hidden"
          >
            Download PDF menu
          </a>
        </div>
      </div>
      <MenuBrowser menu={menu} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(jsonLd) }} />
    </>
  );
}
