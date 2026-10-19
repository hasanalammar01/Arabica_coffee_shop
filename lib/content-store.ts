import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import menuSeed from "../data/menu.json" with { type: "json" };
import siteSeed from "../data/site.json" with { type: "json" };
import type { MenuCategoryData } from "../data/menu.ts";
import type { SiteData } from "../data/site.ts";
import { ContentError, CONFLICT, parseContent, type ContentPath, type MenuDocument } from "./content-core.ts";

export { ContentError } from "./content-core.ts";

let client: NeonQueryFunction<false, false> | null = null;

/** The tagged-query interface used by both Neon and isolated Postgres integration tests. */
export type ContentSql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

/** Independent repositories share persisted rows, with initialization scoped to each connection. */
export function createContentStore(sql: ContentSql) {
  let ready: Promise<void> | null = null;

  async function db() {
    ready ??= (async () => {
      await sql`create table if not exists site_content (
      id integer primary key default 1 check (id = 1),
      menu jsonb not null,
      site jsonb not null,
      menu_version bigint not null default 1,
      site_version bigint not null default 1,
      updated_at timestamptz not null default now()
    )`;
      // Seed once. Existing database content always wins over the bundled deployment copy.
      await sql`insert into site_content (id, menu, site)
      values (1, ${JSON.stringify(menuSeed)}::jsonb, ${JSON.stringify(siteSeed)}::jsonb)
      on conflict (id) do nothing`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
    await ready;
    return sql;
  }

  async function readContent(path: ContentPath): Promise<{ text: string; sha: string }> {
    const sql = await db();
    const [row] =
      await sql`select menu, site, menu_version::text, site_version::text from site_content where id = 1`;
    if (!row) throw new Error("Public content is missing after initialization.");
    const menu = path === "data/menu.json";
    return {
      text: JSON.stringify(menu ? row.menu : row.site),
      sha: String(menu ? row.menu_version : row.site_version),
    };
  }

  /** A single conditional update makes both content documents publish together, or neither. */
  async function saveContent(
    files: { path: string; content: string }[],
    base: Record<string, string>,
  ): Promise<Record<string, string>> {
    const docs = new Map<ContentPath, MenuDocument | SiteData>();
    for (const f of files) {
      if ((f.path !== "data/menu.json" && f.path !== "data/site.json") || docs.has(f.path))
        throw new ContentError(400, "That change can't be published.");
      docs.set(f.path, parseContent(f.path, f.content));
    }
    if (!docs.size) throw new ContentError(400, "There is no menu or shop information to publish.");
    for (const path of docs.keys())
      if (!/^[1-9]\d*$/.test(base[path] ?? "")) throw new ContentError(409, CONFLICT);
    const sql = await db();
    const menu = docs.has("data/menu.json");
    const site = docs.has("data/site.json");
    const rows = await sql`update site_content set
    menu = case when ${menu} then ${JSON.stringify(docs.get("data/menu.json") ?? null)}::jsonb else menu end,
    site = case when ${site} then ${JSON.stringify(docs.get("data/site.json") ?? null)}::jsonb else site end,
    menu_version = menu_version + case when ${menu} then 1 else 0 end,
    site_version = site_version + case when ${site} then 1 else 0 end,
    updated_at = now()
    where id = 1
      and (${!menu} or menu_version::text = ${base["data/menu.json"] ?? ""})
      and (${!site} or site_version::text = ${base["data/site.json"] ?? ""})
    returning menu_version::text, site_version::text`;
    if (!rows.length) throw new ContentError(409, CONFLICT);
    return Object.fromEntries(
      [...docs.keys()].map((path) => [
        path,
        String(path === "data/menu.json" ? rows[0].menu_version : rows[0].site_version),
      ]),
    );
  }

  return { readContent, saveContent };
}

// Read credentials lazily, so importing content code never contacts a database.
const store = createContentStore(async (strings, ...values) => {
  if (!process.env.DATABASE_URL)
    throw new ContentError(503, "The database isn't connected. Connect Neon in Vercel, then redeploy.");
  const sql = (client ??= neon(process.env.DATABASE_URL));
  return sql(strings, ...values);
});

export async function readContent(path: ContentPath): Promise<{ text: string; sha: string }> {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV !== "development")
      throw new ContentError(503, "The database isn't connected. Connect Neon in Vercel, then redeploy.");
    const text = await readFile(join(/*turbopackIgnore: true*/ process.cwd(), path), "utf8");
    return { text, sha: createHash("sha256").update(text).digest("hex") };
  }
  return store.readContent(path);
}

export const saveContent = store.saveContent;

export async function getMenuData(): Promise<MenuCategoryData[]> {
  const { text } = await readContent("data/menu.json");
  return (parseContent("data/menu.json", text) as MenuDocument).categories;
}

export async function getSiteData(): Promise<SiteData> {
  const { text } = await readContent("data/site.json");
  return parseContent("data/site.json", text) as SiteData;
}
