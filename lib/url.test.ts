import assert from "node:assert/strict";
import { test } from "node:test";
import { safeHttpUrl } from "./url.ts";

test("only http(s) links survive", () => {
  assert.equal(safeHttpUrl("https://instagram.com/arabica"), "https://instagram.com/arabica");
  assert.equal(safeHttpUrl("  https://maps.app.goo.gl/abc  "), "https://maps.app.goo.gl/abc");
  for (const bad of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "//evil.example",
    "instagram.com/arabica",
    "",
    undefined,
  ])
    assert.equal(safeHttpUrl(bad), "", String(bad));
});
