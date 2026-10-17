import assert from "node:assert/strict";
import { test } from "node:test";
import { readJson } from "./http.ts";

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x/api", { method: "POST", body, headers });

test("JSON bodies are read only when small and well-formed", async () => {
  assert.deepEqual(await readJson(req('{"a":1}'), 100), { a: 1 });
  assert.equal(await readJson(req("x".repeat(200)), 100), null); // too big, whatever the header says
  assert.equal(await readJson(req("{}", { "content-length": "999999" }), 100), null); // header says too big
  assert.equal(await readJson(req("{not json"), 100), null);
  assert.equal(await readJson(req(""), 100), null);
  // Size is counted in bytes: 40 Arabic letters are 80 bytes.
  assert.equal(await readJson(req(JSON.stringify("ب".repeat(40))), 60), null);
});
