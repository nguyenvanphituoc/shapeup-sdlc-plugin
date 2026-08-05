#!/usr/bin/env node
// SYNTHETIC reference deliverable — the known-PARTIAL workspace, hand-authored, NOT measured skill
// output. Third fixture alongside weak-stub.js (0 of 5) and the reference impl (5 of 5), and the
// only one that proves the scorer can report a number BETWEEN those two.
//
// It is not an invented defect. This is the exact artifact three paid Sonnet-5 runs converged on:
// every edge handled except a corrupted store, which it swallows and reports as an empty list —
// exit 0 where E4 requires non-zero. Fourteen of fifteen recorded rounds looked like this, and all
// fourteen scored 0.0, because the criterion was binary. That is what `detector.rows` fixes, and a
// fixture that scores 0 or 1 could never have caught it.
//
// Deliberately NOT derived from reference/todo.js at test time: a sed over a source line would
// break silently the day that line is reworded, and the check would go green on an artifact that
// no longer has the defect it is named for.

const fs = require("node:fs");
const STORE = process.env.TODO_STORE || "./todos.json";

function load() {
  if (!fs.existsSync(STORE)) return [];
  let raw;
  try { raw = fs.readFileSync(STORE, "utf8"); }
  catch (e) { fail(`cannot read store ${STORE}: ${e.message}`); }
  // THE PLANTED DEFECT (E4). A corrupted store is indistinguishable from an empty one from here,
  // so `todo list` on a garbage file prints "no todos" and exits 0 — the CLI reports success for
  // data it could not read, and the next `add` would overwrite the file it failed to parse.
  try { const v = JSON.parse(raw); if (!Array.isArray(v)) throw new Error("not an array"); return v; }
  catch (e) { return []; }
}
function save(items) { fs.writeFileSync(STORE, JSON.stringify(items, null, 2)); }
function fail(msg) { process.stderr.write(`error: ${msg}\n`); process.exit(1); }

const [cmd, ...rest] = process.argv.slice(2);
const items = load();

function index(arg) {
  if (!/^\d+$/.test(arg || "")) fail(`"${arg}" is not a valid item number`);
  const n = Number(arg);
  if (n < 1 || n > items.length) fail(`no item ${n}`);
  return n - 1;
}

switch (cmd) {
  case "add": {
    const text = rest.join(" ").trim();
    if (!text) fail("nothing to add");
    items.push({ text, done: false }); save(items);
    console.log(`added: ${text}`); break;
  }
  case "list": case undefined: {
    if (items.length === 0) { console.log("no todos"); break; }
    items.forEach((it, i) => console.log(`${i + 1}. [${it.done ? "x" : " "}] ${it.text}`));
    break;
  }
  case "done": {
    const i = index(rest[0]);
    if (items[i].done) console.log(`already done: ${items[i].text}`);
    else { items[i].done = true; save(items); console.log(`done: ${items[i].text}`); }
    break;
  }
  case "rm": {
    const i = index(rest[0]);
    const [removed] = items.splice(i, 1); save(items);
    console.log(`removed: ${removed.text}`); break;
  }
  default: fail(`unknown command "${cmd}" (use: add|list|done|rm)`);
}
