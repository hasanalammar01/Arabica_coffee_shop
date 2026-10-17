import { NextResponse, type NextRequest } from "next/server";
import {
  credentialsMatch,
  hashPassword,
  isSignedIn,
  LOGIN_TRIES,
  MIN_PASSWORD,
  sameOrigin,
  sessionCookie,
} from "@/lib/admin/auth";
import { clientKey, dbConfigured, getSettings, limited, recordHit, saveSettings } from "@/lib/db";
import { sendEmail, sendWhatsApp } from "@/lib/notify";
import { cleanShopSettings } from "@/lib/orders-core";

const text = (message: string, status: number) => new NextResponse(message, { status });
const NO_DB = "The database isn't connected. In Vercel → Storage, connect the Neon database, then redeploy.";
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(req: NextRequest, write: boolean) {
  if (write && !sameOrigin(req)) return text("Not allowed.", 403);
  if (!(await isSignedIn(req))) return text("Your session ended. Sign in again.", 401);
  if (!dbConfigured()) return text(NO_DB, 503);
  return null;
}

/** Everything the Settings and Payment methods screens show (never the password hash). */
export async function GET(req: NextRequest) {
  const denied = await guard(req, false);
  if (denied) return denied;
  const { username, passwordHash, ...shop } = await getSettings();
  return NextResponse.json(
    { shop, username, passwordInDatabase: Boolean(passwordHash), emailReady: Boolean(process.env.RESEND_API_KEY) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Save online orders, payment methods and notifications. */
export async function PUT(req: NextRequest) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const shop = cleanShopSettings(await req.json().catch(() => null));
  await saveSettings(shop);
  return NextResponse.json({ shop });
}

const USERNAME = /^[a-z0-9._-]{3,40}$/i;

/** { action: "account", currentPassword, username, newPassword } or { action: "test", channel }. */
export async function POST(req: NextRequest) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const settings = await getSettings();

  if (body.action === "test") {
    const message = "Arabica: test notification. New orders will arrive like this.";
    try {
      if (body.channel === "whatsapp") await sendWhatsApp(settings.whatsapp, message);
      else if (body.channel === "email") await sendEmail(settings.email, "Arabica: test notification", message);
      else return text("Unknown channel.", 400);
    } catch (e) {
      return text(errorText(e), 400);
    }
    return new NextResponse(null, { status: 204 });
  }

  if (body.action === "account") {
    const { currentPassword, username, newPassword } = body;
    // Shares the sign-in limit, so a stolen session can't be used to guess the password.
    const key = clientKey(req.headers, "login");
    if (await limited(key, LOGIN_TRIES, 15)) return text("Too many wrong passwords. Wait 15 minutes, then try again.", 429);
    if (typeof currentPassword !== "string" || !(await credentialsMatch(settings.username, currentPassword))) {
      await recordHit(key);
      await new Promise((r) => setTimeout(r, 1000));
      return text("The current password is wrong.", 401);
    }
    if (typeof username !== "string" || !USERNAME.test(username.trim()))
      return text("The username needs 3 to 40 letters, numbers, dots, dashes or underscores.", 400);
    if (typeof newPassword !== "string" || (newPassword && newPassword.length < MIN_PASSWORD))
      return text(`The new password needs at least ${MIN_PASSWORD} characters.`, 400);
    if (newPassword && newPassword.toLowerCase().includes(username.trim().toLowerCase()))
      return text("The password can't contain the username.", 400);
    await saveSettings({
      username: username.trim(),
      ...(newPassword && { passwordHash: hashPassword(newPassword) }),
    });
    // A new password signs every session out; keep this one signed in.
    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(await sessionCookie());
    return res;
  }

  return text("Unknown action.", 400);
}
