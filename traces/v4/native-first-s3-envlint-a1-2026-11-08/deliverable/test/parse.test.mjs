import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../src/parse.mjs";

test("exports parse returning { pairs, problems }", () => {
  const r = parse("A=1");
  assert.ok(Array.isArray(r.pairs) && Array.isArray(r.problems));
});
test("simple pair", () => {
  assert.deepEqual(parse("A=1").pairs, [{ key: "A", value: "1", line: 1 }]);
});
test("comment line yields nothing", () => {
  assert.deepEqual(parse("# hi"), { pairs: [], problems: [] });
});
test("blank lines yield nothing but count", () => {
  const r = parse("\n\nA=1");
  assert.deepEqual(r.problems, []);
  assert.equal(r.pairs[0].line, 3);
});
test("export prefix", () => {
  const p = parse("export A=1").pairs[0];
  assert.equal(p.key, "A");
  assert.equal(p.value, "1");
});
test("single quotes", () => {
  assert.equal(parse("A='x y'").pairs[0].value, "x y");
});
test("double quotes keep #", () => {
  assert.equal(parse('A="x # y"').pairs[0].value, "x # y");
});
test("problems carry 1-based lines", () => {
  assert.equal(parse("A=1\nJUNK").problems[0].line, 2);
  assert.equal(parse("1BAD=x").problems[0].line, 1);
  assert.equal(parse('A="open').problems[0].line, 1);
});
test("parse.mjs has no import statement", () => {
  const src = readFileSync(new URL("../src/parse.mjs", import.meta.url), "utf8");
  assert.equal(/^\s*import[\s{("'*]/m.test(src), false);
});
test("no interpolation", () => {
  assert.equal(parse("A=$" + "{B}").pairs[0].value, "$" + "{B}");
});
test("empty inputs", () => {
  assert.deepEqual(parse(""), { pairs: [], problems: [] });
  assert.deepEqual(parse("# only\n\n"), { pairs: [], problems: [] });
});
test("never throws", () => {
  const rnd = Array.from({ length: 5000 }, () => String.fromCharCode(Math.random() * 256)).join("");
  for (const s of ["=", "\0\n'", rnd]) {
    assert.doesNotThrow(() => parse(s));
  }
});
