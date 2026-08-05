#!/usr/bin/env node
// SYNTHETIC reference deliverable — the known-PARTIAL workspace for the HARD Day-1 fixture.
// Hand-authored, NOT measured skill output.
//
// Third fixture alongside weak-stub.js (floor) and reference-hard.js (ceiling), and the only one
// that proves the scorer can report a number BETWEEN them. Without it a rubric that returns 0 or 1
// passes every discrimination check and still gives a revision round nothing to move — the exact
// defect that made three paid runs unreadable before detector.rows existed.
//
// THE PLANTED DEFECT is the classic one for batch removal, and it is planted at the single line
// marked below: it splices in ASCENDING index order, so removing an item shifts the position of
// every later item that has not been removed yet. `rm 1 3 5` on [alpha..echo] therefore removes
// alpha and delta instead of alpha, charlie and echo — and the third selector falls off the end
// entirely, silently. Everything else in this file is correct, which is the point: the failure is
// one line deep and the score must still land strictly between the endpoints.
//
// Deliberately NOT derived from reference-hard.js at test time: a sed over a source line would
// break silently the day that line is reworded, and the check would go green on an artifact that
// no longer carries the defect it is named for.

const fs = require("node:fs");
const STORE = process.env.TODO_STORE || "./todos.json";

function fail(msg) { process.stderr.write(`error: ${msg}\n`); process.exit(1); }

function load() {
  if (!fs.existsSync(STORE)) return [];
  let raw;
  try { raw = fs.readFileSync(STORE, "utf8"); } catch (e) { fail(`cannot read store ${STORE}: ${e.message}`); }
  if (raw.trim() === "") return [];
  let v;
  try { v = JSON.parse(raw); } catch (e) { fail(`store ${STORE} is corrupted (${e.message}); refusing to touch it`); }
  if (!Array.isArray(v)) fail(`store ${STORE} is corrupted (expected a JSON array); refusing to touch it`);
  return v;
}
function save(items) { fs.writeFileSync(STORE, JSON.stringify(items, null, 2)); }

// Every selector is resolved against the list AS IT WAS when the command started, and the whole
// batch is validated before anything is written — idea-hard.md's "a partial batch edit is worse
// than a refused one". Returns 0-based indices, de-duplicated, in ascending order.
function resolve(selectors, len) {
  if (selectors.length === 0) fail("no items selected");
  const picked = new Set();
  for (const sel of selectors) {
    const range = /^(\d+)-(\d+)$/.exec(sel);
    const single = /^(\d+)$/.exec(sel);
    let lo, hi;
    if (range) { lo = Number(range[1]); hi = Number(range[2]); }
    else if (single) { lo = hi = Number(single[1]); }
    else fail(`"${sel}" is not an item number or range`);
    if (lo > hi) fail(`"${sel}" is not a valid range`);
    for (let n = lo; n <= hi; n++) {
      if (n < 1 || n > len) fail(`no item ${n}`);   // refuses the WHOLE batch, before any write
      picked.add(n - 1);
    }
  }
  return [...picked].sort((a, b) => a - b);
}

const [cmd, ...rest] = process.argv.slice(2);
const items = load();

switch (cmd) {
  case "add": {
    const text = rest.join(" ").trim();
    if (!text) fail("nothing to add");
    items.push({ text, done: false });
    save(items);
    console.log(`added: ${text}`);
    break;
  }
  case "list": case undefined: {
    if (items.length === 0) { console.log("no todos"); break; }
    items.forEach((it, i) => console.log(`${i + 1}. [${it.done ? "x" : " "}] ${it.text}`));
    break;
  }
  case "done": {
    const idx = resolve(rest, items.length);
    for (const i of idx) items[i].done = true;
    save(items);
    // Reports EXACTLY the affected items and no others, so the caller can tell what happened
    // without re-reading the list.
    console.log(`done: ${idx.map((i) => items[i].text).join(", ")}`);
    break;
  }
  case "rm": {
    const idx = resolve(rest, items.length);
    const removed = [];
    // THE PLANTED DEFECT. Ascending splice: each removal shifts every later index down by one, so
    // the second selector lands on the wrong item and the last one addresses a position that no
    // longer exists. splice() on an out-of-range index is a silent no-op, so nothing reports an
    // error — the batch just quietly does the wrong thing.
    for (const i of idx) { if (i < items.length) removed.push(items[i].text); items.splice(i, 1); }
    save(items);
    console.log(`removed: ${removed.join(", ")}`);
    break;
  }
  default: fail(`unknown command "${cmd}" (use: add|list|done|rm)`);
}
