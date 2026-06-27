#!/usr/bin/env node
// `test` oracle for the evaluation contract (Stage G, step 4a of the audit).
//
// Deliverable: a library / module whose acceptance is "its own test suite is green".
// The oracle runs the project's test command and grades the OBSERVED suite result —
// exit code, executed-test count, and failing-test names — never the source.
//
// Why this oracle exists: a CLI is judged by `process`, a web app by `ui`, but a *library*
// has no runtime surface to drive — its contract is its tests. (probing.md "TDD-1": a suite
// that runs zero tests is NOT green, so `min_tests` defaults to 1.)
//
// Invariants (carried from the evaluator's design):
//   • Probe behavior, not code presence — the verdict cites the suite's own output.
//   • Absence of evidence = FAIL — a suite that cannot run, or runs nothing, FAILs.
//   • One verdict per criterion.
//
// Contract shape:
//   { "oracle": "test", "criteria": [
//       { "id": "T1", "desc": "suite green",
//         "probe": { "cmd": "node --test ./mathx.test.mjs", "cwd": "." },
//         "expect": { "exit": "==0", "min_tests": 1, "no_failures": true } } ] }
//
// `cmd` resolution: criterion.probe.cmd overrides the contract/CLI default. The parser
// understands node:test TAP (`# pass/# fail/# tests`, `ok`/`not ok`) and mocha-style
// "N passing / M failing"; falls back to counting TAP `ok`/`not ok` lines.
//
// Library use:  import { runContract } from ".../test-oracle.mjs"
// CLI use:      node test-oracle.mjs <contract.json> ["default test command"]
//               exit 0 = all PASS, 1 = ≥1 FAIL, 2 = usage/contract error.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { matchNum, toRegExp, formatReport } from "./_shared.mjs";

// Parse common test-runner output into { total, pass, fail, failing[] }.
function parseSuite(out) {
  const r = { total: null, pass: null, fail: null, failing: [] };

  // node:test summary lines — TAP reporter prefixes with `#`, the default spec reporter with `ℹ`.
  const mt = out.match(/^[#ℹ]\s*tests\s+(\d+)/m);
  const mp = out.match(/^[#ℹ]\s*pass\s+(\d+)/m);
  const mf = out.match(/^[#ℹ]\s*fail\s+(\d+)/m);
  if (mt) r.total = Number(mt[1]);
  if (mp) r.pass = Number(mp[1]);
  if (mf) r.fail = Number(mf[1]);

  // mocha / jest-ish summary
  if (r.pass === null) { const m = out.match(/(\d+)\s+passing/); if (m) r.pass = Number(m[1]); }
  if (r.fail === null) { const m = out.match(/(\d+)\s+failing/); if (m) r.fail = Number(m[1]); }

  // failing test names from TAP `not ok N - name`
  for (const m of out.matchAll(/^not ok\s+\d+\s+-\s+(.+)$/gm)) r.failing.push(m[1].trim());

  // Fallback: count raw TAP result lines if no summary was emitted.
  if (r.total === null) {
    const oks = (out.match(/^ok\s+\d+/gm) || []).length;
    const noks = (out.match(/^not ok\s+\d+/gm) || []).length;
    if (oks + noks > 0) { r.total = oks + noks; r.pass = oks; r.fail = noks; }
  }
  return r;
}

function runSuite(cmd, probe) {
  const [bin, ...baseArgs] = String(cmd).split(/\s+/).filter(Boolean);
  const res = spawnSync(bin, [...baseArgs, ...(probe.argv || [])], {
    encoding: "utf8",
    cwd: probe.cwd,
    timeout: probe.timeout_ms || 60_000,
  });
  const out = (res.stdout || "") + (res.stderr || "");
  return { code: res.status, out, spawnError: res.error?.message, parsed: parseSuite(out) };
}

function grade(expect, r) {
  const reasons = [];
  let pass = true;
  const p = r.parsed;

  if (r.spawnError) { pass = false; reasons.push(`suite did not run: ${r.spawnError}`); }
  if (!matchNum(expect.exit ?? "==0", r.code)) { pass = false; reasons.push(`suite exit ${r.code} ≠ expected ${expect.exit ?? "==0"}`); }

  const minTests = expect.min_tests ?? 1;
  if (p.total === null) { pass = false; reasons.push("no test results parsed (suite produced no recognizable output)"); }
  else if (p.total < minTests) { pass = false; reasons.push(`only ${p.total} test(s) ran, need ≥${minTests}`); }

  if ((expect.no_failures ?? true) && (p.fail ?? 0) > 0) {
    pass = false; reasons.push(`${p.fail} failing: ${p.failing.join(", ") || "(names unparsed)"}`);
  }
  if (expect.stdout !== undefined && !toRegExp(expect.stdout).test(r.out)) {
    pass = false; reasons.push(`output does not match ${expect.stdout}`);
  }

  const evidence =
    `suite exit ${r.code}; tests=${p.total ?? "?"} pass=${p.pass ?? "?"} fail=${p.fail ?? "?"}` +
    (p.failing.length ? `; failing=[${p.failing.join("; ")}]` : "") +
    (reasons.length ? `  [${reasons.join("; ")}]` : "");
  return { pass, evidence };
}

export function runContract({ cmd, criteria }) {
  const results = [];
  let fails = 0;
  for (const c of criteria) {
    let g;
    try {
      const useCmd = (c.probe && c.probe.cmd) || cmd;
      if (!useCmd) throw new Error("no test command (criterion.probe.cmd or contract default)");
      g = grade(c.expect || {}, runSuite(useCmd, c.probe || {}));
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
  const defaultCmd = process.argv[3];
  if (!contractPath) {
    console.error('usage: node test-oracle.mjs <contract.json> ["default test command"]');
    process.exit(2);
  }
  let contract;
  try { contract = JSON.parse(readFileSync(contractPath, "utf8")); }
  catch (e) { console.error(`cannot read contract ${contractPath}: ${e.message}`); process.exit(2); }
  if (!Array.isArray(contract.criteria) || contract.criteria.length === 0) {
    console.error(`contract ${contractPath} has no criteria[]`); process.exit(2);
  }
  const summary = runContract({ cmd: defaultCmd || contract.cmd, criteria: contract.criteria });
  console.log(formatReport(`test oracle: ${contractPath}`, summary));
  process.exit(summary.fails === 0 ? 0 : 1);
}
