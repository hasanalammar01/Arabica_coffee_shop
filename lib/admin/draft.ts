import type { MenuCategoryData, MenuItemData, Tag } from "../../data/menu.ts";
import type { SiteData } from "../../data/site.ts";

/** An item as the admin edits it: every field present, prices as digit strings. */
export type DraftItem = {
  key: string;
  name: string;
  description: string;
  price: string;
  sizes: { size: string; price: string }[];
  options: string[];
  tags: Tag[];
  addon: boolean;
  /** Published photo path, e.g. "/menu/espresso.webp", or "". */
  image: string;
  /** A newly chosen photo, uploaded with the next publish. */
  upload?: Blob;
  /** Object URL to show a new photo before the site has redeployed. */
  preview?: string;
};

export type DraftSection = { key: string; name: string; items: DraftItem[] };

let counter = 0;
export const newKey = () => `k${++counter}`;

const digits = (v: unknown) => (typeof v === "number" ? String(v) : "");
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s) => typeof s === "string") : []);

export const emptyItem = (): DraftItem => ({
  key: newKey(),
  name: "",
  description: "",
  price: "",
  sizes: [],
  options: [],
  tags: [],
  addon: false,
  image: "",
});

export function toDraft(categories: MenuCategoryData[]): DraftSection[] {
  return categories.map((c) => ({
    key: newKey(),
    name: c.name ?? "",
    items: (Array.isArray(c.items) ? c.items : []).map((i): DraftItem => ({
      key: newKey(),
      name: i.name ?? "",
      description: typeof i.description === "string" ? i.description : "",
      price: digits(i.price),
      sizes: (Array.isArray(i.sizes) ? i.sizes : []).map((s) => ({
        size: s.size ?? "",
        price: digits(s.price),
      })),
      options: strings(i.options),
      tags: strings(i.tags) as Tag[],
      addon: i.addon === true,
      image: typeof i.image === "string" ? i.image : "",
    })),
  }));
}

/** Back to menu.json, writing only the fields that are set. */
export function toMenuJson(sections: DraftSection[]): { categories: MenuCategoryData[] } {
  return {
    categories: sections.map((s) => ({
      name: s.name.trim(),
      items: s.items.map((i) => {
        const item: MenuItemData = { name: i.name.trim() };
        if (i.sizes.length)
          item.sizes = i.sizes.map((s) => ({ size: s.size.trim(), price: Number(s.price) || 0 }));
        else if (i.price) item.price = Number(i.price);
        if (i.description.trim()) item.description = i.description.trim();
        if (i.options.length) item.options = i.options;
        if (i.tags.length) item.tags = i.tags;
        if (i.addon) item.addon = true;
        if (i.image) item.image = i.image;
        return item;
      }),
    })),
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
    (["address", "mapsQuery", "phone", "whatsapp", "email"] as const).map((k) => [k, s[k].trim()]),
  ),
  instagram: normalizeInstagram(s.instagram),
});

/**
 * Shrinks a chosen photo to at most 800px and converts it to WebP (keeps transparency),
 * so a 5 MB phone photo becomes ~100 KB on the menu.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
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
