import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BIN = resolve("bin/envlint.mjs");

function lint(env, schema, args) {
  const dir = mkdtempSync(join(tmpdir(), "envlint-int-"));
  writeFileSync(join(dir, "app.env"), env);
  writeFileSync(join(dir, "schema.json"), schema);
  return spawnSync("node", [BIN, ...(args ?? ["--schema", "schema.json", "app.env"])], { cwd: dir, encoding: "utf8" });
}

test("exit 0 clean", () => {
  const r = lint("A=1\n", '{"A":{"type":"int"}}');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("exit 1 findings", () => {
  assert.equal(lint("A=x\n", '{"A":{"type":"int"}}').status, 1);
});

test("exit 2 usage and I/O", () => {
  assert.equal(lint("A=1\n", "{}", ["--schema", "schema.json"]).status, 2);
  assert.equal(lint("A=1\n", "{}", ["--schema", "schema.json", "nope.env"]).status, 2);
  assert.equal(lint("A=1\n", "{bad", ["--schema", "schema.json", "app.env"]).status, 2);
});

test("every parse feature and rule yields exactly the expected lines", () => {
  const env = [
    "# comment",
    "",
    "export A=1",
    'B="two"',
    "C='x'",
    "D=abc",
    "E=maybe",
    "F=notaurl",
    "G=blue",
    "oops",
    "",
  ].join("\n");
  const schema = JSON.stringify({
    A: { type: "int" },
    B: { type: "string" },
    D: { type: "int" },
    E: { type: "bool" },
    F: { type: "url" },
    G: { enum: ["red", "green"] },
    M: { required: true },
  });
  const r = lint(env, schema);
  assert.equal(r.status, 1);
  assert.deepEqual(r.stdout.trimEnd().split("\n"), [
    'app.env:6: D: D must be int, got "abc"',
    'app.env:7: E: E must be bool, got "maybe"',
    'app.env:8: F: F must be url, got "notaurl"',
    'app.env:9: G: G must be one of red, green, got "blue"',
    "app.env:10: missing '=' in line",
    "app.env: M: M is required but missing",
  ]);
});
