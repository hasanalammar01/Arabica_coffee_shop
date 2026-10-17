import { after, NextResponse } from "next/server";
import { menuData } from "@/data/menu";
import { site } from "@/data/site";
import { addOrder, dbConfigured, getSettings } from "@/lib/db";
import { localTime, openNow } from "@/lib/hours";
import { buildMenu, publicMenu } from "@/lib/menu-core";
import { notifyAdmin } from "@/lib/notify";
import { orderMessage, validateOrder } from "@/lib/orders-core";

// Prices only: photos were already checked at build time, and checking public/ here
// would bundle every image into this function.
const menu = publicMenu(buildMenu(menuData));

/** Orders are taken during opening hours (or any time if no hours are set yet). */
const shopOpen = () =>
  (!site.hours.length && !site.specialHours.length) ||
  openNow(site.hours, site.specialHours, localTime(new Date(), site.timeZone)).open;

const noStore = { headers: { "Cache-Control": "no-store" } };

/** Public: is online ordering on, is the shop open, and which payment methods to offer. */
export async function GET() {
  const settings = dbConfigured() ? await getSettings() : null;
  return NextResponse.json(
    {
      enabled: Boolean(settings?.ordersEnabled),
      open: shopOpen(),
      payments: (settings?.payments ?? [])
        .filter((p) => p.enabled)
        .map(({ id, name, nameAr, details, detailsAr }) => ({ id, name, nameAr, details, detailsAr })),
    },
    noStore,
  );
}

/** Public: place an order. Prices are recomputed from the menu; the browser's are ignored. */
export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: "disabled" }, { status: 503 });
  const settings = await getSettings();
  const result = validateOrder(await req.json().catch(() => null), {
    menu,
    settings,
    open: shopOpen(),
  });
  if ("error" in result) return NextResponse.json(result, { status: 400 });

  const order = await addOrder(result.order);
  // Notify after answering so the customer isn't kept waiting on WhatsApp/email.
  after(() => notifyAdmin(settings, `New order #${order.id}`, orderMessage(order)));
  return NextResponse.json({ id: order.id, total: order.total }, noStore);
}
