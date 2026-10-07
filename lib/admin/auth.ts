import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Staff sign in to /admin with one shared password (ADMIN_PASSWORD, set in Vercel).
 * The session is a signed cookie; changing the password signs everyone out.
 */
export const COOKIE = "arabica_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

const password = () => process.env.ADMIN_PASSWORD ?? "";
export const passwordSet = () => password().length > 0;

/** `npm run dev` without ADMIN_PASSWORD: the admin opens without a login. */
export const openInDev = () => process.env.NODE_ENV === "development" && !passwordSet();

const digest = (s: string) => createHash("sha256").update(s).digest();
const sign = (value: string) =>
  createHmac("sha256", digest(`arabica-admin:${password()}`))
    .update(value)
    .digest("base64url");

export const passwordMatches = (input: string) =>
  passwordSet() && timingSafeEqual(digest(input), digest(password()));

export function sessionCookie() {
  const expires = String(Date.now() + MAX_AGE * 1000);
  return {
    name: COOKIE,
    value: `${expires}.${sign(expires)}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/admin",
    maxAge: MAX_AGE,
  };
}

export function isSignedIn(req: NextRequest) {
  if (openInDev()) return true;
  if (!passwordSet()) return false;
  const [expires, signature] = (req.cookies.get(COOKIE)?.value ?? "").split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Rejects requests sent from other websites (the cookie is SameSite=Strict too). */
export const sameOrigin = (req: NextRequest) => req.headers.get("origin") === req.nextUrl.origin;
