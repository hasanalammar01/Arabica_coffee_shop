import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import menuSeed from "../data/menu.json" with { type: "json" };
import siteSeed from "../data/site.json" with { type: "json" };
import { ContentError, parseContent, type MenuDocument } from "./content-core.ts";
import { createContentStore, type ContentSql } from "./content-store.ts";
import { buildMenu } from "./menu-core.ts";
import { DEFAULT_SETTINGS, validateOrder } from "./orders-core.ts";

const MENU = "data/menu.json";
const SITE = "data/site.json";
const menu = (price: number) =>
  JSON.stringify({ categories: [{ name: "Coffee", items: [{ id: "latte", name: "Latte", price }] }] });
const site = (name: string) => JSON.stringify({ ...siteSeed, name });
const errorStatus = (status: number) => (error: unknown) =>
  error instanceof ContentError && error.status === status;

async function database(t: TestContext) {
  // No data directory or connection string: every test gets its own in-memory Postgres.
  const pg = new PGlite();
  t.after(() => pg.close());
  const sql: ContentSql = async (strings, ...values) => {
    const query = strings.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
    return (await pg.query<Record<string, unknown>>(query, values)).rows;
  };
  const store = createContentStore(sql);
  const snapshot = async () => ({ menu: await store.readContent(MENU), site: await store.readContent(SITE) });
  return { sql, store, snapshot };
}

test("initialization seeds once and a later repository never overwrites published content", async (t) => {
  const { sql, store, snapshot } = await database(t);
  const initial = await snapshot();
  assert.deepEqual(JSON.parse(initial.menu.text), menuSeed);
  assert.deepEqual(JSON.parse(initial.site.text), siteSeed);
  assert.equal(initial.menu.sha, "1");
  assert.equal(initial.site.sha, "1");

  await store.saveContent(
    [
      { path: MENU, content: menu(225000) },
      { path: SITE, content: site("Published cafe") },
    ],
    { [MENU]: "1", [SITE]: "1" },
  );
  const published = await snapshot();
  assert.deepEqual(JSON.parse(published.menu.text), JSON.parse(menu(225000)));
  assert.equal(JSON.parse(published.site.text).name, "Published cafe");

  // A new server instance runs CREATE/INSERT again against the existing database.
  const restarted = createContentStore(sql);
  assert.deepEqual(await restarted.readContent(MENU), published.menu);
  assert.deepEqual(await restarted.readContent(SITE), published.site);
  assert.equal((await restarted.readContent(MENU)).sha, "2");
  assert.equal((await restarted.readContent(SITE)).sha, "2");
});

test("menu and shop versions advance independently without losing the other document", async (t) => {
  const { store, snapshot } = await database(t);
  await snapshot();
  const [menuVersions, siteVersions] = await Promise.all([
    store.saveContent([{ path: MENU, content: menu(250000) }], { [MENU]: "1", [SITE]: "1" }),
    store.saveContent([{ path: SITE, content: site("New name") }], { [MENU]: "1", [SITE]: "1" }),
  ]);
  assert.deepEqual(menuVersions, { [MENU]: "2" });
  assert.deepEqual(siteVersions, { [SITE]: "2" });
  const both = await snapshot();
  assert.deepEqual(JSON.parse(both.menu.text), JSON.parse(menu(250000)));
  assert.equal(JSON.parse(both.site.text).name, "New name");

  // An old version of an untouched document must not block a valid menu edit.
  assert.deepEqual(
    await store.saveContent([{ path: MENU, content: menu(275000) }], { [MENU]: "2", [SITE]: "1" }),
    { [MENU]: "3" },
  );
  assert.deepEqual((await snapshot()).site, both.site);
});

test("stale, missing and malformed expected versions cannot overwrite stored edits", async (t) => {
  const { store, snapshot } = await database(t);
  await store.saveContent([{ path: MENU, content: menu(250000) }], { [MENU]: "1" });
  const published = await snapshot();
  const bases: Record<string, string>[] = [{}, { [MENU]: "1" }, { [MENU]: "0" }, { [MENU]: "invalid" }];
  for (const base of bases) {
    await assert.rejects(store.saveContent([{ path: MENU, content: menu(1) }], base), errorStatus(409));
    assert.deepEqual(await snapshot(), published);
  }
});

test("a multi-document publish is atomic when one version conflicts, and succeeds with both current versions", async (t) => {
  const { store, snapshot } = await database(t);
  await store.saveContent([{ path: SITE, content: site("Already published") }], { [SITE]: "1" });
  const published = await snapshot();
  const files = [
    { path: MENU, content: menu(325000) },
    { path: SITE, content: site("Together") },
  ];
  await assert.rejects(store.saveContent(files, { [MENU]: "1", [SITE]: "1" }), errorStatus(409));
  assert.deepEqual(await snapshot(), published);

  const versions = await store.saveContent(files, { [MENU]: "1", [SITE]: "2" });
  assert.deepEqual(versions, { [MENU]: "2", [SITE]: "3" });
  const saved = await snapshot();
  assert.deepEqual(JSON.parse(saved.menu.text), JSON.parse(menu(325000)));
  assert.equal(JSON.parse(saved.site.text).name, "Together");
});

test("checkout prices the current persisted menu after a publish", async (t) => {
  const { store } = await database(t);
  await store.saveContent([{ path: MENU, content: menu(200000) }], { [MENU]: "1" });
  const priceOrder = async () => {
    const { text } = await store.readContent(MENU);
    const current = parseContent(MENU, text) as MenuDocument;
    const result = validateOrder(
      {
        name: "Rana",
        phone: "+961 3 123 456",
        fulfilment: "pickup",
        payment: "cash",
        lines: [{ id: "latte", size: "", option: "", mods: [], qty: 2 }],
        total: 1,
      },
      {
        menu: buildMenu(current.categories),
        settings: { ...DEFAULT_SETTINGS, ordersEnabled: true },
        open: true,
      },
    );
    assert.ok("order" in result);
    return result.order;
  };
  assert.equal((await priceOrder()).total, 400000);
  await store.saveContent([{ path: MENU, content: menu(275000) }], { [MENU]: "2" });
  const order = await priceOrder();
  assert.equal(order.items[0].unit, 275000);
  assert.equal(order.total, 550000);
});

test("invalid content leaves both persisted documents and their versions unchanged", async (t) => {
  const { store, snapshot } = await database(t);
  const initial = await snapshot();
  const invalidWrites = [
    [{ path: MENU, content: menu(-1) }],
    [{ path: SITE, content: "{broken" }],
    [
      { path: MENU, content: menu(500000) },
      { path: SITE, content: JSON.stringify({ ...siteSeed, timeZone: "invalid/timezone" }) },
    ],
  ];
  for (const files of invalidWrites) {
    await assert.rejects(store.saveContent(files, { [MENU]: "1", [SITE]: "1" }), errorStatus(400));
    assert.deepEqual(await snapshot(), initial);
  }
});
