import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BIN = resolve(import.meta.dirname, "../bin/envlint.mjs");

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "envlint-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

function run(dir, args) {
  return spawnSync("node", [BIN, ...args], { cwd: dir, encoding: "utf8", input: "" });
}

const STACK = /\n\s+at /;

test("integration: int type finding", () => {
  const d = fixture({ "e.env": "PORT=abc\n", "s.json": '{"PORT":{"type":"int"}}' });
  const r = run(d, ["--schema", "s.json", "e.env"]);
  assert.equal(r.stdout, 'e.env:1: PORT: expected int, got "abc"\n');
  assert.equal(r.status, 1);
});

test("usage errors exit 2 with a usage line", () => {
  const d = fixture({ "s.json": "{}", "e.env": "" });
  const cases = [[], ["--schema", "s.json"], ["--schema"], ["--bogus"], ["--schema", "s.json", "e.env", "x"], ["e.env"]];
  for (const args of cases) {
    const r = run(d, args);
    assert.equal(r.status, 2, args.join(" "));
    assert.match(r.stderr, /^envlint:/);
    assert.match(r.stderr, /usage:/);
  }
});

test("missing env file", () => {
  const d = fixture({ "s.json": "{}" });
  const r = run(d, ["--schema", "s.json", "missing.env"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /missing\.env/);
  assert.doesNotMatch(r.stderr, STACK);
});

test("bad schemas name the schema path", () => {
  const d = fixture({ "e.env": "A=1\n", "bad.json": "{not json", "shape.json": '{"A":{"type":"float"}}' });
  for (const s of ["missing.json", "bad.json", "shape.json"]) {
    const r = run(d, ["--schema", s, "e.env"]);
    assert.equal(r.status, 2, s);
    assert.ok(r.stderr.includes(s), s);
    assert.doesNotMatch(r.stderr, STACK);
  }
});

test("no assignments", () => {
  const d = fixture({ "e.env": "# c\n\n  \n", "none.json": "{}", "req.json": '{"HOST":{"required":true}}' });
  const a = run(d, ["--schema", "none.json", "e.env"]);
  assert.equal(a.status, 0);
  assert.equal(a.stdout, "");
  const b = run(d, ["--schema", "req.json", "e.env"]);
  assert.equal(b.status, 1);
  assert.equal(b.stdout, "e.env: HOST: required key is missing\n");
});

test("malformed input never crashes", () => {
  const garbage = Buffer.from([0, 1, 2, 255, 254, 61, 10, 0x22, 200]).toString("latin1");
  const d = fixture({ "s.json": "{}", "a.env": "NOEQUALS\n", "b.env": 'A="open\n', "c.env": garbage });
  for (const e of ["a.env", "b.env", "c.env"]) {
    const r = run(d, ["--schema", "s.json", e]);
    assert.ok([0, 1, 2].includes(r.status), e);
    assert.doesNotMatch(r.stderr, STACK);
  }
});

test("only given files are read; cwd untouched", () => {
  const d = fixture({ ".env": "SECRET=zzz\n", "s.json": '{"A":{"required":true}}', "e.env": "A=1\n" });
  const before = readdirSync(d).sort();
  const r = run(d, ["--schema", "s.json", "e.env"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.deepEqual(readdirSync(d).sort(), before);
  assert.equal(readFileSync(join(d, ".env"), "utf8"), "SECRET=zzz\n");
});

test("scenario: CI fails on a bad env file; no ANSI", () => {
  const d = fixture({ "e.env": "PORT=abc\nBROKEN\n", "s.json": '{"PORT":{"type":"int"},"HOST":{"required":true}}' });
  const r = run(d, ["--schema", "s.json", "e.env"]);
  assert.equal(r.status, 1);
  const want = ['e.env:1: PORT: expected int, got "abc"', "e.env:2: missing '='", "e.env: HOST: required key is missing"];
  assert.equal(r.stdout, want.join("\n") + "\n");
  assert.ok(!r.stdout.includes("\x1b[") && !r.stderr.includes("\x1b["));
});
