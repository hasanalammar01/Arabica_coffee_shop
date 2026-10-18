import assert from "node:assert/strict";
import { test } from "node:test";
import { credentialsPdf } from "./credentials-pdf.ts";

const pdf = credentialsPdf({
  username: "rana",
  password: "kq7m-3tzp-9hwx",
  signInUrl: "https://arabica-deli-cafe.vercel.app/admin",
  pages: ["Menu items", "Orders"],
  date: "18 Oct 2026",
});

test("the PDF is well-formed: header, end, and every object exactly where the index says", () => {
  assert.ok(pdf.startsWith("%PDF-1.4\n"));
  assert.ok(pdf.endsWith("%%EOF\n"));
  const startxref = Number(pdf.match(/startxref\n(\d+)\n%%EOF\n$/)![1]);
  assert.ok(pdf.slice(startxref).startsWith("xref\n0 8\n"));
  const offsets = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 7);
  offsets.forEach((o, i) => assert.ok(pdf.slice(o).startsWith(`${i + 1} 0 obj\n`), `object ${i + 1}`));
  // The content stream's declared length matches its real length.
  const [, len, body] = pdf.match(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/)!;
  assert.equal(body.length, Number(len));
});

test("it contains the sign-in details, and PDF syntax in a value can't break it", () => {
  for (const s of ["(rana)", "(kq7m-3tzp-9hwx)", "(https://arabica-deli-cafe.vercel.app/admin)", "(Menu items, Orders)"])
    assert.ok(pdf.includes(s), s);
  const tricky = credentialsPdf({ username: "a(b)c\\", password: "p) Tj (x", signInUrl: "u", pages: ["Ä"], date: "d" });
  assert.ok(tricky.includes("(a\\(b\\)c\\\\)"));
  assert.ok(tricky.includes("(p\\) Tj \\(x)"));
  assert.ok(tricky.includes("(?)"));
  assert.match(tricky, /^[\x09\x0a\x20-\x7e]*$/); // pure ASCII, so byte offsets stay right
});
