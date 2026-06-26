#!/usr/bin/env node
// Process-level evaluation oracle for a CLI deliverable — a runnable prototype of the
// "evaluation contract" abstraction (Stage G in the audit). It shows what `spec-evaluator`-style
// evidence-cited output looks like for a NON-UI target, where there is no browser to drive.
//
// Contract: a deliverable is a `todo` executable. Each criterion below is probed by spawning the
// process with controlled argv + a controlled store file, then grading the OBSERVED exit code and
// stdout/stderr — never the source code. Absence of evidence = FAIL (anti-leniency).
//
// Usage:  node eval-cli-contract.mjs "<command to run todo>"
//   e.g.  node eval-cli-contract.mjs "node ./todo.js"
//         node eval-cli-contract.mjs "./todo"
//
// Exit 0 = all criteria PASS, 1 = at least one FAIL. Prints a verdict report (block B/C format).

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cmd = process.argv[2];
if (!cmd) {
  console.error('usage: node eval-cli-contract.mjs "<command to run todo>"');
  process.exit(2);
}
const [bin, ...baseArgs] = cmd.split(/\s+/);

// Run `todo` with given args against a store seeded with `storeContent` (null = no store file).
function run(args, storeContent) {
  const dir = mkdtempSync(join(tmpdir(), "todo-eval-"));
  const store = join(dir, "todos.json");
  if (storeContent !== null) writeFileSync(store, storeContent);
  const res = spawnSync(bin, [...baseArgs, ...args], {
    encoding: "utf8",
    env: { ...process.env, TODO_STORE: store },
    timeout: 10_000,
  });
  rmSync(dir, { recursive: true, force: true });
  const out = (res.stdout || "") + (res.stderr || "");
  return { code: res.status, out, crashed: /at\s+.*:\d+:\d+|Traceback|panic:|unhandled/i.test(out) };
}

// Each criterion: probe + grade(result) → {pass, evidence}. Evidence is always cited.
const criteria = [
  {
    id: "E1", desc: "empty list prints a friendly message, exit 0",
    probe: () => run(["list"], "[]"),
    grade: (r) => ({ pass: r.code === 0 && /no todos|empty|nothing/i.test(r.out),
      evidence: `exit ${r.code}, out=${JSON.stringify(r.out.trim().slice(0, 80))}` }),
  },
  {
    id: "E2", desc: "bad index fails gracefully, non-zero, no stack trace",
    probe: () => run(["done", "99"], "[]"),
    grade: (r) => ({ pass: r.code !== 0 && !r.crashed,
      evidence: `exit ${r.code}, crashed=${r.crashed}, out=${JSON.stringify(r.out.trim().slice(0, 80))}` }),
  },
  {
    id: "E3", desc: "non-numeric index fails gracefully",
    probe: () => run(["done", "abc"], "[]"),
    grade: (r) => ({ pass: r.code !== 0 && !r.crashed,
      evidence: `exit ${r.code}, crashed=${r.crashed}` }),
  },
  {
    id: "E4", desc: "corrupted store fails without destroying data, names the file",
    probe: () => run(["list"], "{garbage"),
    grade: (r) => ({ pass: r.code !== 0 && !r.crashed,
      evidence: `exit ${r.code}, crashed=${r.crashed}, out=${JSON.stringify(r.out.trim().slice(0, 80))}` }),
  },
  {
    id: "E5", desc: "missing store is created on first run, exit 0",
    probe: () => run(["list"], null),
    grade: (r) => ({ pass: r.code === 0 && !r.crashed,
      evidence: `exit ${r.code}, crashed=${r.crashed}` }),
  },
];

console.log(`\nEvaluation report — CLI contract for: ${cmd}\n${"=".repeat(60)}`);
let fails = 0;
for (const c of criteria) {
  let r, g;
  try { r = c.probe(); g = c.grade(r); }
  catch (e) { g = { pass: false, evidence: `probe threw: ${e.message}` }; } // absence of evidence = FAIL
  const verdict = g.pass ? "PASS" : "FAIL";
  if (!g.pass) fails++;
  console.log(`${verdict}  ${c.id}  ${c.desc}\n        ⇒ ${g.evidence}`);
}
console.log("=".repeat(60));
if (fails === 0) { console.log(`✅ all ${criteria.length} criteria PASS`); process.exit(0); }
console.log(`❌ ${fails}/${criteria.length} criteria FAIL`); process.exit(1);
