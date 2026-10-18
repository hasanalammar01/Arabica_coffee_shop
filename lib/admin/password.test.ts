import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePassword } from "./password.ts";

test("generated passwords are 3 groups of 4 easy-to-read characters, and differ every time", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const p = generatePassword();
    assert.match(p, /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/, p);
    assert.doesNotMatch(p, /[01ilo]/, p);
    seen.add(p);
  }
  assert.equal(seen.size, 2000);
  assert.ok(generatePassword().length >= 10); // passes the 10-character rule
});

test("every character is used about equally (no bias towards some letters)", () => {
  const counts = new Map<string, number>();
  for (let i = 0; i < 3000; i++) for (const c of generatePassword().replace(/-/g, "")) counts.set(c, (counts.get(c) ?? 0) + 1);
  assert.equal(counts.size, 31);
  const expected = (3000 * 12) / 31; // ≈ 1161
  for (const [c, n] of counts) assert.ok(Math.abs(n - expected) < expected * 0.2, `${c}: ${n}`);
});
