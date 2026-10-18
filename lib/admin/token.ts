import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, expiring cookie values: "<user>.<expires ms>.<HMAC>". `user` is "admin" or "s<id>"
 * for a staff account. Each user's secret comes from their own login (password hash, PIN,
 * session epoch), so changing any of them, or disabling the account, invalidates their tokens.
 * `kind` keeps token types apart: a "pin:" (password done, PIN pending) token never verifies as
 * a session.
 */
const USER = /^(admin|s[0-9]{1,9})$/;
const key = (secret: string) => createHash("sha256").update(`arabica-admin:${secret}`).digest();
const mac = (secret: string, kind: string, user: string, expires: string) =>
  createHmac("sha256", key(secret)).update(`${kind}${user}.${expires}`).digest("base64url");

export const signToken = (secret: string, kind: string, user: string, expires: number) =>
  `${user}.${expires}.${mac(secret, kind, user, String(expires))}`;

/** Whose token this claims to be ("admin", "s12"), before checking it. Null if malformed. */
export function tokenUser(value: string | undefined) {
  const user = value?.split(".")[0] ?? "";
  return USER.test(user) ? user : null;
}

export function verifyToken(secret: string, kind: string, value: string | undefined, now = Date.now()) {
  if (!secret || !value) return false;
  const [user, expires, signature] = value.split(".");
  if (!USER.test(user ?? "") || !expires || !signature || !/^[0-9]+$/.test(expires) || Number(expires) < now) return false;
  const expected = Buffer.from(mac(secret, kind, user, expires));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
