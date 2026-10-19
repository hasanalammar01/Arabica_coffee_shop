import { getSite } from "@/lib/site";
import { pick, t, type Lang } from "@/lib/i18n";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MobileActions } from "./MobileActions";

/** Header, footer and the mobile action bar for the public pages (the admin has its own shell). */
export async function SiteLayout({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const site = await getSite();
  const d = t(lang);
  return (
    <>
      <Header lang={lang} d={{ nav: d.nav, otherLang: d.otherLang, brand: pick(lang, site.name, site.nameAr) }} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer lang={lang} />
      <MobileActions lang={lang} />
    </>
  );
}
