"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { href, type Dict, type Lang } from "@/lib/i18n";
import { Logo } from "./Logo";

/** The same page in the other language: /menu ⇄ /ar/menu. */
const switchPath = (lang: Lang, path: string) =>
  lang === "ar" ? path.replace(/^\/ar(?=\/|$)/, "") || "/" : path === "/" ? "/ar" : `/ar${path}`;

export function Header({ lang, d }: { lang: Lang; d: Pick<Dict, "nav" | "otherLang"> & { brand: string } }) {
  const path = usePathname();
  const links = [
    { href: href(lang, "/menu"), label: d.nav.menu },
    { href: href(lang, "/about"), label: d.nav.about },
    { href: href(lang, "/contact"), label: d.nav.visit },
  ];
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6 print:hidden">
      <Link
        href={href(lang, "/")}
        className="flex min-h-11 items-center gap-2 text-taupe"
        aria-label={`${d.brand}, ${d.nav.home}`}
      >
        <Logo variant="mark" className="h-7 w-auto" />
        <span className="hidden font-display text-lg text-ink min-[380px]:inline">{lang === "ar" ? "أرابيكا" : "Arabica"}</span>
      </Link>
      <nav aria-label={d.nav.main}>
        <ul className="flex items-center text-[0.95rem] sm:gap-1">
          {links.map(({ href: to, label }) => {
            const current = path === to || path.startsWith(`${to}/`);
            return (
              <li key={to}>
                <Link
                  href={to}
                  aria-current={current ? "page" : undefined}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-2.5 text-muted transition-colors hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink sm:px-3"
                >
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <a
              href={switchPath(lang, path)}
              lang={lang === "ar" ? "en" : "ar"}
              hrefLang={lang === "ar" ? "en" : "ar"}
              className="ms-1 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line px-3 text-sm font-medium hover:border-ink"
            >
              {d.otherLang}
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
