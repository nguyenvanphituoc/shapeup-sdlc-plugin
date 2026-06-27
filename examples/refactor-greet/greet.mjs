#!/usr/bin/env node
// Deterministic generator deliverable for the `snapshot` oracle worked example.
// Given names as argv, it emits a stable, ordered greeting block — the kind of output a
// refactor must preserve byte-for-byte. No clock, no randomness: the output is a pure
// function of argv, so a golden file is a valid oracle.
const names = process.argv.slice(2);
const who = names.length ? names : ["world"];
for (const n of who) console.log(`Hello, ${n}!`);
console.log(`(${who.length} greeting${who.length === 1 ? "" : "s"})`);
