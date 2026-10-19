import { after, NextResponse } from "next/server";
import type { SiteData } from "@/data/site";
import { getMenuData, getSiteData } from "@/lib/content-store";
import { addOrder, clientKey, dbConfigured, getSettings, limited, recordHit } from "@/lib/db";
import { localTime, openNow } from "@/lib/hours";
import { buildMenu, publicMenu } from "@/lib/menu-core";
import { readJson } from "@/lib/http";
import { notifyAdmin } from "@/lib/notify";
import { orderMessage, paymentReady, validateOrder, type PublicPayment } from "@/lib/orders-core";

/** Orders are taken during opening hours (or any time if no hours are set yet). */
const shopOpen = (site: SiteData) =>
  (!site.hours.length && !site.specialHours.length) ||
  openNow(site.hours, site.specialHours, localTime(new Date(), site.timeZone)).open;

const noStore = { headers: { "Cache-Control": "no-store" } };
const ORDERS_PER_10_MIN = 5;

/** Public: is online ordering on, is the shop open, and which payment methods to offer. */
export async function GET() {
  const [settings, site] = await Promise.all([dbConfigured() ? getSettings() : null, getSiteData()]);
  // Only complete, enabled methods; every field here is meant for customers.
  const payments: PublicPayment[] = (settings?.payments ?? []).filter(paymentReady);
  return NextResponse.json(
    { enabled: Boolean(settings?.ordersEnabled), open: shopOpen(site), payments },
    noStore,
  );
}

/** Public: place an order. Prices are recomputed from the menu; the browser's are ignored. */
export async function POST(req: Request) {
  // Only the café's own checkout page may send orders (browsers always send Origin on POST).
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return NextResponse.json({ error: "invalid" }, { status: 403 });
  if (!dbConfigured()) return NextResponse.json({ error: "disabled" }, { status: 503 });

  const key = clientKey(req.headers, "order");
  if (await limited(key, ORDERS_PER_10_MIN, 10))
    return NextResponse.json({ error: "tooMany" }, { status: 429 });

  const [settings, menuData, site] = await Promise.all([getSettings(), getMenuData(), getSiteData()]);
  // Read current prices and availability for every checkout. Checking image files here would
  // bundle the photos into the ordering function; content is already validated on publish.
  const menu = publicMenu(buildMenu(menuData));
  const result = validateOrder(await readJson(req, 20_000), { menu, settings, open: shopOpen(site) });
  if ("error" in result) return NextResponse.json(result, { status: 400 });

  const order = await addOrder(result.order);
  await recordHit(key);
  // Notify after answering so the customer isn't kept waiting on WhatsApp/email. Capped at 60 an
  // hour, so a flood of fake orders can't spam the admin's phone or get the WhatsApp key blocked;
  // capped orders are still saved and show in the admin.
  after(async () => {
    if (await limited("notify:order", 60, 60)) {
      console.warn(JSON.stringify({ event: "order_notification_capped", order: order.id }));
      return;
    }
    await recordHit("notify:order");
    await notifyAdmin(settings, `New order #${order.id}`, orderMessage(order));
  });
  return NextResponse.json({ id: order.id, total: order.total }, noStore);
}
