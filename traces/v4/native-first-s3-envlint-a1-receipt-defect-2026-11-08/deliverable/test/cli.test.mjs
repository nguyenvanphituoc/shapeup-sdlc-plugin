import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BIN = resolve("bin/envlint.mjs");

function run(env, schema, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), "envlint-"));
  if (env !== undefined) writeFileSync(join(dir, "app.env"), env);
  if (schema !== undefined) writeFileSync(join(dir, "schema.json"), schema);
  const a = opts.args ?? ["--schema", "schema.json", "app.env"];
  const before = readdirSync(dir).join();
  const r = spawnSync("node", [BIN, ...a], { cwd: dir, encoding: "utf8", input: "" });
  assert.equal(readdirSync(dir).join(), before);
  if (env !== undefined) assert.equal(readFileSync(join(dir, "app.env"), "utf8"), env);
  assert.doesNotMatch(r.stdout + r.stderr, /\x1b\[/);
  return r;
}

test("type mismatch names key and line, exit 1", () => {
  const r = run("PORT=abc\n", '{"PORT":{"type":"int"}}');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /PORT/);
  assert.match(r.stdout, /app\.env:1:/);
});

test("clean file prints nothing, exit 0", () => {
  const r = run("PORT=80\n", '{"PORT":{"type":"int"}}');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("no env file argument exits 2 with usage, even with .env in cwd", () => {
  const dir = mkdtempSync(join(tmpdir(), "envlint-"));
  writeFileSync(join(dir, ".env"), "A=1\n");
  writeFileSync(join(dir, "schema.json"), "{}");
  const r = spawnSync("node", [BIN, "--schema", "schema.json"], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/);
});

test("missing env file exits 2 naming it, no stack", () => {
  const r = run(undefined, "{}", { args: ["--schema", "schema.json", "nope.env"] });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /nope\.env/);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});

test("missing and invalid schema exit 2 naming it, no stack", () => {
  const a = run("A=1\n", undefined, { args: ["--schema", "gone.json", "app.env"] });
  assert.equal(a.status, 2);
  assert.match(a.stderr, /gone\.json/);
  const b = run("A=1\n", "{not json");
  assert.equal(b.status, 2);
  assert.match(b.stderr, /schema\.json/);
  assert.doesNotMatch(b.stderr, /\n\s+at /);
});

test("comments-only env with required key: one missing line, exit 1", () => {
  const r = run("# hi\n\n", '{"K":{"required":true}}');
  assert.equal(r.status, 1);
  assert.equal(r.stdout.trim().split("\n").length, 1);
  assert.match(r.stdout, /K/);
});

test("dollar-brace value reported literally", () => {
  const lit = "$" + "{HOME}";
  const r = run("A=" + lit + "\n", '{"A":{"enum":["x"]}}');
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes(lit));
});

test("no network modules in the binary", () => {
  assert.doesNotMatch(readFileSync(BIN, "utf8"), /fetch|node:http|node:https|node:net/);
});
