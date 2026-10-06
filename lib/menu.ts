import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  menuData,
  TAGS,
  type MenuCategory,
  type MenuCategoryData,
  type MenuItem,
  type Tag,
} from "../data/menu.ts";

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

/**
 * Turns menu.json into clean data for the site: generates ids, drops empty fields
 * and hides empty sections. Anything that would show wrong on the site (no name,
 * no price, unknown tag, missing image) fails the build with a list of every problem.
 */
export function buildMenu(data: MenuCategoryData[]): MenuCategory[] {
  const errors: string[] = [];
  const used = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  const menu = data.map((c, ci): MenuCategory => {
    const name = text(c.name) ?? "";
    if (!name) errors.push(`Section #${ci + 1}: missing a name`);
    const id = uniqueId(slugify(name, `section-${ci + 1}`));

    const items = (list(c.items) ?? []).map((i, ii): MenuItem => {
      const itemName = text(i.name) ?? "";
      const where = `${name || `Section #${ci + 1}`} → ${itemName || `item #${ii + 1}`}`;
      if (!itemName) errors.push(`${where}: missing a name`);

      const sizes = list(i.sizes);
      const prices: MenuItem["prices"] = sizes
        ? sizes.map((s) => [text(s.size) ?? "", typeof s.price === "number" ? s.price : NaN])
        : typeof i.price === "number"
          ? [["", i.price]]
          : [];
      if (!prices.length) errors.push(`${where}: needs a price (or sizes with prices)`);
      if (prices.some(([, p]) => !Number.isFinite(p) || p <= 0))
        errors.push(`${where}: prices must be positive numbers`);
      if (sizes && prices.some(([s]) => !s)) errors.push(`${where}: every size needs a name`);

      const tags = list(i.tags);
      for (const t of tags ?? []) if (!TAGS.includes(t as Tag)) errors.push(`${where}: unknown tag "${t}"`);

      const image = text(i.image);
      if (image && !existsSync(join(process.cwd(), "public", image)))
        errors.push(`${where}: image "${image}" not found in /public`);

      return {
        id: uniqueId(`${id}-${slugify(itemName, `item-${ii + 1}`)}`),
        name: itemName,
        description: text(i.description),
        prices,
        options: list(
          list(i.options)
            ?.map((o) => String(o ?? "").trim())
            .filter(Boolean),
        ),
        addon: i.addon || undefined,
        tags: tags as Tag[] | undefined,
        image,
      };
    });

    return { id, name, items };
  });

  if (errors.length) throw new Error(`data/menu.json is invalid:\n  - ${errors.join("\n  - ")}`);
  // A section with no items yet (e.g. just created in the admin) is hidden, not an error.
  return menu.filter((c) => c.items.length);
}

export const getMenu = () => buildMenu(menuData);
