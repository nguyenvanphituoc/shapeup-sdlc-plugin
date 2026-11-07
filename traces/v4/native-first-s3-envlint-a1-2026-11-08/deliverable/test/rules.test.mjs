import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check } from "../src/rules.mjs";

const one = (v, rule) => check([{ key: "A", value: v, line: 3 }], { A: rule });

test("missing required key", () => {
  const f = check([], { A: { required: true } });
  assert.deepEqual(f, [{ key: "A", line: null, message: "required key is missing" }]);
});

test("type string accepts any value", () => {
  for (const v of ["", "x", "80x", "yes"]) assert.deepEqual(one(v, { type: "string" }), []);
});

test("type int", () => {
  assert.equal(one("80x", { type: "int" }).length, 1);
  assert.equal(one("80x", { type: "int" })[0].message, 'expected int, got "80x"');
  assert.deepEqual(one("80", { type: "int" }), []);
  assert.deepEqual(one("-1", { type: "int" }), []);
});

test("type bool", () => {
  assert.equal(one("yes", { type: "bool" })[0].message, 'expected bool, got "yes"');
  assert.deepEqual(one("true", { type: "bool" }), []);
  assert.deepEqual(one("false", { type: "bool" }), []);
});

test("type url", () => {
  for (const v of ["foo", "http://", "a:b", "mailto:x@y"]) {
    const f = one(v, { type: "url" });
    assert.equal(f.length, 1, v);
    assert.equal(f[0].message, `expected url, got "${v}"`);
  }
  assert.deepEqual(one("https://example.com", { type: "url" }), []);
});

test("enum", () => {
  const r = { enum: ["dev", "prod"] };
  assert.equal(one("qa", r)[0].message, 'expected one of dev|prod, got "qa"');
  assert.deepEqual(one("dev", r), []);
});

test("rules module has no import statement", () => {
  const src = readFileSync(new URL("../src/rules.mjs", import.meta.url), "utf8");
  assert.ok(!/\bimport\b/.test(src));
});

test("url check never touches fetch", () => {
  const orig = globalThis.fetch;
  let called = false;
  globalThis.fetch = () => {
    called = true;
    throw new Error("network");
  };
  try {
    assert.deepEqual(one("https://example.invalid", { type: "url" }), []);
  } finally {
    globalThis.fetch = orig;
  }
  assert.equal(called, false);
});

test("empty schemas never throw", () => {
  assert.deepEqual(check([], {}), []);
  assert.deepEqual(check([], { A: {} }), []);
  assert.equal(check([{ key: "A", value: "x", line: 1 }], { A: { enum: [] } }).length, 1);
});

test("ordering: by line, then missing in schema order", () => {
  const f = check(
    [
      { key: "B", value: "x", line: 5 },
      { key: "A", value: "y", line: 2 },
    ],
    { Z: { required: true }, B: { type: "int" }, A: { type: "int" }, Y: { required: true } },
  );
  assert.deepEqual(f.map((x) => x.key), ["A", "B", "Z", "Y"]);
});
