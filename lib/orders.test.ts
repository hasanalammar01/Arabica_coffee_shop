import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMenu } from "./menu-core.ts";
import { DEFAULT_SETTINGS, menuItems, orderMessage, priceLine, summarize, validateOrder } from "./orders-core.ts";

const menu = buildMenu([
  {
    name: "Drinks",
    items: [
      {
        id: "latte",
        name: "Latte",
        sizes: [
          { size: "Small", price: 300 },
          { size: "Large", price: 400 },
        ],
        modifiers: [
          { name: "Milk", min: 1, max: 1, choices: [{ name: "Full" }, { name: "Oat", price: 50 }] },
          { name: "Extras", min: 0, max: 2, choices: [{ name: "Shot", price: 70 }, { name: "Syrup", price: 20 }] },
        ],
      },
      { id: "tea", name: "Iced Tea", price: 100, options: ["Peach", "Lemon"] },
      { id: "gone", name: "Gone", price: 100, availability: "soldout" },
    ],
  },
]);
const items = menuItems(menu);
const latte = { id: "latte", size: "Large", option: "", mods: ["milk/oat", "extras/shot"], qty: 2 };

test("a line is priced from the menu: size + paid extras, times quantity", () => {
  const line = priceLine(items, latte)!;
  assert.equal(line.unit, 400 + 50 + 70);
  assert.equal(line.total, 2 * 520);
  assert.deepEqual(line.mods.map((m) => m.name), ["Oat", "Shot"]);
});

test("lines that don't match the menu are refused", () => {
  const bad = [
    { ...latte, size: "Huge" },
    { ...latte, mods: ["extras/shot"] }, // milk is required
    { ...latte, mods: ["milk/oat", "milk/full"] }, // only one milk
    { ...latte, mods: ["milk/oat", "extras/caviar"] },
    { ...latte, qty: 0 },
    { ...latte, qty: 1.5 },
    { id: "tea", size: "", option: "Mango", mods: [], qty: 1 },
    { id: "tea", size: "", option: "", mods: [], qty: 1 }, // a flavour must be picked
    { id: "gone", size: "", option: "", mods: [], qty: 1 },
    { id: "nope", size: "", option: "", mods: [], qty: 1 },
  ];
  for (const line of bad) assert.equal(priceLine(items, line), null, JSON.stringify(line));
  assert.equal(priceLine(items, { id: "tea", size: "", option: "Peach", mods: [], qty: 3 })!.total, 300);
});

const settings = { ...DEFAULT_SETTINGS, ordersEnabled: true };
const body = {
  name: "Rana",
  phone: "+961 3 123 456",
  fulfilment: "delivery",
  address: "Hamra, Bliss St, 3rd floor",
  location: { lat: 33.8959, lng: 35.4787 },
  payment: "cash",
  lines: [latte, { id: "tea", size: "", option: "Lemon", mods: [], qty: 1 }],
  // The browser's prices are ignored.
  total: 1,
};

test("a valid order is re-priced on the server", () => {
  const r = validateOrder(body, { menu, settings, open: true });
  assert.ok("order" in r);
  assert.equal(r.order.total, 1040 + 100);
  assert.equal(r.order.payment, "Cash on delivery");
  assert.equal(r.order.location, "https://www.google.com/maps?q=33.895900,35.478700");
});

test("orders are refused when off, closed, incomplete or tampered with", () => {
  const check = (b: object, opts = {}) => {
    const r = validateOrder(b, { menu, settings, open: true, ...opts });
    return "error" in r ? r.error : "ok";
  };
  assert.equal(check(body, { settings: DEFAULT_SETTINGS }), "disabled");
  assert.equal(check(body, { open: false }), "closed");
  assert.equal(check({ ...body, payment: "whish" }), "invalid"); // not enabled
  assert.equal(check({ ...body, address: "" }), "invalid");
  assert.equal(check({ ...body, fulfilment: "pickup", address: "" }), "ok");
  assert.equal(check({ ...body, phone: "call me" }), "invalid");
  assert.equal(check({ ...body, lines: [] }), "invalid");
  assert.equal(check({ ...body, website: "spam" }), "invalid");
  assert.equal(check({ ...body, lines: [{ ...latte, size: "Huge" }] }), "unavailable");
});

test("the notification lists items, customer and payment", () => {
  const r = validateOrder(body, { menu, settings, open: true });
  assert.ok("order" in r);
  const text = orderMessage({ ...r.order, id: 7 });
  assert.match(text, /^New order #7: 1,140 L\.L\n2× Latte · Large, Oat, Shot\n1× Iced Tea · Lemon\n\n/);
  assert.match(text, /Delivery: Hamra/);
  assert.match(text, /Payment: Cash on delivery$/);
  assert.doesNotMatch(text, /Note:/);
});

test("statistics: today, this week from Monday, this month, last 30 days", () => {
  // 2026-10-17 is a Saturday, so the week started Monday 2026-10-12.
  const days = [
    { day: "2026-09-30", orders: 5, revenue: 500 },
    { day: "2026-10-01", orders: 1, revenue: 100 },
    { day: "2026-10-11", orders: 2, revenue: 200 },
    { day: "2026-10-12", orders: 3, revenue: 300 },
    { day: "2026-10-17", orders: 4, revenue: 400 },
  ];
  const s = summarize(days, "2026-10-17");
  assert.deepEqual(s.today, { orders: 4, revenue: 400 });
  assert.deepEqual(s.week, { orders: 7, revenue: 700 });
  assert.deepEqual(s.month, { orders: 10, revenue: 1000 });
  assert.equal(s.last30.length, 30);
  assert.equal(s.last30[0].day, "2026-09-18");
  assert.equal(s.last30.at(-1)!.orders, 4);
});
