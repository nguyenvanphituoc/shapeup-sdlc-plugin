import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkRules } from "../src/rules.mjs";

const p = (key, value, line = 1) => ({ key, value, line });
const one = (type, value) => checkRules([p("K", value, 3)], { K: { type } });

test("exports checkRules returning findings and schemaErrors", () => {
  assert.deepEqual(checkRules([], {}), { findings: [], schemaErrors: [] });
});

test("bad schema shapes yield schemaErrors and no findings", () => {
  const bad = [{ A: 1 }, { A: { foo: 1 } }, { A: { type: "float" } }, { A: { enum: [1] } }, { A: { enum: "x" } }, { A: { required: "yes" } }];
  for (const s of bad) {
    const r = checkRules([p("A", "x")], s);
    assert.ok(r.schemaErrors.length > 0);
    assert.deepEqual(r.findings, []);
  }
});

test("required", () => {
  assert.deepEqual(checkRules([], { K: { required: true } }).findings, [
    { key: "K", line: null, rule: "required", message: "required key is missing" },
  ]);
  assert.deepEqual(checkRules([p("K", "")], { K: { required: true } }).findings, []);
});

test("type string/bool and line", () => {
  assert.deepEqual(one("string", "anything").findings, []);
  assert.deepEqual(one("bool", "true").findings, []);
  assert.deepEqual(one("bool", "false").findings, []);
  const f = one("bool", "True").findings;
  assert.equal(f.length, 1);
  assert.equal(f[0].rule, "type");
  assert.equal(f[0].line, 3);
  assert.equal(f[0].message, 'expected bool, got "True"');
});

test("int boundaries", () => {
  for (const v of ["0", "-3"]) assert.deepEqual(one("int", v).findings, []);
  for (const v of ["", "1.5", "+1"]) assert.equal(one("int", v).findings.length, 1);
});

test("url", () => {
  for (const v of ["https://x.com/p", "postgres://u@h:5432/db"]) assert.deepEqual(one("url", v).findings, []);
  for (const v of ["foo:bar", "localhost:3000", "http://", "not a url"]) assert.equal(one("url", v).findings[0].rule, "type");
});

test("enum", () => {
  const s = { K: { enum: ["a", "b"] } };
  assert.deepEqual(checkRules([p("K", "a")], s).findings, []);
  const f = checkRules([p("K", "c")], s).findings;
  assert.equal(f[0].rule, "enum");
  assert.equal(f[0].message, 'expected one of a|b, got "c"');
});

test("last duplicate wins", () => {
  assert.deepEqual(checkRules([p("K", "x", 1), p("K", "5", 2)], { K: { type: "int" } }).findings, []);
});

test("null/array/string schema returns schemaErrors without throwing", () => {
  for (const s of [null, [], "x"]) {
    const r = checkRules([], s);
    assert.ok(r.schemaErrors.length > 0);
    assert.deepEqual(r.findings, []);
  }
});

test("rules.mjs is pure: no parse import, no network", () => {
  const src = readFileSync(new URL("../src/rules.mjs", import.meta.url), "utf8");
  assert.ok(!/\bimport\b/.test(src));
  assert.ok(!/parse/i.test(src));
  assert.ok(!/\b(https?|net|fetch)\b/.test(src));
});
