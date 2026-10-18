import type { ShopSettings } from "../orders-core.ts";

/**
 * Who may do what in the admin. The super admin can do everything; staff accounts get pages the
 * super admin ticks. The server checks these on every request; hiding a page in the menu is
 * only for convenience. Browser-safe, no database code.
 */
export const PAGES = ["items", "sections", "shop", "orders", "stats", "payments", "settings"] as const;
export type Page = (typeof PAGES)[number];

export const PAGE_LABELS: Record<Page, string> = {
  items: "Menu items",
  sections: "Sections",
  shop: "Shop info",
  orders: "Orders",
  stats: "Statistics",
  payments: "Payment methods",
  settings: "Settings",
};

/** What a new staff account can open until the super admin changes it. */
export const STAFF_DEFAULT: Page[] = ["items", "sections", "shop", "orders"];

export type AdminUser =
  | { role: "admin"; name: string }
  | { role: "staff"; id: number; name: string; pages: Page[] };

export const can = (user: AdminUser, page: Page) => user.role === "admin" || user.pages.includes(page);

/** Keeps only known pages, in a fixed order. */
export const cleanPages = (value: unknown): Page[] =>
  Array.isArray(value) ? PAGES.filter((p) => value.includes(p)) : [...STAFF_DEFAULT];

/** Publishing: shop info needs "Shop info"; the menu and its photos need "Menu items" or "Sections". */
export const canPublish = (user: AdminUser, path: string) =>
  path === "data/site.json" ? can(user, "shop") : can(user, "items") || can(user, "sections");

/**
 * A settings save, merged part by part: payment methods only from someone with "Payment
 * methods", ordering and notifications only with "Settings". Only the super admin changes the
 * WhatsApp number or key, because that number receives the PIN reset codes.
 */
export function mergeShop(current: ShopSettings, incoming: ShopSettings, user: AdminUser): ShopSettings {
  const next: ShopSettings = structuredClone(current);
  if (can(user, "payments")) next.payments = incoming.payments;
  if (can(user, "settings")) {
    next.ordersEnabled = incoming.ordersEnabled;
    next.email = incoming.email;
    next.whatsapp = { ...next.whatsapp, enabled: incoming.whatsapp.enabled };
  }
  if (user.role === "admin") next.whatsapp = incoming.whatsapp;
  return next;
}

/** What a user may read of the settings: staff never see the CallMeBot key. */
export function shopForUser(shop: ShopSettings, user: AdminUser): ShopSettings {
  if (user.role === "admin") return shop;
  return { ...shop, whatsapp: { ...shop.whatsapp, apiKey: "" } };
}
