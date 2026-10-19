import {
  ALLERGENS,
  AVAILABILITY,
  TAGS,
  type Allergen,
  type Availability,
  type MenuCategory,
  type MenuCategoryData,
  type MenuItem,
  type Modifier,
  type Tag,
} from "../data/menu.ts";
import { isSiteImage } from "./images.ts";
export { IMAGE_PATH } from "./images.ts";

/** "Caffè Latte" → "caffe-latte". Names with no Latin letters fall back to `fallback`. */
export const slugify = (s: string, fallback: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip accents left by NFKD: é → e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || fallback;

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
// The admin may save a cleared list as "" or null, so anything that isn't a non-empty array counts as empty.
const list = <T>(v: T[] | string | null | undefined) => (Array.isArray(v) && v.length ? v : undefined);
const strings = (v: unknown) =>
  list(Array.isArray(v) ? v.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean) : undefined);
const int = (v: unknown, fallback: number) => (typeof v === "number" && Number.isInteger(v) ? v : fallback);

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Turns menu.json into clean data: keeps permanent ids (or derives them), drops empty
 * fields and hides empty sections. Anything that would show or order wrong (no name,
 * no price, unknown tag/allergen, bad modifier, missing image) throws one error listing
 * every problem. Browser-safe: the server passes `imageExists` to also check files on disk.
 * Hidden items are kept (staff and orders need them); use `publicMenu` for the site.
 */
export function buildMenu(
  data: MenuCategoryData[],
  { imageExists = () => true }: { imageExists?: (path: string) => boolean } = {},
): MenuCategory[] {
  if (!Array.isArray(data)) throw new Error("data/menu.json is invalid:\n  - `categories` must be a list");
  const errors: string[] = [];
  const used = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const itemIds = new Set<string>();

  const menu = data.map((c, ci): MenuCategory => {
    const name = text(c?.name) ?? "";
    if (!name) errors.push(`Section #${ci + 1}: missing a name`);
    const id = uniqueId(slugify(name, `section-${ci + 1}`));

    const items = (list(c?.items) ?? []).map((i, ii): MenuItem => {
      const itemName = text(i?.name) ?? "";
      const where = `${name || `Section #${ci + 1}`} → ${itemName || `item #${ii + 1}`}`;
      if (!itemName) errors.push(`${where}: missing a name`);

      // Permanent id: stored ids win; old data without one gets the name-based id.
      let itemId = text(i.id);
      if (itemId && !ID.test(itemId)) errors.push(`${where}: id "${itemId}" must be lowercase-with-dashes`);
      if (itemId && itemIds.has(itemId)) errors.push(`${where}: duplicate id "${itemId}"`);
      if (!itemId) {
        itemId = `${id}-${slugify(itemName, `item-${ii + 1}`)}`;
        for (let n = 2; itemIds.has(itemId); n++) itemId = `${id}-${slugify(itemName, `item-${ii + 1}`)}-${n}`;
      }
      itemIds.add(itemId);

      const sizes = list(i.sizes);
      const prices: MenuItem["prices"] = sizes
        ? sizes.map((s) => [text(s?.size) ?? "", typeof s?.price === "number" ? s.price : NaN])
        : typeof i.price === "number"
          ? [["", i.price]]
          : [];
      if (!prices.length) errors.push(`${where}: needs a price (or sizes with prices)`);
      if (prices.some(([, p]) => !Number.isInteger(p) || p <= 0))
        errors.push(`${where}: prices must be positive whole numbers`);
      if (sizes && prices.some(([s]) => !s)) errors.push(`${where}: every size needs a name`);
      if (sizes && new Set(prices.map(([s]) => s)).size !== prices.length)
        errors.push(`${where}: two sizes have the same name`);

      const tags = strings(i.tags);
      for (const t of tags ?? []) if (!TAGS.includes(t as Tag)) errors.push(`${where}: unknown tag "${t}"`);
      const allergens = strings(i.allergens);
      for (const a of allergens ?? [])
        if (!ALLERGENS.includes(a as Allergen)) errors.push(`${where}: unknown allergen "${a}"`);

      const availability = (text(i.availability) ?? "available") as Availability;
      if (!AVAILABILITY.includes(availability))
        errors.push(`${where}: availability must be available, soldout or hidden`);

      const image = text(i.image);
      if (image && !isSiteImage(image)) errors.push(`${where}: image "${image}" isn't a supported site photo`);
      else if (image && !imageExists(image)) errors.push(`${where}: image "${image}" not found in /public`);

      const modifiers = (list(i.modifiers) ?? []).map((m, mi): Modifier => {
        const mName = text(m?.name) ?? "";
        const mWhere = `${where} → choice group ${mName || `#${mi + 1}`}`;
        if (!mName) errors.push(`${mWhere}: missing a name`);
        const choices = (list(m?.choices) ?? []).map((ch, chi) => {
          const chName = text(ch?.name) ?? "";
          if (!chName) errors.push(`${mWhere}: choice #${chi + 1} needs a name`);
          const price = ch?.price === "" || ch?.price == null ? 0 : ch.price;
          if (!Number.isInteger(price) || price < 0)
            errors.push(`${mWhere} → ${chName}: price must be 0 or a positive whole number`);
          return { id: slugify(chName, `choice-${chi + 1}`), name: chName, nameAr: text(ch?.nameAr), price };
        });
        if (!choices.length) errors.push(`${mWhere}: needs at least one choice`);
        if (new Set(choices.map((c) => c.id)).size !== choices.length)
          errors.push(`${mWhere}: two choices have the same name`);
        const min = Math.max(0, int(m?.min, 0));
        const max = Math.min(choices.length || 1, Math.max(1, int(m?.max, choices.length || 1)));
        if (min > max) errors.push(`${mWhere}: "at least" can't be more than "at most"`);
        return { id: slugify(mName, `group-${mi + 1}`), name: mName, nameAr: text(m?.nameAr), min, max, choices };
      });
      if (new Set(modifiers.map((m) => m.id)).size !== modifiers.length)
        errors.push(`${where}: two choice groups have the same name`);

      const options = strings(i.options);
      return {
        id: itemId,
        name: itemName,
        nameAr: text(i.nameAr),
        arDraft: (i.arDraft === true && Boolean(text(i.nameAr))) || undefined,
        description: text(i.description),
        descriptionAr: text(i.descriptionAr),
        ingredients: text(i.ingredients),
        ingredientsAr: text(i.ingredientsAr),
        allergens: allergens as Allergen[] | undefined,
        prices,
        sizesAr: sizes ? sizes.map((s) => text(s?.sizeAr) ?? "") : undefined,
        options,
        optionsAr: options ? (strings(i.optionsAr) ?? undefined) : undefined,
        modifiers: modifiers.length ? modifiers : undefined,
        addon: i.addon === true || undefined,
        tags: tags as Tag[] | undefined,
        availability,
        signature: i.signature === true || undefined,
        image,
      };
    });

    return {
      id,
      name,
      nameAr: text(c?.nameAr),
      arDraft: (c?.arDraft === true && Boolean(text(c?.nameAr))) || undefined,
      items,
    };
  });

  if (errors.length) throw new Error(`data/menu.json is invalid:\n  - ${errors.join("\n  - ")}`);
  // A section with no items yet (e.g. just created in the admin) is hidden, not an error.
  return menu.filter((c) => c.items.length);
}

/** What guests see: hidden items removed, then empty sections dropped. */
export const publicMenu = (menu: MenuCategory[]) =>
  menu
    .map((c) => ({ ...c, items: c.items.filter((i) => i.availability !== "hidden") }))
    .filter((c) => c.items.length);

/** All items by permanent id (for orders, recipes and reports). */
export const itemsById = (menu: MenuCategory[]) =>
  new Map(menu.flatMap((c) => c.items.map((i) => [i.id, { ...i, section: c.name }] as const)));
