import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "../src/parse.mjs";

test("KEY=value with line numbers and trimming", () => {
  const r = parseEnv("A=1\n  B = two  \n");
  assert.deepEqual(r.pairs, [{ key: "A", value: "1", line: 1 }, { key: "B", value: "two", line: 2 }]);
  assert.deepEqual(r.problems, []);
});
test("comments ignored", () => {
  assert.deepEqual(parseEnv("  # c\nA=1").pairs, [{ key: "A", value: "1", line: 2 }]);
});
test("blank lines ignored", () => {
  assert.deepEqual(parseEnv("\n   \t\nA=1").pairs.map((p) => p.line), [3]);
});
test("export prefix", () => {
  assert.deepEqual(parseEnv("export KEY=value").pairs, [{ key: "KEY", value: "value", line: 1 }]);
});
test("quotes, no escapes", () => {
  const r = parseEnv("S='a b'\nD=\"c d\"\nE=\"a\\nb\"");
  assert.deepEqual(r.pairs.map((p) => p.value), ["a b", "c d", "a\\nb"]);
});
test("problems carry line and skip", () => {
  const r = parseEnv("A=1\nnoequals\n1BAD=x\nQ=\"open\nZ=2");
  assert.deepEqual(r.pairs.map((p) => p.key), ["A", "Z"]);
  assert.deepEqual(r.problems.map((p) => p.line), [2, 3, 4]);
});
test("no rules import", () => {
  const src = readFileSync(new URL("../src/parse.mjs", import.meta.url), "utf8");
  assert.ok(!/\bimport\b/.test(src.replace(/\/\/.*$/gm, "")));
});
test("no interpolation", () => {
  assert.equal(parseEnv("A=$" + "{HOME}").pairs[0].value, "$" + "{HOME}");
});
test("empty and comments-only", () => {
  assert.deepEqual(parseEnv(""), { pairs: [], problems: [] });
  assert.deepEqual(parseEnv("# a\n# b"), { pairs: [], problems: [] });
});
test("never throws", () => {
  for (const t of ["", "=", "'", '"', "\u0000�\udc80=\xff", "A=\r\n\r"]) {
    assert.doesNotThrow(() => parseEnv(t));
  }
});
