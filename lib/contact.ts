import type { Site } from "../data/site.ts";
import { safeHttpUrl } from "./url.ts";

/** mapsQuery is either a pasted Google Maps link or a place name to search for. */
export const mapsIsLink = (query: string | undefined) => /^https?:\/\//.test(query ?? "");
export const getMapsLink = (site: Pick<Site, "mapsQuery">) =>
  mapsIsLink(site.mapsQuery)
    ? safeHttpUrl(site.mapsQuery) || undefined
    : site.mapsQuery && `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.mapsQuery)}`;

const digits = (n: string) => n.replace(/[^\d]/g, "");

export type ContactKind = "call" | "whatsapp" | "directions" | "instagram" | "email";

/** Contact actions; only the ones filled in under Shop info appear. */
export function getContactActions(site: Pick<Site, "phone" | "whatsapp" | "mapsQuery" | "instagram" | "email">): { kind: ContactKind; href: string }[] {
  const mapsLink = getMapsLink(site);
  const instagram = safeHttpUrl(site.instagram);
  return [
    site.phone && { kind: "call" as const, href: `tel:${site.phone.replace(/[^\d+]/g, "")}` },
    site.whatsapp && { kind: "whatsapp" as const, href: `https://wa.me/${digits(site.whatsapp)}` },
    mapsLink && { kind: "directions" as const, href: mapsLink },
    instagram && { kind: "instagram" as const, href: instagram },
    site.email && { kind: "email" as const, href: `mailto:${site.email}` },
  ].filter((a): a is { kind: ContactKind; href: string } => Boolean(a));
}

export const isExternal = (href: string) => href.startsWith("http");
