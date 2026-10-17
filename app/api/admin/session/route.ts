import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE,
  credentialsMatch,
  isSignedIn,
  LOGIN_TRIES,
  passwordSet,
  sameOrigin,
  sessionCookie,
} from "@/lib/admin/auth";
import { mode } from "@/lib/admin/store";
import { readJson } from "@/lib/http";
import { clearHits, clientKey, dbConfigured, limited, recordHit } from "@/lib/db";

/** Is this browser signed in to the admin, and where will changes be saved? */
export async function GET(req: NextRequest) {
  return NextResponse.json(
    { signedIn: await isSignedIn(req), mode: mode(), orders: dbConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Sign in with the admin username and password. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse("Not allowed.", { status: 403 });
  if (!(await passwordSet()))
    return new NextResponse("The admin password isn't set up yet. Add ADMIN_PASSWORD in Vercel (see README).", {
      status: 503,
    });
  // 5 wrong tries from one connection lock sign-in there for 15 minutes.
  const key = clientKey(req.headers, "login");
  if (await limited(key, LOGIN_TRIES, 15))
    return new NextResponse("Too many wrong passwords. Wait 15 minutes, then try again.", { status: 429 });
  const { username, password } = ((await readJson(req, 2_000)) ?? {}) as { username?: unknown; password?: unknown };
  if (typeof username !== "string" || typeof password !== "string" || !(await credentialsMatch(username, password))) {
    await recordHit(key);
    await new Promise((r) => setTimeout(r, 1000));
    return new NextResponse("Wrong username or password. Try again.", { status: 401 });
  }
  await clearHits(key);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(await sessionCookie());
  return res;
}

/** Sign out. */
export function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse("Not allowed.", { status: 403 });
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete({ name: COOKIE, path: "/api/admin" });
  return res;
}
