import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import { SiteLayout } from "@/components/SiteLayout";
import { href, isLang, t, type Lang } from "@/lib/i18n";

export default async function NotFound() {
  const l = await rootLang();
  const lang: Lang = l && isLang(l) ? l : "en";
  const d = t(lang);
  return (
    <SiteLayout lang={lang}>
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <p className="text-sm font-medium tracking-widest text-caramel uppercase">404</p>
        <h1 className="mt-3 max-w-[16ch] font-display text-hero">{d.notFound.title}</h1>
        <p className="mt-5 text-lg text-muted">{d.notFound.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={href(lang, "/menu")}
            className="inline-flex min-h-12 items-center rounded-full bg-espresso px-6 font-medium text-on-espresso"
          >
            {d.notFound.toMenu}
          </Link>
          <Link
            href={href(lang, "/")}
            className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-medium"
          >
            {d.notFound.home}
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}
