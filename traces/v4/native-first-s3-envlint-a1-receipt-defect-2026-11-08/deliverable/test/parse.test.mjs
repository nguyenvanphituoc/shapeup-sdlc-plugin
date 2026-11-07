import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "../src/parse.mjs";

test("KEY=value", () => assert.deepEqual(parse("KEY=value").pairs, [{ key: "KEY", value: "value", line: 1 }]));
test("comments skipped", () => assert.deepEqual(parse("# c\nA=1"), { pairs: [{ key: "A", value: "1", line: 2 }], problems: [] }));
test("blank lines keep numbering", () => assert.equal(parse("\n\nA=1").pairs[0].line, 3));
test("export prefix", () => assert.equal(parse("export KEY=value").pairs[0].key, "KEY"));
test("quotes", () => {
  assert.equal(parse("K='a b'").pairs[0].value, "a b");
  assert.equal(parse('K="a b"').pairs[0].value, "a b");
});
test("bad line in the middle", () => {
  const r = parse("A=1\nbad line\nB=2");
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].line, 2);
  assert.deepEqual(r.pairs.map((p) => p.line), [1, 3]);
});
test("empty", () => assert.deepEqual(parse(""), { pairs: [], problems: [] }));
test("only comments and blanks", () => assert.deepEqual(parse("# a\n\n  \n# b"), { pairs: [], problems: [] }));
test("malformed never throw", () => {
  for (const t of ["=", 'A="x', "A='x", "novalue"]) {
    const r = parse(t);
    assert.equal(r.problems.length, 1);
    assert.equal(r.problems[0].line, 1);
    assert.equal(r.pairs.length, 0);
  }
});
test("no interpolation", () => assert.equal(parse("A=${HOME}").pairs[0].value, "${HOME}"));
