#!/usr/bin/env node
// s0-register.mjs — HD-1/HD-2 (proj-harmony-os-sample's consumer register) promoted into this
// repo's own register under fresh HD-0xx ids, evidence tables kept rather than summarised away.
//
// Prints "HD-1 PROMOTED" only when every check below holds; otherwise prints which are missing
// and exits 1. Exits 2 if the register itself cannot be read — a broken probe, not a red one.
//
// Usage: node tests/fixtures/s0-register.mjs   (exit 0 + "HD-1 PROMOTED")

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REGISTER = join(ROOT, "shapeup/knowledge-base/harness-defects.md");

let text;
try {
  text = readFileSync(REGISTER, "utf8");
} catch (err) {
  console.error(`CANNOT READ shapeup/knowledge-base/harness-defects.md: ${err.message}`);
  process.exit(2);
}

// Both promoted entries must carry a fresh HD-0xx id — never the consumer's own HD-1/HD-2, which
// are that project's numbering and would collide with this repo's own sequence.
const checks = [
  { name: "HD-1 promoted under a fresh HD-0xx id, title kept",
    re: /-\s+\*\*HD-0\d\d\s*·[^\n]*collision[^\n]*hard-aborts[^\n]*L1b/i },
  { name: "HD-1 evidence: the run id that measured it",
    re: /find-my-todos-20260921T142815Z-b80de580/ },
  { name: "HD-1 evidence: dispatch/token cost kept",
    re: /25\s+agent\s+dispatches/i },
  { name: "HD-1 attributed to its source register",
    re: /proj-harmony-os-sample[^\n]*HD-1|HD-1[^\n]*proj-harmony-os-sample/ },
  { name: "HD-2 promoted under a fresh HD-0xx id, title kept",
    re: /-\s+\*\*HD-0\d\d\s*·[^\n]*breaker[^\n]*never\s+dispatched/i },
  { name: "HD-2 evidence: the run id that measured it",
    re: /find-my-todos-20260922T020229Z-9036e2b6/ },
  { name: "HD-2 evidence table kept (r1-a1 / r1-a2 channel rows)",
    re: /r1-a1[\s\S]{0,600}r1-a2/ },
  { name: "HD-2 attributed to its source register",
    re: /proj-harmony-os-sample[^\n]*HD-2|HD-2[^\n]*proj-harmony-os-sample/ },
  { name: "the consumer's own HD-1/HD-2 numbering is not reused verbatim as this repo's id",
    re: /^(?!.*\*\*HD-1\s*·)(?!.*\*\*HD-2\s*·)[\s\S]*$/ },
];

const missing = checks.filter((c) => !c.re.test(text));
if (missing.length) {
  console.error(`NOT PROMOTED — missing: ${missing.map((c) => c.name).join("; ")}`);
  process.exit(1);
}

console.log("HD-1 PROMOTED");
process.exit(0);
