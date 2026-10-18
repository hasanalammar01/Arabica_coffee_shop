/**
 * Online orders: the rules shared by the site, the server and the admin. Browser-safe and
 * free of database code so it can be unit-tested. The server always re-prices a cart from
 * the menu; prices sent by the browser are never trusted.
 */
import type { MenuCategory, MenuItem, Modifier } from "../data/menu.ts";

export const ORDER_STATUSES = ["new", "accepted", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Each kind asks the admin for its own details. Only details a customer needs to *pay the
 * café* are stored: never card numbers or CVVs (card payments happen on a card machine).
 */
export const PAYMENT_KINDS = ["cash", "whish", "card", "bank", "other"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export type PaymentMethod = {
  id: string;
  kind: PaymentKind;
  name: string;
  nameAr: string;
  enabled: boolean;
  /** whish: the number to send to. */
  phone: string;
  /** whish, bank: whose account it is. */
  accountName: string;
  /** card: accepted cards, e.g. "Visa, Mastercard". */
  cards: string;
  /** bank */
  bank: string;
  iban: string;
  /** An extra note (for "other", the whole instructions). */
  details: string;
  detailsAr: string;
};

/** The fields each kind must have before customers are offered it. */
export const REQUIRED_FIELDS: Record<PaymentKind, (keyof PaymentMethod)[]> = {
  cash: [],
  whish: ["phone", "accountName"],
  card: ["cards"],
  bank: ["bank", "accountName", "iban"],
  other: ["details"],
};

export const paymentReady = (p: PaymentMethod) => p.enabled && REQUIRED_FIELDS[p.kind].every((f) => String(p[f]).trim());

/** Everything a customer may see about a method (the public API sends this). */
export type PublicPayment = Omit<PaymentMethod, "enabled">;

/** What the admin edits under Online orders and Settings (everything except the login). */
export type ShopSettings = {
  ordersEnabled: boolean;
  payments: PaymentMethod[];
  whatsapp: { enabled: boolean; phone: string; apiKey: string };
  email: { enabled: boolean; address: string };
};

/**
 * Stored settings. An empty passwordHash means "use ADMIN_PASSWORD from Vercel"; an empty
 * pinHash means no PIN step at sign-in yet.
 */
export type Settings = ShopSettings & {
  username: string;
  passwordHash: string;
  pinHash: string;
  /** A pending "forgot PIN" code: "<hash>|<expires ms>", or "". */
  pinReset: string;
  /** Raised by "Sign out all devices": part of the session secret, so old sessions stop working. */
  sessionEpoch: number;
};

export const DEFAULT_SETTINGS: Settings = {
  username: "admin",
  passwordHash: "",
  pinHash: "",
  pinReset: "",
  sessionEpoch: 0,
  ordersEnabled: false,
  payments: [
    { id: "cash", kind: "cash", name: "Cash on delivery", nameAr: "الدفع نقداً عند الاستلام", enabled: true },
    { id: "whish", kind: "whish", name: "Whish Money", nameAr: "ويش موني", enabled: false },
    { id: "card", kind: "card", name: "Card on delivery", nameAr: "بطاقة عند الاستلام", enabled: false },
  ].map((p) => ({ phone: "", accountName: "", cards: "", bank: "", iban: "", details: "", detailsAr: "", ...p }) as PaymentMethod),
  whatsapp: { enabled: false, phone: "", apiKey: "" },
  email: { enabled: false, address: "" },
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown) => v === true;
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Cleans settings coming from the admin (or an older database row). */
export function cleanShopSettings(input: unknown): ShopSettings {
  const s = obj(input);
  const w = obj(s.whatsapp);
  const e = obj(s.email);
  const payments = (Array.isArray(s.payments) ? s.payments : DEFAULT_SETTINGS.payments)
    .slice(0, 12)
    .map((raw, i): PaymentMethod => {
      const p = obj(raw);
      const id = str(p.id, 40) || `method-${i + 1}`;
      // Methods saved before kinds existed: the default ids name their kind.
      const kind = [p.kind, id].find((k): k is PaymentKind => PAYMENT_KINDS.includes(k as PaymentKind)) ?? "other";
      return {
        id,
        kind,
        name: str(p.name, 60),
        nameAr: str(p.nameAr, 60),
        enabled: bool(p.enabled),
        phone: str(p.phone, 20),
        accountName: str(p.accountName, 80),
        cards: str(p.cards, 80),
        bank: str(p.bank, 80),
        iban: str(p.iban, 40),
        details: str(p.details, 300),
        detailsAr: str(p.detailsAr, 300),
      };
    })
    .filter((p) => p.name);
  return {
    ordersEnabled: bool(s.ordersEnabled),
    payments,
    whatsapp: { enabled: bool(w.enabled), phone: str(w.phone, 20), apiKey: str(w.apiKey, 60) },
    email: { enabled: bool(e.enabled), address: str(e.address, 120) },
  };
}

export const withDefaults = (stored: unknown): Settings => {
  const s = obj(stored);
  return {
    username: str(s.username, 40) || DEFAULT_SETTINGS.username,
    passwordHash: str(s.passwordHash, 300),
    pinHash: str(s.pinHash, 300),
    pinReset: str(s.pinReset, 300),
    sessionEpoch: Number.isInteger(s.sessionEpoch) ? (s.sessionEpoch as number) : 0,
    ...cleanShopSettings({ ...DEFAULT_SETTINGS, ...s }),
  };
};

/* ---------- Cart and pricing ---------- */

/** One cart line as the browser stores it. `mods` holds "groupId/choiceId" keys. */
export type CartLine = { id: string; size: string; option: string; mods: string[]; qty: number };

/** A priced line as saved with the order (a snapshot: later menu edits don't change it). */
export type OrderLine = {
  id: string;
  name: string;
  nameAr?: string;
  size: string;
  option: string;
  mods: { name: string; nameAr?: string; price: number }[];
  qty: number;
  unit: number;
  total: number;
};

export const MAX_QTY = 20;
export const MAX_LINES = 30;

/** How guests choose from a group, for headings: "Pick one", "Optional", "Up to 2", "Pick any". */
export const chooseHint = (
  g: Pick<Modifier, "min" | "max" | "choices">,
  d: { pickOne: string; optional: string; pickAny: string; upTo: (n: number) => string },
) => (g.max === 1 ? (g.min >= 1 ? d.pickOne : d.optional) : g.max < g.choices.length ? d.upTo(g.max) : d.pickAny);

/** Does this item need a choice before it can go in the cart? */
export const needsChoices = (item: MenuItem) =>
  item.prices.length > 1 || Boolean(item.options?.length) || Boolean(item.modifiers?.length);

/** Prices one line against the menu, or returns null if it no longer matches it. */
export function priceLine(items: Map<string, MenuItem>, line: CartLine): OrderLine | null {
  const item = items.get(line.id);
  if (!item || item.availability !== "available") return null;
  if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY) return null;

  const size = item.prices.find(([s]) => s === line.size);
  if (!size) return null;
  if (item.options?.length ? !item.options.includes(line.option) : line.option) return null;

  const mods: OrderLine["mods"] = [];
  const picked = new Set(line.mods);
  if (picked.size !== line.mods.length) return null;
  for (const group of item.modifiers ?? []) {
    const chosen = group.choices.filter((c) => picked.delete(`${group.id}/${c.id}`));
    if (chosen.length < group.min || chosen.length > group.max) return null;
    mods.push(...chosen.map((c) => ({ name: c.name, nameAr: c.nameAr, price: c.price })));
  }
  if (picked.size) return null; // a choice that doesn't exist (any more)

  const unit = size[1] + mods.reduce((sum, m) => sum + m.price, 0);
  return { id: item.id, name: item.name, nameAr: item.nameAr, size: line.size, option: line.option, mods, qty: line.qty, unit, total: unit * line.qty };
}

export const menuItems = (menu: MenuCategory[]) => new Map(menu.flatMap((c) => c.items.map((i) => [i.id, i])));

/* ---------- Placing an order ---------- */

export type OrderError = "disabled" | "closed" | "unavailable" | "invalid" | "tooMany";

export type NewOrder = {
  name: string;
  phone: string;
  fulfilment: "delivery" | "pickup";
  address: string;
  location: string;
  note: string;
  payment: string;
  items: OrderLine[];
  total: number;
  lang: "en" | "ar";
};

const PHONE = /^\+?[0-9 ()-]{7,20}$/;

/** Checks an order sent by the site. `open`: is the shop accepting orders right now. */
export function validateOrder(
  body: unknown,
  { menu, settings, open }: { menu: MenuCategory[]; settings: ShopSettings; open: boolean },
): { order: NewOrder } | { error: OrderError } {
  if (!settings.ordersEnabled) return { error: "disabled" };
  if (!open) return { error: "closed" };
  const b = obj(body);
  if (str(b.website, 10)) return { error: "invalid" }; // honeypot field: only bots fill it

  const name = str(b.name, 60);
  const phone = str(b.phone, 20);
  const fulfilment = b.fulfilment === "pickup" ? "pickup" : b.fulfilment === "delivery" ? "delivery" : null;
  const address = fulfilment === "delivery" ? str(b.address, 300) : "";
  const payment = settings.payments.find((p) => paymentReady(p) && p.id === b.payment);
  if (name.length < 2 || !PHONE.test(phone) || !fulfilment || (fulfilment === "delivery" && address.length < 5) || !payment)
    return { error: "invalid" };

  const lines = Array.isArray(b.lines) ? b.lines : [];
  if (!lines.length || lines.length > MAX_LINES) return { error: "invalid" };
  const items = menuItems(menu);
  const priced = lines.map((l) => {
    const raw = obj(l);
    const mods = Array.isArray(raw.mods) ? raw.mods.filter((m): m is string => typeof m === "string") : [];
    return priceLine(items, { id: str(raw.id, 80), size: str(raw.size, 40), option: str(raw.option, 80), mods, qty: Number(raw.qty) });
  });
  if (priced.some((p) => !p)) return { error: "unavailable" };

  const loc = obj(b.location);
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  const location =
    fulfilment === "delivery" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
      : "";

  const orderItems = priced as OrderLine[];
  return {
    order: {
      name,
      phone,
      fulfilment,
      address,
      location,
      note: str(b.note, 300),
      payment: payment.name,
      items: orderItems,
      total: orderItems.reduce((sum, l) => sum + l.total, 0),
      lang: b.lang === "ar" ? "ar" : "en",
    },
  };
}

/* ---------- Admin: notifications and statistics ---------- */

export type Order = NewOrder & { id: number; createdAt: string; status: OrderStatus };

const amount = (n: number) => `${n.toLocaleString("en-US")} L.L`;

export const lineLabel = (l: OrderLine) =>
  [l.name, [l.size, l.option, ...l.mods.map((m) => m.name)].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

/** The WhatsApp/email message for a new order. */
export function orderMessage(o: Pick<Order, "id" | "name" | "phone" | "fulfilment" | "address" | "location" | "note" | "payment" | "items" | "total">) {
  // Customer text stays on one line, so a note can't fake extra lines like "Payment: PAID".
  const line = (text: string) => text.replace(/\s+/g, " ").trim();
  const items = [`New order #${o.id}: ${amount(o.total)}`, ...o.items.map((l) => `${l.qty}× ${lineLabel(l)}`)];
  const customer = [
    `${line(o.name)} · ${line(o.phone)}`,
    o.fulfilment === "pickup" ? "Pickup at the café" : `Delivery: ${line(o.address)}`,
    o.location && `Map: ${o.location}`,
    o.note && `Note: ${line(o.note)}`,
    `Payment: ${o.payment}`,
  ].filter(Boolean);
  return `${items.join("\n")}\n\n${customer.join("\n")}`;
}

export type DayTotal = { day: string; orders: number; revenue: number };
export type Totals = { orders: number; revenue: number };

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Today / this week (from Monday) / this month, plus the last 30 days for the chart.
 * `days` are per-day totals in the shop's time zone, cancelled orders already left out.
 */
export function summarize(days: DayTotal[], today: string) {
  const sum = (from: string): Totals =>
    days
      .filter((d) => d.day >= from && d.day <= today)
      .reduce((t, d) => ({ orders: t.orders + d.orders, revenue: t.revenue + d.revenue }), { orders: 0, revenue: 0 });
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const byDay = new Map(days.map((d) => [d.day, d]));
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, i - 29);
    return byDay.get(day) ?? { day, orders: 0, revenue: 0 };
  });
  return { today: sum(today), week: sum(addDays(today, -weekday)), month: sum(`${today.slice(0, 8)}01`), last30 };
}
