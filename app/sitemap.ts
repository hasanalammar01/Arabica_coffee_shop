import type { MetadataRoute } from "next";
import { getSite } from "@/lib/site";
import { href, LANGS } from "@/lib/i18n";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();
  return ["/", "/menu", "/about", "/contact"].flatMap((path) =>
    LANGS.map((lang) => ({
      url: `${site.url}${href(lang, path)}`.replace(/\/$/, ""),
      changeFrequency: path === "/menu" ? "weekly" : "monthly",
      priority: path === "/" || path === "/menu" ? 1 : 0.6,
      alternates: {
        languages: Object.fromEntries(
          LANGS.map((l) => [l, `${site.url}${href(l, path)}`.replace(/\/$/, "")]),
        ),
      },
    })),
  );
}
