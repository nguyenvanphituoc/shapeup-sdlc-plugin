// The build's own suite. It is GREEN, and it is green because every case runs against a store
// that does not exist yet — so nothing here can reach the batch-removal path at all.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (...argv) => spawnSync("node", [new URL("./todo.mjs", import.meta.url).pathname, ...argv],
  { encoding: "utf8", env: { ...process.env, TODO_STORE: join(mkdtempSync(join(tmpdir(), "todo-test-")), "s.json") } });

assert.equal(run("list").stdout.trim(), "no todos");
assert.equal(run("list").status, 0);
assert.match(run("add", "write the pitch").stdout, /added: write the pitch/);
assert.equal(run("add").status, 1);
assert.equal(run("archive").status, 0);
console.log("ok — 5 assertions");
