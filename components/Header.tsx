"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Visit" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6 print:hidden">
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2 text-taupe"
        aria-label="Arabica deli-café, home"
      >
        <Logo variant="mark" className="h-7 w-auto" />
        <span className="font-display text-lg text-ink">Arabica</span>
      </Link>
      <nav aria-label="Main">
        <ul className="flex items-center text-[0.95rem] sm:gap-1">
          {LINKS.map(({ href, label }) => {
            const current = path === href || path.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-2.5 text-muted transition-colors hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink sm:px-3"
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
