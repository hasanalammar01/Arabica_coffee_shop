import { cache } from "react";
import { connection } from "next/server";
import type { Site } from "../data/site.ts";
import { getSiteData } from "./content-store.ts";
import { safeHttpUrl } from "./url.ts";

const blank = (value: string | undefined) => value?.trim() || undefined;

/** Published shop information, memoized only for the current server render. */
export const getSite = cache(async (): Promise<Site> => {
  await connection();
  const data = await getSiteData();
  return {
    ...data,
    // Metadata requires an absolute web URL, even if old content contains a bad value.
    url: (safeHttpUrl(data.url) || "https://arabica-deli-cafe.vercel.app").replace(/\/$/, ""),
    address: blank(data.address),
    addressAr: blank(data.addressAr),
    mapsQuery: blank(data.mapsQuery),
    phone: blank(data.phone),
    whatsapp: blank(data.whatsapp),
    email: blank(data.email),
    instagram: safeHttpUrl(data.instagram) || undefined,
  };
});
