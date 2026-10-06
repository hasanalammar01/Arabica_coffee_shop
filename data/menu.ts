/**
 * Menu types. The menu itself lives in data/menu.json, edited through the admin
 * at /admin (or by hand). lib/menu.ts validates it and fails the build with a
 * clear message if something is wrong.
 */
import data from "./menu.json" with { type: "json" };

export const TAGS = ["vegan", "gluten-free", "spicy", "new", "bestseller"] as const;
export type Tag = (typeof TAGS)[number];

/** A field the admin left empty may be missing, null or "" (even for lists and numbers). */
type Empty = null | "";

/** One item as stored in menu.json. */
export type MenuItemData = {
  name: string;
  description?: string | null;
  /** Price in L.L. Ignored when `sizes` is filled in. */
  price?: number | Empty;
  sizes?: { size: string; price: number | Empty }[] | Empty;
  /** Flavours/choices that don't change the price. */
  options?: string[] | Empty;
  /** Extras like "Add cheese", shown smaller at the end of the section. */
  addon?: boolean | Empty;
  tags?: string[] | Empty;
  /** Path under /public. Items without an image render as a text row. */
  image?: string | null;
};

export type MenuCategoryData = { name: string; items?: MenuItemData[] | Empty };

/** Clean, validated shapes used by the site (see lib/menu.ts). */
export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  /** One entry for a single price, several for sizes: [["Small", 300000], ["Large", 400000]]. */
  prices: [size: string, price: number][];
  options?: string[];
  addon?: boolean;
  tags?: Tag[];
  image?: string;
};

export type MenuCategory = { id: string; name: string; items: MenuItem[] };

export const currency = { code: "LBP", label: "L.L" } as const;

export const menuData = data.categories as MenuCategoryData[];
