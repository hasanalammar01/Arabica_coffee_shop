import type { MetadataRoute } from "next";
import { site } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/menu", "/about", "/contact"].map((path) => ({
    url: `${site.url}${path}`,
    changeFrequency: path === "/menu" ? "weekly" : "monthly",
    priority: path === "" || path === "/menu" ? 1 : 0.6,
  }));
}
