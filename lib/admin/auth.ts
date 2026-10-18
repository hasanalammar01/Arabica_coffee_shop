import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  clearHits,
  clientKey,
  dbConfigured,
  findStaff,
  getSettings,
  getStaff,
  limited,
  recordHit,
  saveSettings,
  signOutAllStaff,
  type StaffRow,
} from "@/lib/db";
import type { AdminUser } from "./permissions.ts";
import { signToken, tokenUser, verifyToken } from "./token.ts";

/**
 * Staff sign in to /admin with a username and password. Until the password is changed in
 * Settings (stored hashed in the database), it is ADMIN_PASSWORD from Vercel and the
 * username is "admin". Once a PIN is set, a correct password only earns a 5-minute "PIN
 * pending" cookie; the 4-digit PIN then turns it into the session. Sessions are signed
 * cookies; changing the password or the PIN, or "Sign out all devices", ends every session.
 */
export const COOKIE = "arabica_admin";
export const PIN_COOKIE = "arabica_admin_pin";
const MAX_AGE = 60 * 60 * 12; // 12 hours
const PIN_MAX_AGE = 60 * 5;
/** Wrong attempts allowed per connection per 15 minutes (sign-in, PIN, codes, Settings checks). */
export const LOGIN_TRIES = 5;
/** Wrong attempts allowed from all connections together per 15 minutes (spread-out guessing). */
const LOGIN_TRIES_ALL = 20;
export const MIN_PASSWORD = 10;

async function login() {
  const s = await getSettings();
  const env = process.env.ADMIN_PASSWORD ?? "";
  const password = s.passwordHash || env;
  // Password, PIN and epoch together sign the cookies, so changing any of them ends every session.
  return {
    username: s.username,
    hash: s.passwordHash,
    env,
    pinHash: s.pinHash,
    secret: password && `${password}|${s.pinHash}|${s.sessionEpoch}`,
  };
}

/** Hashes a password, PIN or reset code (scrypt, random salt). */
export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

function matchesHash(password: string, stored: string) {
  const [, salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const given = scryptSync(password, salt, 64);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export const passwordSet = async () => Boolean((await login()).secret);

/** `npm run dev` with no password anywhere: the admin opens without a login. */
export const openInDev = async () => process.env.NODE_ENV === "development" && !(await passwordSet());

export async function credentialsMatch(username: string, password: string) {
  const l = await login();
  if (!l.secret) return false;
  const userOk = timingSafeEqual(digest(username.trim().toLowerCase()), digest(l.username.toLowerCase()));
  const passwordOk = l.hash ? matchesHash(password, l.hash) : timingSafeEqual(digest(password), digest(l.env));
  return userOk && passwordOk;
}

export const pinSet = async () => Boolean((await login()).pinHash);

export async function pinMatches(pin: string) {
  const { pinHash } = await login();
  return Boolean(pinHash) && matchesHash(pin, pinHash);
}

/** "Forgot PIN": a one-time 6-digit code, valid 10 minutes, stored only as a hash. */
export async function newPinResetCode() {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await saveSettings({ pinReset: `${hashPassword(code)}|${Date.now() + 10 * 60_000}` });
  return code;
}

export async function pinResetMatches(code: string) {
  const [hash, expires] = (await getSettings()).pinReset.split("|");
  return Boolean(hash) && Number(expires) > Date.now() && /^[0-9]{6}$/.test(code) && matchesHash(code, hash);
}

/** Ends every session, the super admin's and all staff (the caller issues itself a fresh cookie). */
export async function signOutEverywhere() {
  await saveSettings({ sessionEpoch: (await getSettings()).sessionEpoch + 1 });
  await signOutAllStaff();
}

/* ---------- Guessing limits, shared by every check of a password, PIN or code ---------- */

const ALL = "login:all";

/** A message if sign-in checks are paused for this connection, or for everyone. */
export async function attemptsBlocked(req: NextRequest) {
  if (await limited(clientKey(req.headers, "login"), LOGIN_TRIES, 15))
    return "Too many wrong attempts. Wait 15 minutes, then try again.";
  if (await limited(ALL, LOGIN_TRIES_ALL, 15))
    return "Sign-in is paused for 15 minutes after many wrong attempts. Try again later.";
  return null;
}

/** Records a wrong password, PIN or code (and logs it, without the guess). */
export async function attemptFailed(req: NextRequest, step: string) {
  const key = clientKey(req.headers, "login");
  await Promise.all([recordHit(key), recordHit(ALL)]);
  console.warn(JSON.stringify({ event: "admin_auth_failed", step, client: key }));
  await new Promise((r) => setTimeout(r, 1000)); // slows scripted guessing
}

/** Forgives this connection's wrong attempts once a whole sign-in succeeds. */
export async function attemptSucceeded(req: NextRequest, step: string) {
  const key = clientKey(req.headers, "login");
  await clearHits(key);
  console.info(JSON.stringify({ event: "admin_auth_ok", step, client: key }));
}

/* ---------- Who is signed in ---------- */

/** A staff account's signing secret; "" once disabled, so none of its cookies verify. */
const staffSecret = (s: StaffRow) => (s.active ? `staff|${s.id}|${s.passwordHash}|${s.sessionEpoch}` : "");

// Hashed against when a username doesn't exist, so the response time doesn't reveal which names do.
const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));

/** Checks a username and password: the super admin first, then the staff accounts. */
export async function checkLogin(username: string, password: string): Promise<"admin" | StaffRow | null> {
  if (await credentialsMatch(username, password)) return "admin";
  if (!dbConfigured()) return null;
  const staff = await findStaff(username);
  const ok = matchesHash(password, staff?.passwordHash ?? DUMMY_HASH);
  return staff && ok && staff.active ? staff : null;
}

/** Who this request's session belongs to, or null. */
export async function currentUser(req: NextRequest): Promise<AdminUser | null> {
  if (await openInDev()) return { role: "admin", name: "Local editor" };
  const value = req.cookies.get(COOKIE)?.value;
  const user = tokenUser(value);
  if (user === "admin") {
    const l = await login();
    return verifyToken(l.secret, "", value) ? { role: "admin", name: l.username } : null;
  }
  if (user && dbConfigured()) {
    const staff = await getStaff(Number(user.slice(1)));
    if (staff && verifyToken(staffSecret(staff), "", value))
      return { role: "staff", id: staff.id, name: staff.username, pages: staff.pages };
  }
  return null;
}

export const isSignedIn = async (req: NextRequest) => Boolean(await currentUser(req));

/* ---------- Cookies ---------- */

const cookie = (name: string, value: string, maxAge: number) => ({
  name,
  value,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/admin",
  maxAge,
});

/** A 12-hour session for the super admin (default) or a staff account. */
export async function sessionCookie(user: "admin" | StaffRow = "admin") {
  const expires = Date.now() + MAX_AGE * 1000;
  const value =
    user === "admin"
      ? signToken((await login()).secret, "", "admin", expires)
      : signToken(staffSecret(user), "", `s${user.id}`, expires);
  return cookie(COOKIE, value, MAX_AGE);
}

/** Super admin only: password was right; the PIN is still needed (5 minutes). */
export const pinPendingCookie = async () =>
  cookie(PIN_COOKIE, signToken((await login()).secret, "pin:", "admin", Date.now() + PIN_MAX_AGE * 1000), PIN_MAX_AGE);
export const pinPending = async (req: NextRequest) =>
  verifyToken((await login()).secret, "pin:", req.cookies.get(PIN_COOKIE)?.value);

/** Rejects requests sent from other websites (the cookie is SameSite=Strict too). */
export const sameOrigin = (req: NextRequest) => req.headers.get("origin") === req.nextUrl.origin;
