import type { Metadata } from "next";
import { Visit } from "@/components/Visit";
import { site } from "@/data/site";
import { mapsIsLink } from "@/lib/contact";
import { alternates, isLang, t, type Lang } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  const d = t(lang);
  return { title: d.visit.title, description: d.visit.description, alternates: alternates(lang, "/contact") };
}

export default async function Contact({ params }: PageProps<"/[lang]/contact">) {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14">
      <Visit lang={lang} headingLevel="h1" />
      {/* Shared links (maps.app.goo.gl/…) can't be embedded, only searches can. */}
      {site.mapsQuery && !mapsIsLink && (
        <iframe
          title={t(lang).visit.map}
          src={`https://www.google.com/maps?q=${encodeURIComponent(site.mapsQuery)}&output=embed&hl=${lang}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="mt-14 aspect-[4/3] w-full rounded-card border border-line sm:aspect-[16/7]"
        />
      )}
    </div>
  );
}
