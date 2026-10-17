/**
 * Menu types. The menu itself lives in data/menu.json, edited through the admin
 * at /admin (or by hand). lib/menu-core.ts validates it (in the build, and on the
 * server before every admin publish) and lists every problem it finds.
 */
import data from "./menu.json" with { type: "json" };

/** Dietary and marketing labels. Only shown when staff set them; never inferred. */
export const TAGS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "spicy", "new", "bestseller"] as const;
export type Tag = (typeof TAGS)[number];

/** Common food allergens. Staff tick the ones an item contains. */
export const ALLERGENS = [
  "gluten",
  "dairy",
  "eggs",
  "nuts",
  "peanuts",
  "soy",
  "sesame",
  "fish",
  "shellfish",
  "mustard",
  "celery",
  "sulphites",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** Absent = available. Sold out stays visible (greyed, can't be ordered); hidden disappears from the site. */
export const AVAILABILITY = ["available", "soldout", "hidden"] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** A field the admin left empty may be missing, null or "" (even for lists and numbers). */
type Empty = null | "";

/** A choice group used when ordering, e.g. "Milk" (one of) or "Extras" (any of, paid). */
export type ModifierData = {
  name: string;
  nameAr?: string | null;
  /** Fewest / most choices a customer may pick. min 1 = required. */
  min?: number | Empty;
  max?: number | Empty;
  choices: { name: string; nameAr?: string | null; price?: number | Empty }[];
};

/** One item as stored in menu.json. */
export type MenuItemData = {
  /** Permanent id: orders, recipes and reports refer to it, so it never changes on rename. */
  id?: string | null;
  name: string;
  nameAr?: string | null;
  /** True while the Arabic name is a draft translation waiting for review. */
  arDraft?: boolean | Empty;
  description?: string | null;
  descriptionAr?: string | null;
  ingredients?: string | null;
  ingredientsAr?: string | null;
  allergens?: string[] | Empty;
  /** Price in L.L. Ignored when `sizes` is filled in. */
  price?: number | Empty;
  sizes?: { size: string; sizeAr?: string | null; price: number | Empty }[] | Empty;
  /** Flavours/choices that don't change the price (customers pick one when ordering). */
  options?: string[] | Empty;
  optionsAr?: string[] | Empty;
  /** Paid or free extras for ordering: milk, extra shot, add-ons. */
  modifiers?: ModifierData[] | Empty;
  /** Extras like "Add cheese", shown smaller at the end of the section. */
  addon?: boolean | Empty;
  tags?: string[] | Empty;
  availability?: string | Empty;
  /** Featured on the home page. */
  signature?: boolean | Empty;
  /** Path under /public. Items without an image render as a text row. */
  image?: string | null;
};

export type MenuCategoryData = {
  name: string;
  nameAr?: string | null;
  arDraft?: boolean | Empty;
  items?: MenuItemData[] | Empty;
};

/** A modifier choice as used by the site and the order system. */
export type Modifier = {
  id: string;
  name: string;
  nameAr?: string;
  min: number;
  max: number;
  choices: { id: string; name: string; nameAr?: string; price: number }[];
};

/** Clean, validated shapes used by the site (see lib/menu-core.ts). */
export type MenuItem = {
  id: string;
  name: string;
  nameAr?: string;
  arDraft?: boolean;
  description?: string;
  descriptionAr?: string;
  ingredients?: string;
  ingredientsAr?: string;
  allergens?: Allergen[];
  /** One entry per size: [["", 90000]] or [["Small", 300000], ["Large", 400000]]. */
  prices: [size: string, price: number][];
  /** Arabic size names, same order as `prices`. */
  sizesAr?: string[];
  options?: string[];
  optionsAr?: string[];
  modifiers?: Modifier[];
  addon?: boolean;
  tags?: Tag[];
  availability: Availability;
  signature?: boolean;
  image?: string;
};

export type MenuCategory = { id: string; name: string; nameAr?: string; arDraft?: boolean; items: MenuItem[] };

export const currency = { code: "LBP", label: "L.L", labelAr: "ل.ل" } as const;

export const menuData = data.categories as MenuCategoryData[];
