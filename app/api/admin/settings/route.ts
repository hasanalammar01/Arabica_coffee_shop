import { NextResponse, type NextRequest } from "next/server";
import {
  credentialsMatch,
  hashPassword,
  isSignedIn,
  LOGIN_TRIES,
  MIN_PASSWORD,
  pinMatches,
  sameOrigin,
  sessionCookie,
} from "@/lib/admin/auth";
import { clientKey, dbConfigured, getSettings, limited, recordHit, saveSettings } from "@/lib/db";
import { pinProblem } from "@/lib/admin/pin";
import { readJson } from "@/lib/http";
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
  const settings = await getSettings();
  return NextResponse.json(
    {
      // An allow-list: login secrets (password, PIN, reset code) never leave the server.
      shop: cleanShopSettings(settings),
      username: settings.username,
      passwordInDatabase: Boolean(settings.passwordHash),
      pinSet: Boolean(settings.pinHash),
      emailReady: Boolean(process.env.RESEND_API_KEY),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Save online orders, payment methods and notifications. */
export async function PUT(req: NextRequest) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const body = await readJson(req, 50_000);
  // A broken or oversized body must never be saved as "empty settings".
  if (!body || typeof body !== "object") return text("That change can't be saved.", 400);
  const shop = cleanShopSettings(body);

  // The WhatsApp number receives "forgot PIN" codes, so changing it needs the PIN: otherwise a
  // stolen password alone could point the codes at another phone.
  const current = await getSettings();
  const numberChanged = shop.whatsapp.phone !== current.whatsapp.phone || shop.whatsapp.apiKey !== current.whatsapp.apiKey;
  if (current.pinHash && numberChanged) {
    const key = clientKey(req.headers, "login");
    if (await limited(key, LOGIN_TRIES, 15)) return text("Too many wrong attempts. Wait 15 minutes, then try again.", 429);
    const pin = (body as { currentPin?: unknown }).currentPin;
    if (typeof pin !== "string" || !(await pinMatches(pin))) {
      await recordHit(key);
      return text("Enter your PIN to change the WhatsApp number or key.", 401);
    }
  }

  await saveSettings(shop);
  return NextResponse.json({ shop });
}

const USERNAME = /^[a-z0-9._-]{3,40}$/i;

/**
 * { action: "test", channel }, { action: "account", currentPassword, currentPin, username, newPassword }
 * or { action: "pin", currentPassword, currentPin, newPin }.
 */
export async function POST(req: NextRequest) {
  const denied = await guard(req, true);
  if (denied) return denied;
  const body = ((await readJson(req, 5_000)) ?? {}) as Record<string, unknown>;
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

  if (body.action !== "account" && body.action !== "pin") return text("Unknown action.", 400);

  // Both need the current password, and the current PIN once one exists. This shares the
  // sign-in limit, so a stolen session can't be used to guess either.
  const key = clientKey(req.headers, "login");
  if (await limited(key, LOGIN_TRIES, 15)) return text("Too many wrong attempts. Wait 15 minutes, then try again.", 429);
  const refuse = async (message: string) => {
    await recordHit(key);
    await new Promise((r) => setTimeout(r, 1000));
    return text(message, 401);
  };
  if (typeof body.currentPassword !== "string" || !(await credentialsMatch(settings.username, body.currentPassword)))
    return refuse("The current password is wrong.");
  if (settings.pinHash && (typeof body.currentPin !== "string" || !(await pinMatches(body.currentPin))))
    return refuse("The PIN is wrong.");

  if (body.action === "pin") {
    const newPin = typeof body.newPin === "string" ? body.newPin : "";
    const problem = pinProblem(newPin);
    if (problem) return text(problem, 400);
    await saveSettings({ pinHash: hashPassword(newPin) });
    // A new PIN signs every other session out; keep this one signed in.
    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(await sessionCookie());
    return res;
  }

  {
    const { username, newPassword } = body;
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
}
