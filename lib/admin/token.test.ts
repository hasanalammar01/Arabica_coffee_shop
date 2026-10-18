import assert from "node:assert/strict";
import { test } from "node:test";
import { signToken, verifyToken } from "./token.ts";

const now = 1_000_000;
const later = now + 60_000;

test("a session token verifies only with the same secret, kind and before it expires", () => {
  const token = signToken("pw|pin|0", "", later);
  assert.equal(verifyToken("pw|pin|0", "", token, now), true);
  assert.equal(verifyToken("pw|pin|0", "", token, later + 1), false); // expired
  assert.equal(verifyToken("pw|pin|1", "", token, now), false); // "sign out all devices" bumped the epoch
  assert.equal(verifyToken("new-pw|pin|0", "", token, now), false); // password changed
  assert.equal(verifyToken("", "", token, now), false); // no login configured
});

test("a PIN-pending token can never pass as a session (and the reverse)", () => {
  const pending = signToken("pw|pin|0", "pin:", later);
  assert.equal(verifyToken("pw|pin|0", "pin:", pending, now), true);
  assert.equal(verifyToken("pw|pin|0", "", pending, now), false);
  assert.equal(verifyToken("pw|pin|0", "pin:", signToken("pw|pin|0", "", later), now), false);
});

test("tampered or malformed tokens are refused", () => {
  const token = signToken("pw||0", "", later);
  const [expires, sig] = token.split(".");
  assert.equal(verifyToken("pw||0", "", `${Number(expires) + 99999999}.${sig}`, now), false); // extended expiry
  assert.equal(verifyToken("pw||0", "", `${expires}.${sig.slice(0, -2)}xx`, now), false);
  for (const bad of [undefined, "", "abc", ".", "123.", ".sig", "1e99.sig"]) assert.equal(verifyToken("pw||0", "", bad, now), false);
});
