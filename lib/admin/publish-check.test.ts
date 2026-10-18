import assert from "node:assert/strict";
import { test } from "node:test";
import { publishProblem } from "./publish-check.ts";

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64");
// The first bytes of a real WebP file: "RIFF", size, "WEBP", "VP8 ".
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]);

test("real WebP photos and JSON data are accepted", () => {
  assert.equal(publishProblem("public/menu/latte-ab12cd.webp", webp.toString("base64")), null);
  assert.equal(publishProblem("data/menu.json", b64('{"categories":[]}')), null);
});

test("disguised or broken files are refused", () => {
  assert.match(publishProblem("public/menu/x.webp", b64("<svg onload=alert(1)>"))!, /isn't a valid image/);
  assert.match(publishProblem("public/menu/x.webp", b64("<html><script>alert(1)</script>"))!, /isn't a valid image/);
  assert.match(publishProblem("public/menu/x.webp", "")!, /isn't a valid image/);
  assert.match(publishProblem("data/menu.json", b64("{broken"))!, /couldn't be read/);
  assert.match(publishProblem("data/site.json", b64("[]"))!, /couldn't be read/);
  assert.match(publishProblem("data/site.json", b64("null"))!, /couldn't be read/);
  assert.match(publishProblem("lib/admin/auth.ts", b64("export {}"))!, /can't be published/);
});
