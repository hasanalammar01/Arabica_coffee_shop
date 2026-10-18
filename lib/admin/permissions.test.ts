import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS, cleanShopSettings } from "../orders-core.ts";
import { can, canPublish, cleanPages, mergeShop, shopForUser, type AdminUser, type Page } from "./permissions.ts";

const admin: AdminUser = { role: "admin", name: "owner" };
const staff = (pages: Page[]): AdminUser => ({ role: "staff", id: 7, name: "rana", pages });
const cashier = staff(["orders"]);
const manager = staff(["items", "sections", "shop", "orders", "stats", "payments", "settings"]);

const current = cleanShopSettings({
  ...DEFAULT_SETTINGS,
  ordersEnabled: true,
  whatsapp: { enabled: true, phone: "+96170000001", apiKey: "real-key" },
  email: { enabled: false, address: "owner@example.com" },
});
// Everything an attacker might try to change at once.
const tampered = cleanShopSettings({
  ordersEnabled: false,
  payments: [{ id: "evil", kind: "whish", name: "Whish", enabled: true, phone: "03 666 666", accountName: "Attacker" }],
  whatsapp: { enabled: false, phone: "+96170666666", apiKey: "attacker-key" },
  email: { enabled: true, address: "attacker@example.com" },
});

test("pages: the super admin opens everything, staff only what was ticked", () => {
  assert.equal(can(admin, "settings"), true);
  assert.equal(can(cashier, "orders"), true);
  for (const page of ["items", "sections", "shop", "stats", "payments", "settings"] as const) assert.equal(can(cashier, page), false, page);
  assert.deepEqual(cleanPages(["settings", "made-up", "orders", 42]), ["orders", "settings"]);
  assert.deepEqual(cleanPages(undefined), ["items", "sections", "shop", "orders"]); // new account default
});

test("publishing: shop info needs Shop info; the menu and photos need Menu items or Sections", () => {
  assert.equal(canPublish(cashier, "data/menu.json"), false);
  assert.equal(canPublish(cashier, "data/site.json"), false);
  assert.equal(canPublish(cashier, "public/menu/x.webp"), false);
  assert.equal(canPublish(staff(["sections"]), "data/menu.json"), true);
  assert.equal(canPublish(staff(["items"]), "data/site.json"), false);
  assert.equal(canPublish(staff(["shop"]), "data/site.json"), true);
});

test("a settings save only changes what this user may change", () => {
  // A cashier can't change anything here, whatever they send.
  assert.deepEqual(mergeShop(current, tampered, cashier), current);

  // Payment methods only.
  const pay = mergeShop(current, tampered, staff(["payments"]));
  assert.equal(pay.payments[0].accountName, "Attacker");
  assert.equal(pay.ordersEnabled, true);
  assert.deepEqual(pay.whatsapp, current.whatsapp);
  assert.deepEqual(pay.email, current.email);

  // Settings access: ordering and notifications, but never the WhatsApp number or key.
  const set = mergeShop(current, tampered, manager);
  assert.equal(set.ordersEnabled, false);
  assert.equal(set.email.address, "attacker@example.com");
  assert.equal(set.whatsapp.enabled, false);
  assert.equal(set.whatsapp.phone, "+96170000001");
  assert.equal(set.whatsapp.apiKey, "real-key");

  // The super admin changes everything.
  assert.deepEqual(mergeShop(current, tampered, admin), tampered);
});

test("staff never read the CallMeBot key", () => {
  assert.equal(shopForUser(current, manager).whatsapp.apiKey, "");
  assert.equal(shopForUser(current, manager).whatsapp.phone, "+96170000001");
  assert.equal(shopForUser(current, admin).whatsapp.apiKey, "real-key");
});
