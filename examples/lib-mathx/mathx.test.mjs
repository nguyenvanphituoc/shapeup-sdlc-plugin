// Green suite for the `test` oracle (the PASS fixture). Run with: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { add, clamp } from "./mathx.mjs";

test("add sums two numbers", () => {
  assert.equal(add(2, 3), 5);
});

test("clamp holds within bounds", () => {
  assert.equal(clamp(5, 0, 10), 5);
});

test("clamp pins to the low/high edges", () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});
