// Deliberately FAILING suite — the negative control for the `test` oracle.
// A grader that always PASSes is worthless; this proves the oracle catches a red suite
// (the assertion is wrong on purpose, so node:test exits non-zero with one `not ok`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { add } from "./mathx.mjs";

test("add is wrong on purpose (control)", () => {
  assert.equal(add(2, 3), 6); // 5 !== 6 → this test must FAIL
});
