import { NextResponse, type NextRequest } from "next/server";
import {
  attemptFailed,
  attemptsBlocked,
  checkLogin,
  credentialsMatch,
  hashPassword,
  MIN_PASSWORD,
  pinMatches,
  sessionCookie,
  signOutEverywhere,
} from "@/lib/admin/auth";
import { guard } from "@/lib/admin/guard";
import { can, mergeShop, shopForUser } from "@/lib/admin/permissions";
import { pinProblem } from "@/lib/admin/pin";
import { findStaff, getSettings, saveSettings, updateStaff } from "@/lib/db";
import { readJson } from "@/lib/http";
import { sendEmail, sendWhatsApp } from "@/lib/notify";
import { cleanShopSettings } from "@/lib/orders-core";

const text = (message: string, status: number) => new NextResponse(message, { status });
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const USERNAME = /^[a-z0-9._-]{3,40}$/i;

/** What the Settings and Payment methods screens show this user (never a password, PIN or key hash). */
export async function GET(req: NextRequest) {
  const g = await guard(req, { needsDb: true });
  if ("refuse" in g) return g.refuse;
  const { user } = g;
  const settings = await getSettings();
  const admin = user.role === "admin";
  return NextResponse.json(
    {
      shop: can(user, "payments") || can(user, "settings") ? shopForUser(cleanShopSettings(settings), user) : null,
      username: user.name,
      role: user.role,
      ...(admin && { passwordInDatabase: Boolean(settings.passwordHash), pinSet: Boolean(settings.pinHash) }),
      emailReady: Boolean(process.env.RESEND_API_KEY),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Save payment methods and/or ordering and notifications, each only if this user may. */
export async function PUT(req: NextRequest) {
  const g = await guard(req, { write: true, pages: ["payments", "settings"], needsDb: true });
  if ("refuse" in g) return g.refuse;
  const body = await readJson(req, 50_000);
  // A broken or oversized body must never be saved as "empty settings".
  if (!body || typeof body !== "object") return text("That change can't be saved.", 400);

  const current = await getSettings();
  const shop = mergeShop(cleanShopSettings(current), cleanShopSettings(body), g.user);

  // The WhatsApp number receives "forgot PIN" codes, so changing it needs the PIN: otherwise a
  // stolen password alone could point the codes at another phone. (Staff can't change it at all.)
  const numberChanged = shop.whatsapp.phone !== current.whatsapp.phone || shop.whatsapp.apiKey !== current.whatsapp.apiKey;
  if (current.pinHash && numberChanged) {
    const blocked = await attemptsBlocked(req);
    if (blocked) return text(blocked, 429);
    const pin = (body as { currentPin?: unknown }).currentPin;
    if (typeof pin !== "string" || !(await pinMatches(pin))) {
      await attemptFailed(req, "settings-pin");
      return text("Enter your PIN to change the WhatsApp number or key.", 401);
    }
  }

  await saveSettings(shop);
  return NextResponse.json({ shop: shopForUser(shop, g.user) });
}

/**
 * { action: "test", channel } (Settings access), { action: "my-password" } (staff, own password),
 * and super admin only: "signout-all", "account" (login) and "pin".
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { write: true, needsDb: true });
  if ("refuse" in g) return g.refuse;
  const { user } = g;
  const body = ((await readJson(req, 5_000)) ?? {}) as Record<string, unknown>;
  const settings = await getSettings();
  const adminOnly = () => text("Only the super admin can do this.", 403);

  if (body.action === "test") {
    if (!can(user, "settings")) return text("You don't have access to this page.", 403);
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

  // Ends every session, the super admin's and all staff; this browser gets a fresh one.
  if (body.action === "signout-all") {
    if (user.role !== "admin") return adminOnly();
    await signOutEverywhere();
    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(await sessionCookie());
    return res;
  }

  const known = ["my-password", "account", "pin"];
  if (!known.includes(body.action as string)) return text("Unknown action.", 400);
  if (body.action === "my-password" ? user.role !== "staff" : user.role !== "admin") return adminOnly();

  // Every login change needs the current password (and the super admin's PIN once set). This
  // shares the sign-in limits, so a stolen session can't be used to guess either.
  const blocked = await attemptsBlocked(req);
  if (blocked) return text(blocked, 429);
  const refuse = async (message: string) => {
    await attemptFailed(req, `settings-${body.action}`);
    return text(message, 401);
  };
  const newPasswordProblem = (password: unknown, username: string) =>
    typeof password !== "string" || (password && password.length < MIN_PASSWORD)
      ? `The new password needs at least ${MIN_PASSWORD} characters.`
      : password && password.toLowerCase().includes(username.toLowerCase())
        ? "The password can't contain the username."
        : null;

  if (body.action === "my-password" && user.role === "staff") {
    const me = typeof body.currentPassword === "string" ? await checkLogin(user.name, body.currentPassword) : null;
    if (!me || me === "admin" || me.id !== user.id) return refuse("The current password is wrong.");
    const problem = newPasswordProblem(body.newPassword, user.name) ?? (body.newPassword ? null : "Type a new password.");
    if (problem) return text(problem, 400);
    const updated = await updateStaff(user.id, { passwordHash: hashPassword(body.newPassword as string) });
    // The change ends this account's other sessions; keep this one signed in.
    const res = new NextResponse(null, { status: 204 });
    if (updated) res.cookies.set(await sessionCookie(updated));
    return res;
  }

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

  // "account": the super admin's username and password.
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!USERNAME.test(username)) return text("The username needs 3 to 40 letters, numbers, dots, dashes or underscores.", 400);
  if (await findStaff(username)) return text("A staff account already uses that username.", 400);
  const problem = newPasswordProblem(body.newPassword, username);
  if (problem) return text(problem, 400);
  await saveSettings({
    username,
    ...(body.newPassword ? { passwordHash: hashPassword(body.newPassword as string) } : {}),
  });
  // A new password signs every session out; keep this one signed in.
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(await sessionCookie());
  return res;
}
