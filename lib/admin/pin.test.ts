import assert from "node:assert/strict";
import { test } from "node:test";
import { pinProblem } from "./pin.ts";

test("a PIN is 4 digits and not trivially guessable", () => {
  for (const ok of ["4829", "0937", "2580", "1357"]) assert.equal(pinProblem(ok), null, ok);
  for (const bad of ["", "123", "12345", "12a4", " 482", "٤٨٢٩"]) assert.match(pinProblem(bad)!, /4 digits/, bad);
  for (const easy of ["0000", "7777", "1234", "6789", "4321", "9876", "0123"]) assert.match(pinProblem(easy)!, /easy/, easy);
});
