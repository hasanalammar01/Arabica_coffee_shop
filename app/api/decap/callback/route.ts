import { NextResponse, type NextRequest } from "next/server";
import { scriptJson } from "@/lib/script-json";

/**
 * Step 2 of the admin login: GitHub sends the editor back here with a code, which
 * is swapped for a token and handed to the admin window (Decap CMS popup protocol).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("decap_oauth_state")?.value;

  let content: { token: string; provider: "github" } | { error: string };
  if (!code || !state || state !== expected) {
    content = { error: "Login expired or was tampered with. Close this window and try again." };
  } else {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error_description?: string;
    };
    content = data.access_token
      ? { token: data.access_token, provider: "github" }
      : { error: data.error_description ?? "GitHub didn't accept the login. Try again." };
  }

  const message = `authorization:github:${"token" in content ? "success" : "error"}:${JSON.stringify(content)}`;
  // Only the admin page on this same site may receive the token.
  const html = `<!doctype html><meta charset="utf-8"><title>Signing in…</title><p>Signing in…</p><script>
const message = ${scriptJson(message)};
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data !== "authorizing:github") return;
  window.opener.postMessage(message, e.origin);
});
window.opener && window.opener.postMessage("authorizing:github", location.origin);
</script>`;

  const response = new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
  response.cookies.delete({ name: "decap_oauth_state", path: "/api/decap" });
  return response;
}
