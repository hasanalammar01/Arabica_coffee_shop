import { after, NextResponse } from "next/server";
import { menuData } from "@/data/menu";
import { site } from "@/data/site";
import { addOrder, clientKey, dbConfigured, getSettings, limited, recordHit } from "@/lib/db";
import { localTime, openNow } from "@/lib/hours";
import { buildMenu, publicMenu } from "@/lib/menu-core";
import { readJson } from "@/lib/http";
import { notifyAdmin } from "@/lib/notify";
import { orderMessage, paymentReady, validateOrder, type PublicPayment } from "@/lib/orders-core";

// Prices only: photos were already checked at build time, and checking public/ here
// would bundle every image into this function.
const menu = publicMenu(buildMenu(menuData));

/** Orders are taken during opening hours (or any time if no hours are set yet). */
const shopOpen = () =>
  (!site.hours.length && !site.specialHours.length) ||
  openNow(site.hours, site.specialHours, localTime(new Date(), site.timeZone)).open;

const noStore = { headers: { "Cache-Control": "no-store" } };
const ORDERS_PER_10_MIN = 5;

/** Public: is online ordering on, is the shop open, and which payment methods to offer. */
export async function GET() {
  const settings = dbConfigured() ? await getSettings() : null;
  // Only complete, enabled methods; every field here is meant for customers.
  const payments: PublicPayment[] = (settings?.payments ?? []).filter(paymentReady);
  return NextResponse.json({ enabled: Boolean(settings?.ordersEnabled), open: shopOpen(), payments }, noStore);
}

/** Public: place an order. Prices are recomputed from the menu; the browser's are ignored. */
export async function POST(req: Request) {
  // Only the café's own checkout page may send orders (browsers always send Origin on POST).
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return NextResponse.json({ error: "invalid" }, { status: 403 });
  if (!dbConfigured()) return NextResponse.json({ error: "disabled" }, { status: 503 });

  const key = clientKey(req.headers, "order");
  if (await limited(key, ORDERS_PER_10_MIN, 10)) return NextResponse.json({ error: "tooMany" }, { status: 429 });

  const settings = await getSettings();
  const result = validateOrder(await readJson(req, 20_000), { menu, settings, open: shopOpen() });
  if ("error" in result) return NextResponse.json(result, { status: 400 });

  const order = await addOrder(result.order);
  await recordHit(key);
  // Notify after answering so the customer isn't kept waiting on WhatsApp/email.
  after(() => notifyAdmin(settings, `New order #${order.id}`, orderMessage(order)));
  return NextResponse.json({ id: order.id, total: order.total }, noStore);
}
