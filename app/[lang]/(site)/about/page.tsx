import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Gallery, storyParagraphs } from "@/components/Story";
import { site } from "@/data/site";
import { alternates, href, isLang, pick, t, type Lang } from "@/lib/i18n";
import brownies from "@/public/menu/brownies.webp";
import cappuccino from "@/public/menu/cappuccino.webp";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  return {
    title: t(lang).about.title,
    description: pick(lang, site.description, site.descriptionAr),
    alternates: alternates(lang, "/about"),
  };
}

export default async function About({ params }: PageProps<"/[lang]/about">) {
  const { lang: l } = await params;
  const lang: Lang = isLang(l) ? l : "en";
  const d = t(lang);
  const story = storyParagraphs(lang);
  const title = pick(lang, site.story.title, site.story.titleAr) || d.about.title;

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14">
        <h1 className="max-w-[16ch] font-display text-hero">{title}</h1>

        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-16">
          <div className="space-y-5 text-lg text-muted">
            {story.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <Link
              href={href(lang, "/menu")}
              className="inline-flex min-h-12 items-center rounded-full bg-espresso px-6 font-medium text-on-espresso hover:bg-ink"
            >
              {d.about.seeMenu}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 self-start" aria-hidden>
            {[cappuccino, brownies].map((src, i) => (
              <div key={src.src} className={`tile flex aspect-[3/4] items-end rounded-card p-5 shadow-lift ${i ? "mt-12" : ""}`}>
                <Image
                  src={src}
                  alt=""
                  sizes="(min-width: 768px) 25vw, 45vw"
                  className="h-auto w-full drop-shadow-[0_14px_14px_rgb(0_0_0/0.35)]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Gallery lang={lang} title={d.about.photos} />
    </>
  );
}
