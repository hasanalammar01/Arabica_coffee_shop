import Link from "next/link";
import { site } from "@/data/site";
import { href, pick, t, type Lang } from "@/lib/i18n";
import { Logo } from "./Logo";

export function Footer({ lang }: { lang: Lang }) {
  const d = t(lang);
  const link = "inline-flex min-h-11 min-w-11 items-center hover:text-on-espresso";
  return (
    <footer className="mt-24 print:hidden">
      <div className="tile h-3" aria-hidden />
      <div className="bg-espresso text-on-espresso">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <Logo className="w-40 text-crema" />
          <nav aria-label={d.nav.footer}>
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-on-espresso-muted">
              <li>
                <Link className={link} href={href(lang, "/menu")}>
                  {d.nav.menu}
                </Link>
              </li>
              <li>
                <Link className={link} href={href(lang, "/about")}>
                  {d.nav.about}
                </Link>
              </li>
              <li>
                <Link className={link} href={href(lang, "/contact")}>
                  {d.footer.hoursLocation}
                </Link>
              </li>
              {site.instagram && (
                <li>
                  <a className={link} href={site.instagram} target="_blank" rel="noopener noreferrer">
                    {d.footer.instagram}
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-sm text-on-espresso-muted sm:px-6">
          © {new Date().getFullYear()} {pick(lang, site.name, site.nameAr)}
        </p>
      </div>
    </footer>
  );
}
