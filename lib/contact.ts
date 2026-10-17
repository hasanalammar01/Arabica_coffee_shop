import { site } from "../data/site.ts";

/** mapsQuery is either a pasted Google Maps link or a place name to search for. */
export const mapsIsLink = /^https?:\/\//.test(site.mapsQuery ?? "");
export const mapsLink = mapsIsLink
  ? site.mapsQuery
  : site.mapsQuery && `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.mapsQuery)}`;

const digits = (n: string) => n.replace(/[^\d]/g, "");

export type ContactKind = "call" | "whatsapp" | "directions" | "instagram" | "email";

/** Contact actions; only the ones filled in under Shop info appear. */
export const contactActions: { kind: ContactKind; href: string }[] = [
  site.phone && { kind: "call" as const, href: `tel:${site.phone.replace(/[^\d+]/g, "")}` },
  site.whatsapp && { kind: "whatsapp" as const, href: `https://wa.me/${digits(site.whatsapp)}` },
  mapsLink && { kind: "directions" as const, href: mapsLink },
  site.instagram && { kind: "instagram" as const, href: site.instagram },
  site.email && { kind: "email" as const, href: `mailto:${site.email}` },
].filter((a): a is { kind: ContactKind; href: string } => Boolean(a));

export const isExternal = (href: string) => href.startsWith("http");
