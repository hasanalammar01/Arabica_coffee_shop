/**
 * Shop details. The values live in data/site.json, edited in the admin under
 * "Shop info" and "Story & photos". Empty fields are hidden on the site.
 * The owner must supply: address, contacts, real opening hours, story and photos.
 */
import { safeHttpUrl } from "../lib/url.ts";
import data from "./site.json" with { type: "json" };

export type Hours = {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** 24h "HH:MM". A close earlier than open means "after midnight". */
  open: string;
  close: string;
};

/** A holiday closure or special opening hours, for one date or a date range (inclusive). */
export type SpecialHours = {
  /** "YYYY-MM-DD" */
  from: string;
  to?: string;
  closed: boolean;
  open?: string;
  close?: string;
  note?: string;
  noteAr?: string;
};

export type Photo = { src: string; alt: string; altAr?: string };

export type Story = { title: string; titleAr: string; body: string; bodyAr: string };

/** site.json as stored: unset text fields are "". */
export type SiteData = {
  name: string;
  nameAr: string;
  url: string;
  timeZone: string;
  description: string;
  descriptionAr: string;
  address: string;
  addressAr: string;
  /** A Google Maps link, or a place/address to search for. */
  mapsQuery: string;
  /** International format, e.g. "+961 71 123 456". */
  phone: string;
  whatsapp: string;
  email: string;
  /** Full URL, e.g. "https://instagram.com/arabica". */
  instagram: string;
  hours: Hours[];
  specialHours: SpecialHours[];
  story: Story;
  gallery: Photo[];
};

type Optional = "address" | "addressAr" | "mapsQuery" | "phone" | "whatsapp" | "email" | "instagram";
export type Site = Omit<SiteData, Optional> & Partial<Pick<SiteData, Optional>>;

const blank = (v: string | undefined) => v?.trim() || undefined;

/** Older site.json files may lack the newer fields; fill them so the site never breaks. */
export const withDefaults = (d: Partial<SiteData>): SiteData => ({
  name: d.name ?? "",
  nameAr: d.nameAr ?? "",
  url: d.url ?? "",
  timeZone: d.timeZone ?? "Asia/Beirut",
  description: d.description ?? "",
  descriptionAr: d.descriptionAr ?? "",
  address: d.address ?? "",
  addressAr: d.addressAr ?? "",
  mapsQuery: d.mapsQuery ?? "",
  phone: d.phone ?? "",
  whatsapp: d.whatsapp ?? "",
  email: d.email ?? "",
  instagram: d.instagram ?? "",
  hours: d.hours ?? [],
  specialHours: d.specialHours ?? [],
  story: { title: "", titleAr: "", body: "", bodyAr: "", ...d.story },
  gallery: d.gallery ?? [],
});

export const siteData = withDefaults(data as Partial<SiteData>);

export const site: Site = {
  ...siteData,
  address: blank(siteData.address),
  addressAr: blank(siteData.addressAr),
  mapsQuery: blank(siteData.mapsQuery),
  phone: blank(siteData.phone),
  whatsapp: blank(siteData.whatsapp),
  email: blank(siteData.email),
  // Only a real web link: a "javascript:" value must never become a clickable link.
  instagram: safeHttpUrl(siteData.instagram) || undefined,
};
