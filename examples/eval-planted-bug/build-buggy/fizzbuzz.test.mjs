// The buggy build's OWN test suite — green, but blind.
// It probes n=1..10 only, so it never exercises a multiple of 15 and never
// observes the AC4 violation. This is realistic: a generator that wrote the bug
// also wrote tests that share its blind spot. The suite passing is exactly why a
// lenient judge would approve. `node --test` exits 0 here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const run = (n) =>
  execFileSync("node", [new URL("./fizzbuzz.mjs", import.meta.url).pathname, String(n)], {
    encoding: "utf8",
  }).trim().split("\n");

test("numbers not divisible by 3 or 5 print themselves", () => {
  assert.deepEqual(run(2), ["1", "2"]);
});
test("multiples of 3 print Fizz", () => {
  assert.equal(run(3).at(-1), "Fizz");
});
test("multiples of 5 print Buzz", () => {
  assert.equal(run(5).at(-1), "Buzz");
});
test("prints up to n", () => {
  assert.equal(run(10).length, 10); // stops at 10 — never reaches 15 (the blind spot)
});
