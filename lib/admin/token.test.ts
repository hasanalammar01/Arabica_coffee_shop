import assert from "node:assert/strict";
import { test } from "node:test";
import { signToken, tokenUser, verifyToken } from "./token.ts";

const now = 1_000_000;
const later = now + 60_000;

test("a session token verifies only with the same secret, kind and before it expires", () => {
  const token = signToken("pw|pin|0", "", "admin", later);
  assert.equal(verifyToken("pw|pin|0", "", token, now), true);
  assert.equal(verifyToken("pw|pin|0", "", token, later + 1), false); // expired
  assert.equal(verifyToken("pw|pin|1", "", token, now), false); // "sign out all devices" bumped the epoch
  assert.equal(verifyToken("new-pw|pin|0", "", token, now), false); // password changed
  assert.equal(verifyToken("", "", token, now), false); // no login configured / account disabled
});

test("a PIN-pending token can never pass as a session (and the reverse)", () => {
  const pending = signToken("pw|pin|0", "pin:", "admin", later);
  assert.equal(verifyToken("pw|pin|0", "pin:", pending, now), true);
  assert.equal(verifyToken("pw|pin|0", "", pending, now), false);
  assert.equal(verifyToken("pw|pin|0", "pin:", signToken("pw|pin|0", "", "admin", later), now), false);
});

test("a token is bound to its user: a staff token can't be relabelled as the super admin", () => {
  const staff = signToken("staff-secret", "", "s12", later);
  assert.equal(tokenUser(staff), "s12");
  assert.equal(verifyToken("staff-secret", "", staff, now), true);
  // Swap the user part: the signature no longer matches, even with the same secret.
  assert.equal(verifyToken("staff-secret", "", staff.replace(/^s12\./, "admin."), now), false);
  assert.equal(verifyToken("staff-secret", "", staff.replace(/^s12\./, "s13."), now), false);
});

test("tampered or malformed tokens are refused", () => {
  const token = signToken("pw||0", "", "admin", later);
  const [user, expires, sig] = token.split(".");
  assert.equal(verifyToken("pw||0", "", `${user}.${Number(expires) + 99999999}.${sig}`, now), false); // extended
  assert.equal(verifyToken("pw||0", "", `${user}.${expires}.${sig.slice(0, -2)}xx`, now), false);
  for (const bad of [undefined, "", "abc", "..", "admin..sig", "admin.123.", "root.123.sig", "admin.1e99.sig"])
    assert.equal(verifyToken("pw||0", "", bad, now), false, String(bad));
  for (const bad of [undefined, "", "root.1.x", "s.1.x", "../etc.1.x"]) assert.equal(tokenUser(bad), null, String(bad));
});
