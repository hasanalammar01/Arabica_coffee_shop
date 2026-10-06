/**
 * Shop details. Anything left undefined is simply hidden on the site.
 * TODO: fill in everything marked TODO before going live.
 */

export type Hours = {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** 24h "HH:MM". A close earlier than open means "after midnight". */
  open: string;
  close: string;
};

export type Site = {
  name: string;
  url: string;
  timeZone: string;
  description: string;
  address?: string;
  /** What to search on Google Maps (address or exact place name). */
  mapsQuery?: string;
  /** International format, digits only after +, e.g. "+96171123456". */
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  hours?: Hours[];
};

export const site: Site = {
  name: "Arabica deli-café",
  url: "https://arabica-cafe.vercel.app", // TODO: real domain (also used by the QR code)
  timeZone: "Asia/Beirut",
  description:
    "Arabica deli-café: espresso and iced coffee, shakes and smoothies, saj from the griddle, desserts and shisha.",
  address: undefined, // TODO: "Street, area, city, Lebanon"
  mapsQuery: undefined, // TODO
  phone: undefined, // TODO
  whatsapp: undefined, // TODO
  email: undefined, // TODO
  instagram: undefined, // TODO: "https://instagram.com/..."
  // TODO: PLACEHOLDER hours, replace with the real ones.
  hours: [{ days: [0, 1, 2, 3, 4, 5, 6], open: "08:00", close: "00:00" }],
};
