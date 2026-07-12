#!/usr/bin/env node
// Shared `process` oracle for the evaluation contract (Stage G of the audit).
//
// This is the promoted, parameterized form of the todo-cli prototype: instead of hard-coding
// criteria, it reads a *declarative contract* (a list of criteria, each with a `probe` and an
// `expect`) and grades the OBSERVED exit code + stdout/stderr of a spawned process — never the
// source. It is the runner `spec-evaluator` calls for any criterion tagged `oracle: process`
// (CLI / script deliverables, where there is no browser to drive).
//
// Invariants carried over from the evaluator's design:
//   • Probe behavior, not code presence — every verdict cites runtime output.
//   • Absence of evidence = FAIL — a probe that throws or cannot run FAILs, never silently passes.
//   • One verdict per criterion.
//
// Library use (what the evaluator calls):
//   import { runContract } from ".../scripts/oracles/process-oracle.mjs";
//   const { fails, results } = runContract({ cmd: "node ./todo.js", criteria });
//
// CLI use (smoke / CI):
//   node process-oracle.mjs <contract.json> "<command to run the deliverable>"
//   e.g. node process-oracle.mjs todo.contract.json "node ./todo.js"
//   Exit 0 = all criteria PASS, 1 = at least one FAIL, 2 = usage/contract error.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CRASH_RE = /at\s+.*:\d+:\d+|Traceback|panic:|unhandled|Segmentation fault/i;

// Spawn the deliverable with controlled argv and a controlled store file.
// `store` semantics: a string seeds $TODO_STORE with that content; null = no store file
// (exercises first-run/missing-store behavior). The probe never touches the real cwd.
function spawnProbe(cmd, probe) {
  const [bin, ...baseArgs] = cmd.split(/\s+/).filter(Boolean);
  const argv = probe.argv || [];
  const dir = mkdtempSync(join(tmpdir(), "process-oracle-"));
  const store = join(dir, "store.json");
  const env = { ...process.env };
  if (probe.store !== undefined && probe.store !== null) {
    writeFileSync(store, probe.store);
    env.TODO_STORE = store;
  } else {
    env.TODO_STORE = store; // path that does not exist yet → exercises missing-store path
  }
  const res = spawnSync(bin, [...baseArgs, ...argv], {
    encoding: "utf8",
    env,
    timeout: probe.timeout_ms || 10_000,
    input: probe.stdin,
  });
  rmSync(dir, { recursive: true, force: true });
  const out = (res.stdout || "") + (res.stderr || "");
  return { code: res.status, out, crashed: CRASH_RE.test(out), spawnError: res.error?.message };
}

// Interpret one `expect` clause against an observed result. Returns true/false.
//   exit:     number | "==0" | "!=0" | ">0" | "<N" | ">=N" | "*"   (default: any)
//   stdout:   "/regex/flags"  — must match combined stdout+stderr
//   stderr:   "/regex/flags"  — alias kept for readability; same combined stream
//   no_crash: true            — require no stack-trace/panic signature in output
function matchExit(spec, code) {
  if (spec === undefined || spec === "*") return true;
  if (typeof spec === "number") return code === spec;
  const m = String(spec).match(/^(==|!=|>=|<=|>|<)\s*(-?\d+)$/);
  if (!m) return false;
  const n = Number(m[2]);
  switch (m[1]) {
    case "==": return code === n;
    case "!=": return code !== n;
    case ">":  return code > n;
    case "<":  return code < n;
    case ">=": return code >= n;
    case "<=": return code <= n;
    default:   return false;
  }
}
function toRegExp(spec) {
  const m = String(spec).match(/^\/(.*)\/([a-z]*)$/);
  return m ? new RegExp(m[1], m[2]) : new RegExp(spec);
}
function grade(expect, r) {
  const reasons = [];
  let pass = true;
  if (!matchExit(expect.exit, r.code)) { pass = false; reasons.push(`exit ${r.code} ≠ expected ${expect.exit}`); }
  for (const key of ["stdout", "stderr"]) {
    if (expect[key] !== undefined && !toRegExp(expect[key]).test(r.out)) {
      pass = false; reasons.push(`output does not match ${key} ${expect[key]}`);
    }
  }
  if (expect.no_crash && r.crashed) { pass = false; reasons.push("crashed (stack trace / panic in output)"); }
  const evidence =
    `exit ${r.code}, crashed=${r.crashed}` +
    (r.spawnError ? `, spawnError=${r.spawnError}` : "") +
    `, out=${JSON.stringify(r.out.trim().slice(0, 100))}` +
    (reasons.length ? `  [${reasons.join("; ")}]` : "");
  return { pass, evidence };
}

// Run every criterion in a contract against `cmd`. Pure of I/O except spawning the deliverable.
export function runContract({ cmd, criteria }) {
  const results = [];
  let fails = 0;
  for (const c of criteria) {
    let g;
    try {
      const r = spawnProbe(cmd, c.probe || {});
      g = grade(c.expect || {}, r);
    } catch (e) {
      g = { pass: false, evidence: `probe threw: ${e.message}` }; // absence of evidence = FAIL
    }
    if (!g.pass) fails++;
    results.push({ id: c.id, desc: c.desc, ...g });
  }
  return { fails, results };
}

export function formatReport(cmd, { fails, results }) {
  const lines = [`\nEvaluation report — process oracle for: ${cmd}\n${"=".repeat(60)}`];
  for (const r of results) {
    lines.push(`${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.desc}\n        ⇒ ${r.evidence}`);
  }
  lines.push("=".repeat(60));
  lines.push(fails === 0 ? `✅ all ${results.length} criteria PASS` : `❌ ${fails}/${results.length} criteria FAIL`);
  return lines.join("\n");
}

// --- CLI entry (only when run directly, not when imported) -------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const contractPath = process.argv[2];
  const cmd = process.argv[3];
  if (!contractPath || !cmd) {
    console.error('usage: node process-oracle.mjs <contract.json> "<command to run the deliverable>"');
    process.exit(2);
  }
  let contract;
  try { contract = JSON.parse(readFileSync(contractPath, "utf8")); }
  catch (e) { console.error(`cannot read contract ${contractPath}: ${e.message}`); process.exit(2); }
  if (!Array.isArray(contract.criteria) || contract.criteria.length === 0) {
    console.error(`contract ${contractPath} has no criteria[]`); process.exit(2);
  }
  const summary = runContract({ cmd, criteria: contract.criteria });
  console.log(formatReport(cmd, summary));
  process.exit(summary.fails === 0 ? 0 : 1);
}
