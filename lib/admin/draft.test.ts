import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeInstagram, toDraft, toMenuJson } from "./draft.ts";

test("publishing without edits leaves menu.json unchanged", () => {
  const original = JSON.parse(readFileSync(new URL("../../data/menu.json", import.meta.url), "utf8"));
  assert.deepEqual(toMenuJson(toDraft(original.categories)), original);
});

test("sizes replace the single price and empty fields are left out", () => {
  const [section] = toDraft([{ name: "Shakes", items: [{ name: "Mango", price: 5 }] }]);
  section.items[0].sizes = [{ size: "Large", price: "9" }];
  section.items[0].description = "  ";
  assert.deepEqual(toMenuJson([section]).categories[0].items?.[0], {
    name: "Mango",
    sizes: [{ size: "Large", price: 9 }],
  });
});

test("instagram handles become links", () => {
  assert.equal(normalizeInstagram("@arabica"), "https://instagram.com/arabica");
  assert.equal(normalizeInstagram("instagram.com/arabica"), "https://instagram.com/arabica");
  assert.equal(normalizeInstagram("arabica"), "https://instagram.com/arabica");
  assert.equal(normalizeInstagram("https://www.instagram.com/x"), "https://www.instagram.com/x");
  assert.equal(normalizeInstagram(" "), "");
});
