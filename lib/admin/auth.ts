import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";

/**
 * Staff sign in to /admin with a username and password. Until the password is changed in
 * Settings (stored hashed in the database), it is ADMIN_PASSWORD from Vercel and the
 * username is "admin". Once a PIN is set, a correct password only earns a 5-minute "PIN
 * pending" cookie; the 4-digit PIN then turns it into the session. Sessions are signed
 * cookies; changing the password or the PIN signs everyone out.
 */
export const COOKIE = "arabica_admin";
export const PIN_COOKIE = "arabica_admin_pin";
const MAX_AGE = 60 * 60 * 12; // 12 hours
const PIN_MAX_AGE = 60 * 5;
/** Wrong passwords allowed per connection per 15 minutes (sign-in and password change). */
export const LOGIN_TRIES = 5;
export const MIN_PASSWORD = 10;

async function login() {
  const s = await getSettings();
  const env = process.env.ADMIN_PASSWORD ?? "";
  const password = s.passwordHash || env;
  // The PIN is part of the signing secret, so a new PIN invalidates every signed cookie.
  return { username: s.username, hash: s.passwordHash, env, pinHash: s.pinHash, secret: password && `${password}|${s.pinHash}` };
}

/** Hashes a password or a PIN (scrypt, random salt). */
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
const sign = (secret: string, value: string) =>
  createHmac("sha256", digest(`arabica-admin:${secret}`)).update(value).digest("base64url");

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

// The "pin:" prefix means a pending cookie can never pass as a session, even with the same secret.
async function signedCookie(name: string, kind: "" | "pin:", maxAge: number) {
  const { secret } = await login();
  const expires = String(Date.now() + maxAge * 1000);
  return {
    name,
    value: `${expires}.${sign(secret, kind + expires)}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/admin",
    maxAge,
  };
}

async function validCookie(req: NextRequest, name: string, kind: "" | "pin:") {
  const { secret } = await login();
  if (!secret) return false;
  const [expires, signature] = (req.cookies.get(name)?.value ?? "").split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(secret, kind + expires));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const sessionCookie = () => signedCookie(COOKIE, "", MAX_AGE);
/** Password was right; the PIN is still needed (5 minutes). */
export const pinPendingCookie = () => signedCookie(PIN_COOKIE, "pin:", PIN_MAX_AGE);
export const pinPending = (req: NextRequest) => validCookie(req, PIN_COOKIE, "pin:");

export async function isSignedIn(req: NextRequest) {
  if (await openInDev()) return true;
  return validCookie(req, COOKIE, "");
}

/** Rejects requests sent from other websites (the cookie is SameSite=Strict too). */
export const sameOrigin = (req: NextRequest) => req.headers.get("origin") === req.nextUrl.origin;
