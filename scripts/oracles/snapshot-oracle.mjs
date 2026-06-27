#!/usr/bin/env node
// `snapshot` oracle for the evaluation contract (Stage G, step 4b of the audit).
//
// Deliverable: a generator or a pure refactor — something whose acceptance is "produces exactly
// this output". The oracle runs the deliverable, captures its stdout, and diffs it against a
// committed *golden* file. An empty diff is PASS; any difference is FAIL with the unified diff as
// evidence. This is the natural oracle for "the refactor changed nothing observable" and for
// code/text generators.
//
// Invariants (carried from the evaluator's design):
//   • Probe behavior, not code presence — the verdict cites the diff of observed output.
//   • Absence of evidence = FAIL — a probe that cannot run, or a missing golden, FAILs.
//   • One verdict per criterion.
//
// Contract shape:
//   { "oracle": "snapshot", "criteria": [
//       { "id": "S1", "desc": "greets by name",
//         "probe": { "argv": ["Ada"], "stdin": "" },
//         "golden": "greet.Ada.golden.txt" } ] }
//   `golden` is resolved relative to the contract file (baseDir). Trailing whitespace on each
//   line and a single trailing newline are normalized so a benign EOL diff is not a false FAIL.
//
// Library use:  import { runContract } from ".../snapshot-oracle.mjs"
// CLI use:      node snapshot-oracle.mjs <contract.json> "<command to run the deliverable>"
//               exit 0 = all PASS, 1 = ≥1 FAIL, 2 = usage/contract error.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { CRASH_RE, formatReport } from "./_shared.mjs";

// Normalize so trailing spaces and final-newline differences never cause a spurious FAIL.
function normalize(s) {
  return s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "\n");
}

// Minimal line-level unified diff (no deps). Returns "" when identical.
function unifiedDiff(expected, actual) {
  const a = normalize(expected).split("\n");
  const b = normalize(actual).split("\n");
  if (a.join("\n") === b.join("\n")) return "";
  const lines = ["--- golden", "+++ actual"];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) { if (a[i] !== undefined) lines.push(`  ${a[i]}`); }
    else {
      if (a[i] !== undefined) lines.push(`- ${a[i]}`);
      if (b[i] !== undefined) lines.push(`+ ${b[i]}`);
    }
  }
  return lines.join("\n");
}

function spawnProbe(cmd, probe) {
  const [bin, ...baseArgs] = String(cmd).split(/\s+/).filter(Boolean);
  const res = spawnSync(bin, [...baseArgs, ...(probe.argv || [])], {
    encoding: "utf8",
    cwd: probe.cwd,
    timeout: probe.timeout_ms || 10_000,
    input: probe.stdin,
  });
  return {
    code: res.status,
    stdout: res.stdout || "",
    combined: (res.stdout || "") + (res.stderr || ""),
    spawnError: res.error?.message,
  };
}

export function runContract({ cmd, criteria, baseDir = "." }) {
  const results = [];
  let fails = 0;
  for (const c of criteria) {
    let g;
    try {
      if (!c.golden) throw new Error("criterion has no `golden` file");
      const goldenPath = isAbsolute(c.golden) ? c.golden : join(baseDir, c.golden);
      if (!existsSync(goldenPath)) throw new Error(`golden file not found: ${c.golden}`);
      const golden = readFileSync(goldenPath, "utf8");
      const r = spawnProbe(cmd, c.probe || {});
      if (r.spawnError) throw new Error(`could not run deliverable: ${r.spawnError}`);
      if (CRASH_RE.test(r.combined)) {
        g = { pass: false, evidence: `deliverable crashed (stack trace / panic in output): ${JSON.stringify(r.combined.trim().slice(0, 120))}` };
      } else {
        const diff = unifiedDiff(golden, r.stdout);
        g = diff
          ? { pass: false, evidence: `output differs from golden (exit ${r.code}):\n${diff}` }
          : { pass: true, evidence: `identical to golden (${normalize(golden).split("\n").filter(Boolean).length} lines, exit ${r.code})` };
      }
    } catch (e) {
      g = { pass: false, evidence: `probe threw: ${e.message}` }; // absence of evidence = FAIL
    }
    if (!g.pass) fails++;
    results.push({ id: c.id, desc: c.desc, ...g });
  }
  return { fails, results };
}

export { formatReport };

// --- CLI entry ---------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const contractPath = process.argv[2];
  const cmd = process.argv[3];
  if (!contractPath || !cmd) {
    console.error('usage: node snapshot-oracle.mjs <contract.json> "<command to run the deliverable>"');
    process.exit(2);
  }
  let contract;
  try { contract = JSON.parse(readFileSync(contractPath, "utf8")); }
  catch (e) { console.error(`cannot read contract ${contractPath}: ${e.message}`); process.exit(2); }
  if (!Array.isArray(contract.criteria) || contract.criteria.length === 0) {
    console.error(`contract ${contractPath} has no criteria[]`); process.exit(2);
  }
  const summary = runContract({ cmd, criteria: contract.criteria, baseDir: dirname(contractPath) });
  console.log(formatReport(`snapshot oracle: ${contractPath}`, summary));
  process.exit(summary.fails === 0 ? 0 : 1);
}
