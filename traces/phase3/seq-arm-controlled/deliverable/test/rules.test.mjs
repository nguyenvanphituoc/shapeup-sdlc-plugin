import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../src/rules.mjs";

function pair(key, value, line) {
  return { key, value, line };
}

test("src/rules.mjs exports evaluate(pairs, problems, schema)", () => {
  assert.equal(typeof evaluate, "function");
});

test("ParseProblem becomes one Finding (E4 shape)", () => {
  const problems = [{ line: 3, text: "this is not an assignment at all here" }];
  const findings = evaluate([], problems, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
  assert.equal(findings[0].key, "this is not an assignment at all here".slice(0, 30));
  assert.equal(findings[0].key.length, 30);
  assert.equal(findings[0].message, "not a KEY=VALUE assignment");
});

test("key present in file but absent from schema is never a finding (INV-01)", () => {
  const pairs = [pair("EXTRA_KEY", "whatever", 1)];
  const findings = evaluate(pairs, [], {});
  assert.equal(findings.length, 0);
});

test("required:true + key absent from deduped pairs -> Finding with line:0", () => {
  const schema = { PORT: { required: true, type: "int" } };
  const findings = evaluate([], [], schema);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 0);
  assert.equal(findings[0].key, "PORT");
});

test("duplicate key: only LAST occurrence in file order is evaluated (INV-02)", () => {
  const schema = { PORT: { required: true, type: "int" } };
  // earlier invalid, later valid -> no finding
  let pairs = [pair("PORT", "abc", 1), pair("PORT", "8080", 2)];
  assert.equal(evaluate(pairs, [], schema).length, 0);

  // earlier valid, later invalid -> exactly one finding, on the later value
  pairs = [pair("PORT", "8080", 1), pair("PORT", "abc", 2)];
  const findings = evaluate(pairs, [], schema);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].key, "PORT");
});

test("type:int matches /^-?\\d+$/", () => {
  const schema = { N: { type: "int" } };
  assert.equal(evaluate([pair("N", "01", 1)], [], schema).length, 0);
  assert.equal(evaluate([pair("N", "-5", 1)], [], schema).length, 0);
  assert.equal(evaluate([pair("N", "1.5", 1)], [], schema).length, 1);
  assert.equal(evaluate([pair("N", "1e3", 1)], [], schema).length, 1);
  assert.equal(evaluate([pair("N", "", 1)], [], schema).length, 1);
});

test("type:bool matches true/false/1/0 case-insensitively", () => {
  const schema = { B: { type: "bool" } };
  for (const v of ["true", "false", "1", "0", "TRUE", "False"]) {
    assert.equal(evaluate([pair("B", v, 1)], [], schema).length, 0, `expected ${v} valid`);
  }
  for (const v of ["yes", "2"]) {
    assert.equal(evaluate([pair("B", v, 1)], [], schema).length, 1, `expected ${v} invalid`);
  }
});

test("type:url requires new URL() to parse AND protocol http:/https:", () => {
  const schema = { U: { type: "url" } };
  assert.equal(evaluate([pair("U", "http://x.com", 1)], [], schema).length, 0);
  assert.equal(evaluate([pair("U", "https://x.com", 1)], [], schema).length, 0);
  // protocol-gate footgun: parses fine via new URL() but wrong protocol
  assert.equal(evaluate([pair("U", "ftp://x.com", 1)], [], schema).length, 1);
  assert.equal(evaluate([pair("U", "mailto:a@b.com", 1)], [], schema).length, 1);
  // WHATWG leniency: must NOT be specially rejected
  assert.equal(evaluate([pair("U", "http:/x.com", 1)], [], schema).length, 0);
});

test("type:string accepts any value, including empty", () => {
  const schema = { S: { type: "string" } };
  assert.equal(evaluate([pair("S", "anything", 1)], [], schema).length, 0);
  assert.equal(evaluate([pair("S", "", 1)], [], schema).length, 0);
});

test("enum requires exact match against listed values", () => {
  const schema = { L: { enum: ["debug", "info"] } };
  assert.equal(evaluate([pair("L", "debug", 1)], [], schema).length, 0);
  assert.equal(evaluate([pair("L", "warn", 1)], [], schema).length, 1);
});

test("present-but-empty value satisfies string, fails int/bool/url/enum", () => {
  assert.equal(evaluate([pair("S", "", 1)], [], { S: { type: "string" } }).length, 0);
  assert.equal(evaluate([pair("N", "", 1)], [], { N: { type: "int" } }).length, 1);
  assert.equal(evaluate([pair("B", "", 1)], [], { B: { type: "bool" } }).length, 1);
  assert.equal(evaluate([pair("U", "", 1)], [], { U: { type: "url" } }).length, 1);
  assert.equal(evaluate([pair("L", "", 1)], [], { L: { enum: ["a", "b"] } }).length, 1);
});

test("zero pairs + zero required keys -> zero findings (INV-06 ok branch)", () => {
  const schema = { S: { type: "string" } };
  assert.equal(evaluate([], [], schema).length, 0);
});

test("boundary: int leading zero 01 is valid", () => {
  assert.equal(evaluate([pair("N", "01", 1)], [], { N: { type: "int" } }).length, 0);
});

test('boundary: int invalid set 1.5/1e3/""/5-/+5 all invalid', () => {
  const schema = { N: { type: "int" } };
  for (const v of ["1.5", "1e3", "", "5-", "+5"]) {
    assert.equal(evaluate([pair("N", v, 1)], [], schema).length, 1, `expected ${v} invalid`);
  }
});

test("boundary: bool TRUE/False/1/0 valid, yes/2 invalid", () => {
  const schema = { B: { type: "bool" } };
  for (const v of ["TRUE", "False", "1", "0"]) {
    assert.equal(evaluate([pair("B", v, 1)], [], schema).length, 0, `expected ${v} valid`);
  }
  for (const v of ["yes", "2"]) {
    assert.equal(evaluate([pair("B", v, 1)], [], schema).length, 1, `expected ${v} invalid`);
  }
});
