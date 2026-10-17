import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSettings } from "@/lib/db";

/**
 * Staff sign in to /admin with a username and password. Until the password is changed in
 * Settings (stored hashed in the database), it is ADMIN_PASSWORD from Vercel and the
 * username is "admin". The session is a signed cookie; changing the password signs
 * everyone out.
 */
export const COOKIE = "arabica_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

async function login() {
  const s = await getSettings();
  const env = process.env.ADMIN_PASSWORD ?? "";
  return { username: s.username, hash: s.passwordHash, env, secret: s.passwordHash || env };
}

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

export async function sessionCookie() {
  const { secret } = await login();
  const expires = String(Date.now() + MAX_AGE * 1000);
  return {
    name: COOKIE,
    value: `${expires}.${sign(secret, expires)}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/admin",
    maxAge: MAX_AGE,
  };
}

export async function isSignedIn(req: NextRequest) {
  if (await openInDev()) return true;
  const { secret } = await login();
  if (!secret) return false;
  const [expires, signature] = (req.cookies.get(COOKIE)?.value ?? "").split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(secret, expires));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Rejects requests sent from other websites (the cookie is SameSite=Strict too). */
export const sameOrigin = (req: NextRequest) => req.headers.get("origin") === req.nextUrl.origin;
