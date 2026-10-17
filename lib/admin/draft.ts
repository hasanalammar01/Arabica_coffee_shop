import type {
  Allergen,
  Availability,
  MenuCategoryData,
  MenuItemData,
  ModifierData,
  Tag,
} from "../../data/menu.ts";
import type { SiteData } from "../../data/site.ts";
import { slugify } from "../menu-core.ts";

export type DraftModifier = {
  name: string;
  nameAr: string;
  min: string;
  max: string;
  choices: { name: string; nameAr: string; price: string }[];
};

/** An item as the admin edits it: every field present, numbers as digit strings. */
export type DraftItem = {
  key: string;
  /** Permanent id ("" for a new item until it's first published). */
  id: string;
  name: string;
  nameAr: string;
  arDraft: boolean;
  description: string;
  descriptionAr: string;
  ingredients: string;
  ingredientsAr: string;
  allergens: Allergen[];
  price: string;
  sizes: { size: string; sizeAr: string; price: string }[];
  options: string[];
  optionsAr: string[];
  modifiers: DraftModifier[];
  tags: Tag[];
  addon: boolean;
  availability: Availability;
  signature: boolean;
  /** Published photo path, e.g. "/menu/espresso.webp", or "". */
  image: string;
  /** A newly chosen photo, uploaded with the next publish. */
  upload?: Blob;
  /** Object URL to show a new photo before the site has redeployed. */
  preview?: string;
};

export type DraftSection = { key: string; name: string; nameAr: string; arDraft: boolean; items: DraftItem[] };

let counter = 0;
export const newKey = () => `k${++counter}`;

const digits = (v: unknown) => (typeof v === "number" ? String(v) : "");
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s) => typeof s === "string") : []);
const arr = <T>(v: T[] | null | "" | undefined): T[] => (Array.isArray(v) ? v : []);

export const emptyItem = (): DraftItem => ({
  key: newKey(),
  id: "",
  name: "",
  nameAr: "",
  arDraft: false,
  description: "",
  descriptionAr: "",
  ingredients: "",
  ingredientsAr: "",
  allergens: [],
  price: "",
  sizes: [],
  options: [],
  optionsAr: [],
  modifiers: [],
  tags: [],
  addon: false,
  availability: "available",
  signature: false,
  image: "",
});

const toDraftModifier = (m: ModifierData): DraftModifier => ({
  name: str(m.name),
  nameAr: str(m.nameAr),
  min: digits(m.min),
  max: digits(m.max),
  choices: arr(m.choices).map((c) => ({ name: str(c.name), nameAr: str(c.nameAr), price: digits(c.price) })),
});

export function toDraft(categories: MenuCategoryData[]): DraftSection[] {
  return categories.map((c) => ({
    key: newKey(),
    name: str(c.name),
    nameAr: str(c.nameAr),
    arDraft: c.arDraft === true,
    items: arr(c.items).map(
      (i): DraftItem => ({
        key: newKey(),
        id: str(i.id),
        name: str(i.name),
        nameAr: str(i.nameAr),
        arDraft: i.arDraft === true,
        description: str(i.description),
        descriptionAr: str(i.descriptionAr),
        ingredients: str(i.ingredients),
        ingredientsAr: str(i.ingredientsAr),
        allergens: strings(i.allergens) as Allergen[],
        price: digits(i.price),
        sizes: arr(i.sizes).map((s) => ({ size: str(s.size), sizeAr: str(s.sizeAr), price: digits(s.price) })),
        options: strings(i.options),
        optionsAr: strings(i.optionsAr),
        modifiers: arr(i.modifiers).map(toDraftModifier),
        tags: strings(i.tags) as Tag[],
        addon: i.addon === true,
        availability: (["soldout", "hidden"].includes(str(i.availability)) ? i.availability : "available") as Availability,
        signature: i.signature === true,
        image: str(i.image),
      }),
    ),
  }));
}

/** A new permanent id: readable, plus a short random part so it never collides with an old one. */
export const newItemId = (name: string) =>
  `${slugify(name, "item")}-${Math.random().toString(36).slice(2, 6).padEnd(4, "0")}`;

/** Back to menu.json, writing only the fields that are set. */
export function toMenuJson(sections: DraftSection[]): { categories: MenuCategoryData[] } {
  return {
    categories: sections.map((s) => {
      const section: MenuCategoryData = { name: s.name.trim() };
      if (s.nameAr.trim()) section.nameAr = s.nameAr.trim();
      if (s.arDraft && s.nameAr.trim()) section.arDraft = true;
      section.items = s.items.map((i) => {
        const item: MenuItemData = { id: i.id || newItemId(i.name), name: i.name.trim() };
        if (i.nameAr.trim()) item.nameAr = i.nameAr.trim();
        if (i.arDraft && i.nameAr.trim()) item.arDraft = true;
        if (i.sizes.length)
          item.sizes = i.sizes.map((s) => ({
            size: s.size.trim(),
            ...(s.sizeAr.trim() && { sizeAr: s.sizeAr.trim() }),
            price: Number(s.price) || 0,
          }));
        else if (i.price) item.price = Number(i.price);
        if (i.description.trim()) item.description = i.description.trim();
        if (i.descriptionAr.trim()) item.descriptionAr = i.descriptionAr.trim();
        if (i.ingredients.trim()) item.ingredients = i.ingredients.trim();
        if (i.ingredientsAr.trim()) item.ingredientsAr = i.ingredientsAr.trim();
        if (i.allergens.length) item.allergens = i.allergens;
        if (i.options.length) item.options = i.options;
        if (i.options.length && i.optionsAr.some((o) => o.trim()))
          item.optionsAr = i.options.map((_, n) => (i.optionsAr[n] ?? "").trim());
        if (i.modifiers.length)
          item.modifiers = i.modifiers.map((m) => ({
            name: m.name.trim(),
            ...(m.nameAr.trim() && { nameAr: m.nameAr.trim() }),
            ...(m.min !== "" && { min: Number(m.min) }),
            ...(m.max !== "" && { max: Number(m.max) }),
            choices: m.choices.map((c) => ({
              name: c.name.trim(),
              ...(c.nameAr.trim() && { nameAr: c.nameAr.trim() }),
              ...(c.price !== "" && Number(c.price) > 0 && { price: Number(c.price) }),
            })),
          }));
        if (i.tags.length) item.tags = i.tags;
        if (i.addon) item.addon = true;
        if (i.availability !== "available") item.availability = i.availability;
        if (i.signature) item.signature = true;
        if (i.image) item.image = i.image;
        return item;
      });
      return section;
    }),
  };
}

export const toJsonFile = (data: unknown) => `${JSON.stringify(data, null, 2)}\n`;

/** "@arabica", "instagram.com/arabica" or a full URL → "https://instagram.com/arabica". */
export function normalizeInstagram(value: string) {
  const v = value.trim();
  if (!v || /^https?:\/\//.test(v)) return v;
  if (v.startsWith("@")) return `https://instagram.com/${v.slice(1)}`;
  return v.includes("instagram.com") ? `https://${v}` : `https://instagram.com/${v}`;
}

export const normalizeSite = (s: SiteData): SiteData => ({
  ...s,
  ...Object.fromEntries(
    (["address", "addressAr", "mapsQuery", "phone", "whatsapp", "email"] as const).map((k) => [k, s[k].trim()]),
  ),
  instagram: normalizeInstagram(s.instagram),
});

/**
 * Shrinks a chosen photo to at most `maxSize` px and converts it to WebP (keeps transparency),
 * so a 5 MB phone photo becomes ~100 KB on the menu.
 */
export async function preparePhoto(file: File, maxSize = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("This photo couldn't be read."))),
      "image/webp",
      0.86,
    ),
  );
}
