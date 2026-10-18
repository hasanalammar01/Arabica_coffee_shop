import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring cookie values: "<expires ms>.<HMAC>". The secret is derived from the login
 * (password, PIN, session epoch), so changing any of them invalidates every token. `kind` keeps
 * token types apart: a "pin:" (password done, PIN pending) token never verifies as a session.
 */
const key = (secret: string) => createHash("sha256").update(`arabica-admin:${secret}`).digest();
const mac = (secret: string, kind: string, expires: string) =>
  createHmac("sha256", key(secret)).update(kind + expires).digest("base64url");

export const signToken = (secret: string, kind: string, expires: number) =>
  `${expires}.${mac(secret, kind, String(expires))}`;

export function verifyToken(secret: string, kind: string, value: string | undefined, now = Date.now()) {
  if (!secret || !value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || !/^[0-9]+$/.test(expires) || Number(expires) < now) return false;
  const expected = Buffer.from(mac(secret, kind, expires));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
