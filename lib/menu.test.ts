import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMenu, getMenu, slugify } from "./menu.ts";

test("the real menu is valid", () => {
  const menu = getMenu();
  assert.equal(menu.length, 7);
  assert.equal(menu[0].id, "hot-drinks");
});

test("ids are generated from names and stay unique", () => {
  const [c] = buildMenu([
    {
      name: "Cold Drinks",
      items: [
        { name: "Caffè Frappé", price: 1 },
        { name: "Caffè Frappé", price: 2 },
      ],
    },
  ]);
  assert.deepEqual(
    c.items.map((i) => i.id),
    ["cold-drinks-caffe-frappe", "cold-drinks-caffe-frappe-2"],
  );
  assert.equal(slugify("شاي", "item-1"), "item-1");
});

test("empty admin fields are dropped and sizes win over price", () => {
  const [c] = buildMenu([
    {
      name: "Shakes",
      items: [
        {
          name: "Mango",
          price: 5,
          sizes: [{ size: "Large", price: 9 }],
          description: "",
          options: [],
          tags: null,
        },
      ],
    },
  ]);
  assert.deepEqual(c.items[0].prices, [["Large", 9]]);
  assert.equal(c.items[0].description, undefined);
  assert.equal(c.items[0].options, undefined);
});

test("empty sections are hidden; broken items fail with every problem listed", () => {
  assert.equal(buildMenu([{ name: "Soon", items: [] }]).length, 0);
  assert.throws(
    () =>
      buildMenu([{ name: "Saj", items: [{ name: "", tags: ["tasty"], image: "/menu/nope.webp" }] }], {
        imageExists: () => false,
      }),
    (e: Error) =>
      ["missing a name", "needs a price", 'unknown tag "tasty"', "not found in /public"].every((m) =>
        e.message.includes(m),
      ),
  );
});

test("JSON embedded in <script> can't close the tag", async () => {
  const { scriptJson } = await import("./script-json.ts");
  const out = scriptJson({ name: "</script><b>" });
  assert.ok(!out.includes("<"));
  assert.deepEqual(JSON.parse(out), { name: "</script><b>" });
});

test("fields the admin cleared to empty strings don't crash the build", () => {
  const [c] = buildMenu([
    {
      name: "Saj",
      items: [{ name: "Zaatar", price: 1, options: "", sizes: "", tags: "", image: "", addon: "" }],
    },
  ]);
  assert.deepEqual(c.items[0].prices, [["", 1]]);
  assert.equal(c.items[0].options, undefined);
  assert.throws(() => buildMenu([{ name: "Saj", items: [{ name: "Zaatar", price: "" }] }]), /needs a price/);
});
