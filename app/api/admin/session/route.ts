import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE,
  isSignedIn,
  passwordMatches,
  passwordSet,
  sameOrigin,
  sessionCookie,
} from "@/lib/admin/auth";
import { mode } from "@/lib/admin/store";

/** Is this browser signed in to the admin, and where will changes be saved? */
export function GET(req: NextRequest) {
  return NextResponse.json(
    { signedIn: isSignedIn(req), mode: mode() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Sign in with the staff password. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse("Not allowed.", { status: 403 });
  if (!passwordSet())
    return new NextResponse(
      "The admin password isn't set up yet. Add ADMIN_PASSWORD in Vercel (see README).",
      {
        status: 503,
      },
    );
  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== "string" || !passwordMatches(password)) {
    // Slows down guessing. ponytail: per-request delay only; add a rate limiter (e.g. Vercel KV) if abused.
    await new Promise((r) => setTimeout(r, 1000));
    return new NextResponse("Wrong password. Try again.", { status: 401 });
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(sessionCookie());
  return res;
}

/** Sign out. */
export function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse("Not allowed.", { status: 403 });
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete({ name: COOKIE, path: "/api/admin" });
  return res;
}
