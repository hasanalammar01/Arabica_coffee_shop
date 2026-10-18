import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE,
  checkLogin,
  currentUser,
  hashPassword,
  attemptFailed,
  attemptsBlocked,
  attemptSucceeded,
  passwordSet,
  PIN_COOKIE,
  pinMatches,
  pinPending,
  pinPendingCookie,
  pinResetMatches,
  newPinResetCode,
  pinSet,
  sameOrigin,
  sessionCookie,
} from "@/lib/admin/auth";
import { PAGES } from "@/lib/admin/permissions";
import { mode } from "@/lib/admin/store";
import { readJson } from "@/lib/http";
import { pinProblem } from "@/lib/admin/pin";
import {
  dbConfigured,
  findStaff,
  getSettings,
  limited,
  logActivity,
  markSignedIn,
  markSignedOut,
  recordHit,
  saveSettings,
} from "@/lib/db";
import { sendWhatsApp } from "@/lib/notify";

/** Is this browser signed in to the admin, and where will changes be saved? */
export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  return NextResponse.json(
    {
      signedIn: Boolean(user),
      mode: mode(),
      orders: dbConfigured(),
      // Only told to a signed-in super admin (no free hints for attackers).
      pin: user?.role === "admin" ? await pinSet() : undefined,
      user: user && { name: user.name, role: user.role, pages: user.role === "admin" ? [...PAGES] : user.pages },
    },
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
  // Wrong passwords, PINs and codes are limited per connection and across all connections.
  const blocked = await attemptsBlocked(req);
  if (blocked) return new NextResponse(blocked, { status: 429 });
  const body = ((await readJson(req, 2_000)) ?? {}) as Record<string, unknown>;
  const fail = async (step: string, message: string) => {
    await attemptFailed(req, step);
    return new NextResponse(message, { status: 401 });
  };
  const again = () => new NextResponse("Sign in with your password again.", { status: 401 });

  // Forgot PIN (only after a correct password): a one-time code to the admin's WhatsApp.
  if (body.action === "pin-reset-request") {
    if (!(await pinPending(req))) return again();
    const { whatsapp } = await getSettings();
    if (!whatsapp.phone || !whatsapp.apiKey)
      return new NextResponse("No WhatsApp number is set up for PIN reset. Ask your developer to reset the PIN.", {
        status: 409,
      });
    if (await limited("pin-reset:send", 3, 60))
      return new NextResponse("A code was already sent 3 times this hour. Wait a little, then try again.", { status: 429 });
    const code = await newPinResetCode();
    await logActivity((await getSettings()).username, "Requested a PIN reset code by WhatsApp");
    await recordHit("pin-reset:send");
    try {
      await sendWhatsApp(
        whatsapp,
        `Arabica admin: your PIN reset code is ${code}. It expires in 10 minutes. If you didn't ask for this, change your password.`,
      );
    } catch {
      return new NextResponse("The WhatsApp message couldn't be sent. Try again in a minute.", { status: 502 });
    }
    return NextResponse.json({ sentTo: `•••• ${whatsapp.phone.replace(/\D/g, "").slice(-3)}` });
  }

  if (body.action === "pin-reset") {
    if (!(await pinPending(req))) return again();
    if (typeof body.code !== "string" || !(await pinResetMatches(body.code))) {
      await logActivity((await getSettings()).username, "Wrong PIN reset code");
      return fail("reset-code", "That code is wrong or has expired.");
    }
    const newPin = typeof body.newPin === "string" ? body.newPin : "";
    const problem = pinProblem(newPin);
    if (problem) return new NextResponse(problem, { status: 400 });
    await saveSettings({ pinHash: hashPassword(newPin), pinReset: "" });
    await attemptSucceeded(req, "pin-reset");
    await logActivity((await getSettings()).username, "Reset the sign-in PIN with a WhatsApp code and signed in");
    // The new PIN changes the signing secret: every other session ends, this one starts fresh.
    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(await sessionCookie());
    res.cookies.delete({ name: PIN_COOKIE, path: "/api/admin" });
    return res;
  }

  // Step 2: the PIN, only after a correct password in the last 5 minutes.
  if ("pin" in body) {
    if (!(await pinPending(req))) return again();
    const admin = (await getSettings()).username;
    if (typeof body.pin !== "string" || !(await pinMatches(body.pin))) {
      await logActivity(admin, "Wrong PIN");
      return fail("pin", "Wrong PIN. Try again.");
    }
    await attemptSucceeded(req, "pin");
    await logActivity(admin, "Signed in");
    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(await sessionCookie());
    res.cookies.delete({ name: PIN_COOKIE, path: "/api/admin" });
    return res;
  }

  // Step 1: username and password, for the super admin or a staff account.
  const { username, password } = body;
  const who = typeof username === "string" && typeof password === "string" ? await checkLogin(username, password) : null;
  if (!who) {
    // Name the account only if it exists: a password typed into the username box must never be logged.
    const name = typeof username === "string" ? username.trim().toLowerCase() : "";
    const known = name && (name === (await getSettings()).username.toLowerCase() || (await findStaff(name)));
    await logActivity(known ? name : "(unknown)", known ? "Wrong password" : "Sign-in with an unknown username");
    return fail("password", "Wrong username or password. Try again.");
  }
  // Staff have no PIN step.
  if (who !== "admin") {
    await attemptSucceeded(req, `password:staff:${who.username}`);
    await markSignedIn(who.id);
    await logActivity(who.username, "Signed in");
    const res = NextResponse.json({ pin: false });
    res.cookies.set(await sessionCookie(who));
    return res;
  }
  // Wrong attempts are only forgiven once the whole sign-in succeeds.
  if (await pinSet()) {
    const res = NextResponse.json({ pin: true });
    res.cookies.set(await pinPendingCookie());
    return res;
  }
  await attemptSucceeded(req, "password");
  await logActivity((await getSettings()).username, "Signed in");
  const res = NextResponse.json({ pin: false });
  res.cookies.set(await sessionCookie());
  return res;
}

/** Sign out. */
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse("Not allowed.", { status: 403 });
  const user = await currentUser(req);
  if (user && dbConfigured()) {
    if (user.role === "staff") await markSignedOut(user.id);
    await logActivity(user.name, "Signed out");
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete({ name: COOKIE, path: "/api/admin" });
  res.cookies.delete({ name: PIN_COOKIE, path: "/api/admin" });
  return res;
}
