import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "envlint.mjs");
const USAGE = "envlint: usage: envlint --schema <schema.json> <envfile>";

function fixture(env, schema) {
  const dir = mkdtempSync(join(tmpdir(), "envlint-"));
  const e = join(dir, "e.env");
  const s = join(dir, "s.json");
  writeFileSync(e, env);
  if (schema !== undefined) writeFileSync(s, typeof schema === "string" ? schema : JSON.stringify(schema));
  return { dir, e, s };
}
const run = (args, opts = {}) => spawnSync("node", [BIN, ...args], { encoding: "utf8", input: "", ...opts });
const noStack = (r) => assert.ok(!r.stderr.includes("    at "), r.stderr);

test("shebang first line", () => {
  assert.ok(readFileSync(BIN, "utf8").startsWith("#!/usr/bin/env node"));
});

test("reads exactly the two named files", () => {
  const { e, s } = fixture("A=1\n", { A: { type: "int" } });
  const r = run(["--schema", s, e]);
  assert.equal(r.status, 0);
});

test("ignores a .env in the cwd and leaves the dir unchanged", () => {
  const { e, s } = fixture("PORT=abc\n", { PORT: { type: "int" } });
  const cwd = mkdtempSync(join(tmpdir(), "envlint-cwd-"));
  writeFileSync(join(cwd, ".env"), "OTHER=zzz\nJUNK\n");
  const before = readdirSync(cwd).sort();
  const r = run(["--schema", s, e], { cwd });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, `${e}:1: PORT: expected int, got "abc"\n`);
  assert.deepEqual(readdirSync(cwd).sort(), before);
});

test("findings in spec order", () => {
  const { e, s } = fixture("PORT=abc\nJUNK", { PORT: { type: "int" }, DB: { required: true } });
  const r = run(["--schema", s, e]);
  assert.equal(r.status, 1);
  assert.equal(
    r.stdout,
    `${e}:1: PORT: expected int, got "abc"\n${e}:2: expected KEY=value\n${e}: DB: required key is missing\n`,
  );
});

test("clean file is silent", () => {
  const { e, s } = fixture("PORT=80\nDB=x\n", { PORT: { type: "int" }, DB: { required: true } });
  const r = run(["--schema", s, e]);
  assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""]);
});

test("usage errors", () => {
  const { e, s } = fixture("A=1\n", {});
  for (const args of [[], ["--schema", s], [e], ["--bogus", "--schema", s, e]]) {
    const r = run(args);
    assert.equal(r.status, 2);
    assert.ok(r.stderr.includes(USAGE), r.stderr);
    noStack(r);
  }
});

test("missing env file", () => {
  const { s } = fixture("", {});
  const r = run(["--schema", s, "missing.env"]);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes("missing.env"));
  noStack(r);
});

test("unreadable schemas", () => {
  const { e } = fixture("A=1\n");
  const bad = fixture("", "{not json");
  const float = fixture("", { A: { type: "float" } });
  for (const s of [join(bad.dir, "nope.json"), bad.s, float.s]) {
    const r = run(["--schema", s, e]);
    assert.equal(r.status, 2);
    assert.ok(r.stderr.includes(s), r.stderr);
    noStack(r);
  }
});

test("binary garbage env file does not crash", () => {
  const { dir, s } = fixture("", { A: { required: true } });
  const e = join(dir, "bin.env");
  writeFileSync(e, Buffer.from([0, 255, 254, 1, 2, 0x80, 10, 0xc3, 0x28, 0, 61, 255]));
  const r = run(["--schema", s, e]);
  assert.ok([0, 1].includes(r.status), String(r.status));
  noStack(r);
});

test("no ANSI and does not wait on open stdin", async () => {
  const { e, s } = fixture("PORT=abc\n", { PORT: { type: "int" } });
  const child = spawn("node", [BIN, "--schema", s, e], { stdio: ["pipe", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  const code = await new Promise((res, rej) => {
    const t = setTimeout(() => {
      child.kill();
      rej(new Error("waited on stdin"));
    }, 5000);
    child.on("close", (c) => {
      clearTimeout(t);
      res(c);
    });
  });
  assert.equal(code, 1);
  assert.ok(out.length > 0);
  assert.ok(!out.includes("\x1b["));
});

test("empty env file", () => {
  const req = fixture("", { A: { required: true } });
  const r1 = run(["--schema", req.s, req.e]);
  assert.equal(r1.status, 1);
  assert.equal(r1.stdout, `${req.e}: A: required key is missing\n`);
  const opt = fixture("", { A: { type: "int" } });
  const r2 = run(["--schema", opt.s, opt.e]);
  assert.deepEqual([r2.status, r2.stdout, r2.stderr], [0, "", ""]);
});
