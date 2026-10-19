import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ContentError,
  imageReferences,
  replaceImageReferences,
  parseContent,
  requireVersions,
  validateSite,
  type MenuDocument,
} from "./content-core.ts";
import siteSeed from "../data/site.json" with { type: "json" };

const menu = (item: Record<string, unknown>) =>
  JSON.stringify({ categories: [{ name: "Desserts", items: [item] }] });
const invalid = (run: () => unknown) =>
  assert.throws(run, (e: unknown) => e instanceof ContentError && e.status === 400);

test("content writes reject stale or missing versions while allowing changes to an independent document", () => {
  const current = { "data/menu.json": "4", "data/site.json": "9" };
  const stale = { "data/menu.json": "3", "data/site.json": "9" };
  assert.throws(
    () => requireVersions(["data/menu.json", "data/site.json"], stale, current),
    (e: unknown) => e instanceof ContentError && e.status === 409,
  );
  assert.throws(
    () => requireVersions(["data/menu.json"], {}, current),
    (e: unknown) => e instanceof ContentError && e.status === 409,
  );
  assert.doesNotThrow(() => requireVersions(["data/site.json"], stale, current));
  assert.doesNotThrow(() => requireVersions(["data/menu.json", "data/site.json"], current, current));
});

test("menu content is fully validated on the server, including price and allowed image URLs", () => {
  invalid(() => parseContent("data/menu.json", menu({ name: "Ice cream", price: -1 })));
  invalid(() =>
    parseContent(
      "data/menu.json",
      menu({ name: "Ice cream", price: 200000, image: "https://evil.test/x.webp" }),
    ),
  );
  invalid(() => parseContent("data/menu.json", '{"categories":[null]}'));
  invalid(() => parseContent("data/menu.json", '{"categories":[{"name":"Desserts","items":[null]}]}'));
  invalid(() => parseContent("data/menu.json", "{broken"));
  assert.doesNotThrow(() =>
    parseContent("data/menu.json", menu({ name: "Ice cream", price: 200000, image: "/menu/ice-cream.webp" })),
  );
  assert.doesNotThrow(() =>
    parseContent(
      "data/menu.json",
      menu({
        name: "Ice cream",
        price: 200000,
        image: "https://store.public.blob.vercel-storage.com/menu/ice-cream-abc.webp",
      }),
    ),
  );
});

test("only photo fields authorize menu uploads", () => {
  const doc = parseContent(
    "data/menu.json",
    menu({
      name: "Ice cream",
      price: 200000,
      image: "/menu/ice-cream.webp",
      description: "/menu/unrelated.webp",
    }),
  ) as MenuDocument;
  assert.deepEqual([...imageReferences("data/menu.json", doc)], ["/menu/ice-cream.webp"]);
});

test("publishing photo URLs preserves the original text and unsaved draft", () => {
  const path = "/menu/ice-cream.webp";
  const url = "https://store.public.blob.vercel-storage.com/menu/ice-cream-Ab12.webp";
  const doc = parseContent("data/menu.json", menu({ name: "Ice cream", price: 200000, image: path, description: path })) as MenuDocument;
  const saved = replaceImageReferences("data/menu.json", doc, { [path]: url }) as MenuDocument;
  const savedItems = saved.categories[0].items;
  const draftItems = doc.categories[0].items;
  assert.ok(Array.isArray(savedItems) && Array.isArray(draftItems));
  assert.equal(savedItems[0].image, url);
  assert.equal(savedItems[0].description, path);
  assert.equal(draftItems[0].image, path);
});

test("shop information validates dates, hours, time zone and runtime collection shapes", () => {
  assert.equal(validateSite(siteSeed).timeZone, "Asia/Beirut");
  invalid(() => validateSite({ ...siteSeed, name: 8 }));
  invalid(() => validateSite({ ...siteSeed, url: "javascript:alert(1)" }));
  invalid(() => validateSite({ ...siteSeed, timeZone: "fake/timezone" }));
  invalid(() => validateSite({ ...siteSeed, hours: [{ days: [7], open: "08:00", close: "20:00" }] }));
  invalid(() => validateSite({ ...siteSeed, hours: [{ days: [1, 1], open: "08:00", close: "20:00" }] }));
  invalid(() => validateSite({ ...siteSeed, hours: [{ days: [1], open: "28:00", close: "20:00" }] }));
  invalid(() => validateSite({ ...siteSeed, hours: {} }));
  invalid(() => validateSite({ ...siteSeed, specialHours: [{ from: "2026-02-30", closed: true }] }));
  invalid(() =>
    validateSite({ ...siteSeed, specialHours: [{ from: "2026-12-24", to: "2026-12-20", closed: true }] }),
  );
  invalid(() => validateSite({ ...siteSeed, specialHours: [{ from: "2026-12-24", closed: false }] }));
  invalid(() => validateSite({ ...siteSeed, story: { body: [] } }));
  invalid(() => validateSite({ ...siteSeed, gallery: [{ src: "https://evil.test/x.webp", alt: "Photo" }] }));
  assert.doesNotThrow(() =>
    validateSite({ ...siteSeed, specialHours: [{ from: "2026-12-24", closed: true }] }),
  );
});
