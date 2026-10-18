import { NextResponse, type NextRequest } from "next/server";
import { dbConfigured } from "@/lib/db";
import { currentUser, sameOrigin } from "./auth.ts";
import { can, type AdminUser, type Page } from "./permissions.ts";

/**
 * The check at the top of every admin API route. `pages`: the user needs at least one of them;
 * `adminOnly`: super admin only. Returns the user, or the response that refuses the request.
 */
export async function guard(
  req: NextRequest,
  opts: { write?: boolean; pages?: Page[]; adminOnly?: boolean; needsDb?: boolean } = {},
): Promise<{ user: AdminUser } | { refuse: NextResponse }> {
  const text = (message: string, status: number) => ({ refuse: new NextResponse(message, { status }) });
  if (opts.write && !sameOrigin(req)) return text("Not allowed.", 403);
  const user = await currentUser(req);
  if (!user) return text("Your session ended. Sign in again.", 401);
  if (opts.needsDb && !dbConfigured())
    return text("The database isn't connected. In Vercel → Storage, connect the Neon database, then redeploy.", 503);
  if (opts.adminOnly && user.role !== "admin") return text("Only the super admin can do this.", 403);
  if (opts.pages && !opts.pages.some((p) => can(user, p))) return text("You don't have access to this page.", 403);
  return { user };
}
