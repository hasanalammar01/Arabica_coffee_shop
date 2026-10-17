import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Price } from "@/components/Price";
import { PrintButton } from "@/components/PrintButton";
import { site } from "@/data/site";
import { formatDate, localTime } from "@/lib/hours";
import { alternates, href, isLang, pick, t, type Lang } from "@/lib/i18n";
import { getMenu, publicMenu } from "@/lib/menu";

export async function generateMetadata({ params }: PageProps<"/[lang]/menu/print">): Promise<Metadata> {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  return { title: t(lang).menu.printTitle, alternates: alternates(lang, "/menu/print"), robots: { index: false } };
}

/**
 * The downloadable menu: built from the same menu.json as the site, so publishing a price
 * change in the admin updates it too. Guests print it or save it as PDF from the browser.
 */
export default async function PrintMenu({ params }: PageProps<"/[lang]/menu/print">) {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  const d = t(lang);
  const menu = publicMenu(getMenu());
  // Built on each publish, so this is the date the prices were last published.
  const asOf = formatDate(localTime(new Date(), site.timeZone).date, lang);

  return (
    <main id="main" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-card bg-surface p-4 print:hidden">
        <p className="me-auto text-sm text-muted">{d.menu.printHint}</p>
        <Link href={href(lang, "/menu")} className="inline-flex min-h-12 items-center rounded-full border border-line px-5 font-medium">
          {d.menu.back}
        </Link>
        <PrintButton label={d.menu.printNow} />
      </div>

      <header className="flex items-end justify-between gap-6 border-b-2 border-ink pb-4">
        <Logo className="w-36 text-espresso print:text-black" />
        <div className="text-end text-sm text-muted">
          <p>{d.menu.prices}</p>
          <p>{d.menu.printedOn(asOf)}</p>
        </div>
      </header>

      <div className="mt-6 columns-1 gap-10 sm:columns-2 print:columns-2">
        {menu.map((c) => (
          <section key={c.id} className="mb-6 break-inside-avoid-column">
            <h2 className="border-b border-line pb-1 font-display text-2xl">{pick(lang, c.name, c.nameAr)}</h2>
            <ul className="mt-2 text-sm">
              {c.items.map((i) => (
                <li key={i.id} className="flex items-baseline gap-2 py-1 break-inside-avoid">
                  <span className="min-w-0">
                    {pick(lang, i.name, i.nameAr)}
                    {i.options && (
                      <span className="block text-xs text-muted">
                        {i.options.map((o, n) => pick(lang, o, i.optionsAr?.[n])).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="leader" aria-hidden />
                  <Price prices={i.prices} sizesAr={i.sizesAr} lang={lang} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="mt-4 border-t border-line pt-3 text-center text-xs text-muted">
        {pick(lang, site.name, site.nameAr)} · {site.url.replace(/^https?:\/\//, "")}
        {href(lang, "/menu")}
      </footer>
    </main>
  );
}
