import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/** Step 1 of the admin login: send the editor to GitHub to sign in. */
export function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET)
    return new NextResponse(
      "Admin login isn't set up yet: add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to the hosting environment variables (see README).",
      { status: 500 },
    );

  const state = randomBytes(16).toString("hex");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${req.nextUrl.origin}/api/decap/callback`);
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set("decap_oauth_state", state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/decap",
    maxAge: 600,
  });
  return res;
}
