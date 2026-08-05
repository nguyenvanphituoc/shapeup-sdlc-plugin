#!/usr/bin/env node
// SYNTHETIC reference deliverable — the known-GOOD workspace for the HARD Day-1 fixture.
// Hand-authored, NOT measured skill output, and it may never be reported as one (the run record's
// `source` says `reference-strong` for exactly this reason).
//
// Exists to prove the rubric does not penalise a correct implementation: it must score at or above
// `discrimination.min_strong_score`. It is deliberately plain — the point is that every selector
// rule in fixtures/idea-hard.md is honoured, not that the code is clever.

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
    const removed = idx.map((i) => items[i].text);
    // Splice from the highest index down, so removing one item never shifts the position of
    // another that has not been removed yet.
    for (const i of [...idx].reverse()) items.splice(i, 1);
    save(items);
    console.log(`removed: ${removed.join(", ")}`);
    break;
  }
  default: fail(`unknown command "${cmd}" (use: add|list|done|rm)`);
}
