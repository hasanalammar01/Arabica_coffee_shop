import { NextResponse, type NextRequest } from "next/server";
import { guard } from "@/lib/admin/guard";
import { listActivity } from "@/lib/db";

/** The activity log (last 300 entries, optionally one person's): super admin only. */
export async function GET(req: NextRequest) {
  const g = await guard(req, { adminOnly: true, needsDb: true });
  if ("refuse" in g) return g.refuse;
  const actor = req.nextUrl.searchParams.get("actor")?.slice(0, 60) || undefined;
  return NextResponse.json(await listActivity(actor), { headers: { "Cache-Control": "no-store" } });
}
