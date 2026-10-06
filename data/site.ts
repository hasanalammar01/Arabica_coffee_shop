/**
 * Shop details. The values live in data/site.json, edited in the admin under
 * "Shop info". Empty fields are hidden on the site.
 * TODO before going live: real `url` (also used by the QR code), address, contacts and hours
 * (the hours in site.json are a placeholder).
 */
import data from "./site.json" with { type: "json" };

export type Hours = {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** 24h "HH:MM". A close earlier than open means "after midnight". */
  open: string;
  close: string;
};

/** site.json as stored: unset text fields are "". */
export type SiteData = {
  name: string;
  url: string;
  timeZone: string;
  description: string;
  address: string;
  /** A Google Maps link, or a place/address to search for. */
  mapsQuery: string;
  /** International format, e.g. "+961 71 123 456". */
  phone: string;
  whatsapp: string;
  email: string;
  /** Full URL, e.g. "https://instagram.com/arabica". */
  instagram: string;
  hours: Hours[];
};

type Optional = "address" | "mapsQuery" | "phone" | "whatsapp" | "email" | "instagram";
export type Site = Omit<SiteData, Optional> & Partial<Pick<SiteData, Optional>>;

const blank = (v: string) => v.trim() || undefined;

export const siteData = data as SiteData;

export const site: Site = {
  ...siteData,
  address: blank(siteData.address),
  mapsQuery: blank(siteData.mapsQuery),
  phone: blank(siteData.phone),
  whatsapp: blank(siteData.whatsapp),
  email: blank(siteData.email),
  instagram: blank(siteData.instagram),
};
