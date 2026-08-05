#!/usr/bin/env node
// SYNTHETIC reference deliverable — the known-BAD workspace, hand-authored, NOT measured skill
// output. A plausible-looking first pass that handles the happy path and none of the edges:
// no empty-list message, no index validation, no corrupted-store guard. Exists so the oracle
// detector can be proven to FAIL a bad workspace without spending a token.
const fs = require("node:fs");
const STORE = "todos.json";
const load = () => JSON.parse(fs.readFileSync(STORE, "utf8"));
const save = (t) => fs.writeFileSync(STORE, JSON.stringify(t));
const [cmd, arg] = process.argv.slice(2);
if (cmd === "add") { const t = load(); t.push({ text: arg, done: false }); save(t); }
else if (cmd === "done") { const t = load(); t[Number(arg) - 1].done = true; save(t); }
else if (cmd === "rm") { const t = load(); t.splice(Number(arg) - 1, 1); save(t); }
else { load().forEach((x, i) => console.log(`${i + 1}. [${x.done ? "x" : " "}] ${x.text}`)); }
