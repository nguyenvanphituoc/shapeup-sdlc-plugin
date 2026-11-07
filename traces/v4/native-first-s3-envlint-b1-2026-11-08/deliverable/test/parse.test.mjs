import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../src/parse.mjs";

test("parse returns { pairs, problems }", () => {
  const out = parse("A=1");
  assert.deepEqual(Object.keys(out).sort(), ["pairs", "problems"]);
  assert.deepEqual(out.pairs, [{ key: "A", value: "1", line: 1 }]);
  assert.deepEqual(out.problems, []);
});

test("TS-INV-01: pure — no node:fs or rules import, deterministic", () => {
  const src = readFileSync(new URL("../src/parse.mjs", import.meta.url), "utf8");
  const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l) || /\bimport\s*\(/.test(l) || /\brequire\s*\(/.test(l));
  for (const l of imports) {
    assert.ok(!/["'](node:)?fs["']/.test(l), `fs import found: ${l}`);
    assert.ok(!/rules(\.mjs)?["']/.test(l), `rules import found: ${l}`);
  }
  const text = "A=1\nGARBAGE\nexport B='x'\n";
  assert.deepEqual(parse(text), parse(text));
});

test("TS-REQ-text-forms: assignments, comments, blanks, export, quotes, CRLF", () => {
  const text = [
    "KEY=value",
    "# comment",
    "",
    "   ",
    "export K=v",
    "S='single'",
    'D="double"',
  ].join("\r\n");
  const out = parse(text);
  assert.deepEqual(out.problems, []);
  assert.deepEqual(out.pairs, [
    { key: "KEY", value: "value", line: 1 },
    { key: "K", value: "v", line: 5 },
    { key: "S", value: "single", line: 6 },
    { key: "D", value: "double", line: 7 },
  ]);
});

test("comment lines produce no pair and no problem", () => {
  assert.deepEqual(parse("# comment\n  # indented comment"), { pairs: [], problems: [] });
});

test("blank and whitespace-only lines produce no pair and no problem", () => {
  assert.deepEqual(parse("\n   \n\t\n"), { pairs: [], problems: [] });
});

test("export KEY=value yields {key:'KEY', value:'value'}", () => {
  const out = parse("export KEY=value");
  assert.equal(out.pairs.length, 1);
  assert.equal(out.pairs[0].key, "KEY");
  assert.equal(out.pairs[0].value, "value");
  assert.deepEqual(out.problems, []);
});

test("inline # after = is part of the value (PD-5)", () => {
  assert.equal(parse("A=x # y").pairs[0].value, "x # y");
});

test("duplicates are kept in order (PD-6)", () => {
  assert.deepEqual(parse("A=1\nA=2").pairs.map((p) => p.value), ["1", "2"]);
});

test("TS-ERR-PARSE_UNCLOSED_QUOTE", () => {
  const out = parse('A="open');
  assert.equal(out.pairs.length, 0);
  assert.equal(out.problems.length, 1);
  assert.equal(out.problems[0].line, 1);
  assert.equal(parse("A='open").problems.length, 1);
  assert.equal(parse(`A='mixed"`).problems.length, 1);
  assert.equal(parse('A="').problems.length, 1);
});

test("TS-ERR-PARSE_NO_EQUALS", () => {
  const out = parse("A=1\nGARBAGE\n");
  assert.deepEqual(out.problems.map((p) => p.line), [2]);
  assert.deepEqual(out.pairs.map((p) => p.key), ["A"]);
  assert.equal(typeof out.problems[0].message, "string");
});

test("TS-ERR-PARSE_BAD_KEY", () => {
  const out = parse("1BAD=x");
  assert.deepEqual(out.pairs, []);
  assert.equal(out.problems.length, 1);
  assert.equal(out.problems[0].line, 1);
});

test("every pair carries its 1-based line", () => {
  assert.deepEqual(parse("\nA=1\n\nB=2").pairs.map((p) => p.line), [2, 4]);
});

test("TS-INV-02: never throws on malformed input", () => {
  for (const s of ["", "=x", "A", "\u0000", "export", "export =", "  =  ", '"', "A=\"x\ny"]) {
    let out;
    assert.doesNotThrow(() => { out = parse(s); }, `threw on ${JSON.stringify(s)}`);
    for (const p of out.problems) assert.ok(Number.isInteger(p.line) && p.line >= 1);
  }
  assert.deepEqual(parse("=x").problems.map((p) => p.line), [1]);
  assert.deepEqual(parse("A").problems.map((p) => p.line), [1]);
});

test("TS-NOGO-01: no ${VAR} interpolation", () => {
  assert.deepEqual(parse("A=${B}").pairs, [{ key: "A", value: "${B}", line: 1 }]);
});

test("empty string → {pairs: [], problems: []}", () => {
  assert.deepEqual(parse(""), { pairs: [], problems: [] });
});

test("CRLF text parses identically to LF text", () => {
  const lf = "A=1\n# c\n\nexport B='two'\nC=\"3\"\nBAD\n";
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.deepEqual(parse(crlf), parse(lf));
  for (const p of parse(crlf).pairs) assert.ok(!p.value.includes("\r"));
});
