import { NextResponse, type NextRequest } from "next/server";
import { isSignedIn, sameOrigin } from "@/lib/admin/auth";
import { dbConfigured, ordersOverview, setOrderStatus } from "@/lib/db";
import { readJson } from "@/lib/http";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders-core";

const text = (message: string, status: number) => new NextResponse(message, { status });

async function guard(req: NextRequest, write: boolean) {
  if (write && !sameOrigin(req)) return text("Not allowed.", 403);
  if (!(await isSignedIn(req))) return text("Your session ended. Sign in again.", 401);
  if (!dbConfigured()) return text("The database isn't connected yet.", 503);
  return null;
}

/** Latest orders, the number of new ones, and statistics. The admin polls this. */
export async function GET(req: NextRequest) {
  const denied = await guard(req, false);
  if (denied) return denied;
  return NextResponse.json(await ordersOverview(), { headers: { "Cache-Control": "no-store" } });
}

/** Change an order's status: { id, status }. */
export async function PATCH(req: NextRequest) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const { id, status } = ((await readJson(req, 1_000)) ?? {}) as { id?: unknown; status?: unknown };
  if (!Number.isInteger(id) || !ORDER_STATUSES.includes(status as OrderStatus)) return text("Bad request.", 400);
  if (!(await setOrderStatus(id as number, status as OrderStatus))) return text("That order doesn't exist.", 404);
  return new NextResponse(null, { status: 204 });
}
