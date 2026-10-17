import Image from "next/image";
import { site } from "@/data/site";
import { pick, type Lang } from "@/lib/i18n";

/** The café story from the admin, split into paragraphs at blank lines. */
export function storyParagraphs(lang: Lang) {
  return pick(lang, site.story.body, site.story.bodyAr)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Café photos uploaded in the admin. Renders nothing until there are some. */
export function Gallery({ lang, title }: { lang: Lang; title: string }) {
  if (!site.gallery.length) return null;
  return (
    <section aria-label={title} className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
      <h2 className="font-display text-title">{title}</h2>
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {site.gallery.map((p, i) => (
          <li key={p.src} className={`relative overflow-hidden rounded-card bg-surface ${i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"}`}>
            <Image
              src={p.src}
              alt={pick(lang, p.alt, p.altAr)}
              fill
              sizes={i === 0 ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 50vw"}
              className="object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
