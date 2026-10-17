import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { fontVars } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "Page not found | Arabica" };

/** For URLs outside every route (the site and the admin have separate root layouts). */
export default function GlobalNotFound() {
  const en = t("en").notFound;
  const ar = t("ar").notFound;
  return (
    <html lang="en" className={fontVars}>
      <body className="flex min-h-dvh items-center font-sans antialiased">
        <main className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <p className="text-sm font-medium tracking-widest text-caramel uppercase">404</p>
          <h1 className="mt-3 max-w-[16ch] font-display text-hero">{en.title}</h1>
          <p className="mt-5 text-lg text-muted">{en.body}</p>
          <p lang="ar" dir="rtl" className="mt-2 text-lg text-muted">
            {ar.title} {ar.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/menu"
              className="inline-flex min-h-12 items-center rounded-full bg-espresso px-6 font-medium text-on-espresso"
            >
              {en.toMenu}
            </Link>
            <Link href="/ar/menu" lang="ar" className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-medium">
              {t("ar").notFound.toMenu}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
