#!/usr/bin/env node
// Reference solution for the todo-cli example — exists ONLY to test eval-cli-contract.mjs
// (proves the oracle reports PASS on a correct impl). It is NOT the harness's expected output;
// the point of the example is that the *agent* builds this from idea.md.
//
// Store path comes from $TODO_STORE (so the eval oracle can sandbox it), default ./todos.json.

const fs = require("node:fs");
const STORE = process.env.TODO_STORE || "./todos.json";

function load() {
  if (!fs.existsSync(STORE)) return [];
  let raw;
  try { raw = fs.readFileSync(STORE, "utf8"); }
  catch (e) { fail(`cannot read store ${STORE}: ${e.message}`); }
  try { const v = JSON.parse(raw); if (!Array.isArray(v)) throw new Error("not an array"); return v; }
  catch (e) { fail(`store ${STORE} is corrupted (${e.message}); refusing to touch it`); }
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
