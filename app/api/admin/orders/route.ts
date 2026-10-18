import { NextResponse, type NextRequest } from "next/server";
import { guard } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { logActivity, ordersOverview, setOrderStatus } from "@/lib/db";
import { readJson } from "@/lib/http";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders-core";

/**
 * Latest orders and statistics, polled by the admin. Each part only goes to someone allowed to
 * see it: the order list (customers' names, phones, addresses) needs "Orders", the money figures
 * need "Statistics".
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { pages: ["orders", "stats"], needsDb: true });
  if ("refuse" in g) return g.refuse;
  const all = await ordersOverview();
  const orders = can(g.user, "orders");
  return NextResponse.json(
    {
      orders: orders ? all.orders : [],
      newOrders: orders ? all.newOrders : 0,
      stats: can(g.user, "stats") ? all.stats : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Change an order's status: { id, status }. */
export async function PATCH(req: NextRequest) {
  const g = await guard(req, { write: true, pages: ["orders"], needsDb: true });
  if ("refuse" in g) return g.refuse;
  const { id, status } = ((await readJson(req, 1_000)) ?? {}) as { id?: unknown; status?: unknown };
  if (!Number.isInteger(id) || !ORDER_STATUSES.includes(status as OrderStatus))
    return new NextResponse("Bad request.", { status: 400 });
  if (!(await setOrderStatus(id as number, status as OrderStatus)))
    return new NextResponse("That order doesn't exist.", { status: 404 });
  await logActivity(g.user.name, `Order #${id}: marked ${status}`);
  return new NextResponse(null, { status: 204 });
}
