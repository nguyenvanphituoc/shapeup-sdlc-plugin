#!/usr/bin/env node
// CONTRACT CHECK — execute the migration's acceptance rows, and refuse to print a count without
// the gate it sits under.
//
// WHY THIS EXISTS. Two defects, both measured on this branch, and they compound:
//
//   1. ROWS THAT COULD NOT FAIL. Three of the execution contract's 23 rows passed on text that
//      predates the branch: a case-insensitive `pin` grep matched a **Pinned:** in the 1.6.2
//      CHANGELOG entry; a recursive `gate-zerowork` grep matched three pre-existing test files;
//      a `kill|resume` grep was satisfiable by a sentence saying the probe had NOT been run. The
//      run navigated by that gauge for three runs, and the only reason anybody found out is that
//      a human read the rows by hand. `--mutate` is the mechanical version of reading them: break
//      what each row cites, and assert the row goes red.
//
//   2. A ROW COUNT READ AS PROGRESS ABOVE A FAILED GATE. After Stage A the contract read 19 PASS
//      / 4 RED with all six S2 rows green — and S2's ship gate was NOT met, because the probe
//      those rows record came back FAIL. The rows prove the evidence file was written and is
//      machine-readable; they were never designed to encode the probe's verdict. So this tool
//      prints the gate FIRST and the count second, and exits non-zero when the gate is unmet no
//      matter how many rows are green.
//
// USAGE
//   node tools/contract-check.mjs                  # run every row, print gate + count
//   node tools/contract-check.mjs --stage S2       # only one stage's rows
//   node tools/contract-check.mjs --mutate         # G5: prove each row can fail
//   node tools/contract-check.mjs --json           # machine-readable
//
// Exit: 0 gate met and all rows green · 1 rows red or gate unmet · 2 the contract could not be read.

import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = join(ROOT, "docs/migration/execution-contract.md");

/** The evidence files whose status lines ARE the gates, in the order a reader should meet them. */
export const GATES = [
  {
    id: "S2 ship gate — kill/resume probe",
    file: "docs/migration/stage2-evidence.md",
    line: /^kill-resume-probe:\s*(PASS|FAIL|NOT-RUN)\s*$/m,
    met: (v) => v === "PASS",
    consequence: "Stage B does not start. The fast-forward re-dispatches a completed phase on relaunch — the property the cutover exists to buy.",
  },
];

/** Split a markdown table row on unescaped pipes, then unescape the rest. */
function cells(line) {
  return line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim().replace(/\\\|/g, "|"));
}

/**
 * Read the acceptance table out of the contract.
 * @returns {Array<{stage: string, cmd: string, expectExit: number, expectMatch: string, expectAbsent: string, index: number}>}
 */
export function parseContract(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!/^\|\s*S\d\s*\|/.test(line)) continue;
    const c = cells(line);
    if (c.length < 6) continue;
    rows.push({
      stage: c[0], cmd: c[1], cwd: c[2], expectExit: Number(c[3]),
      expectMatch: c[4], expectAbsent: c[5], index: rows.length + 1,
    });
  }
  return rows;
}

/** Execute one row against a tree. `$CLONE` is the tree under test. */
export function runRow(row, tree) {
  const r = spawnSync("sh", ["-c", row.cmd], { cwd: tree, encoding: "utf8", timeout: 300_000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const exitOk = r.status === row.expectExit;
  const matchOk = !row.expectMatch || out.includes(row.expectMatch);
  const absentOk = !row.expectAbsent || !new RegExp(row.expectAbsent).test(out);
  return { pass: exitOk && matchOk && absentOk, exit: r.status, out: out.slice(-400) };
}

/** Every file path a row's command names, so a mutation knows what to break. */
export function citedFiles(cmd) {
  const out = new Set();
  for (const m of cmd.matchAll(/(?:^|[\s"'`])((?:docs|tests|skills|hooks|commands|oracles)\/[\w./-]+|CHANGELOG\.md|README\.md)/g)) {
    out.add(m[1].replace(/["'`]+$/, ""));
  }
  return [...out];
}

/**
 * G5 — prove a row can fail. The generic mutation is "empty the artifact this row cites", which
 * is the honest form of the question the three false-passing rows failed: does this row read the
 * work, or does it read text that happens to be nearby?
 *
 * Rows this cannot mutate generically are REPORTED, never silently skipped — a mutation harness
 * with an invisible skip list is the same defect one layer up.
 */
export function mutateRow(row) {
  if (/npm test/.test(row.cmd)) {
    return { mutatable: false, why: "runs the whole suite; emptying a file would prove nothing about this row" };
  }
  const files = citedFiles(row.cmd).filter((f) => existsSync(join(ROOT, f)));
  if (files.length === 0) {
    return { mutatable: false, why: "names no file that exists — nothing to break" };
  }
  if (/^\s*!/.test(row.cmd)) {
    return { mutatable: false, why: "a negative row: emptying its file makes it pass harder, not fail. Mutate by INSERTING the forbidden text, which needs the row's own intent" };
  }

  const ws = mkdtempSync(join(tmpdir(), "contract-mutate-"));
  try {
    // Mutate in place with a backup, then restore. A full clone per row costs ~1 s each and the
    // rows are read-only greps; the restore is in a finally.
    const backups = files.map((f) => {
      const b = join(ws, f.replace(/\//g, "_"));
      copyFileSync(join(ROOT, f), b);
      return { f, b };
    });
    try {
      for (const { f } of backups) writeFileSync(join(ROOT, f), "");
      const after = runRow(row, ROOT);
      return {
        mutatable: true, broke: files, red: !after.pass,
        why: after.pass ? "the row still PASSED with its own evidence emptied — it is not reading the work it claims to" : null,
      };
    } finally {
      for (const { f, b } of backups) copyFileSync(b, join(ROOT, f));
    }
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}

/** Resolve every gate from its evidence file. A missing file is NOT-RUN, never "met". */
export function readGates() {
  return GATES.map((g) => {
    const p = join(ROOT, g.file);
    if (!existsSync(p)) return { ...g, value: "MISSING", met: false };
    const m = g.line.exec(readFileSync(p, "utf8"));
    const value = m ? m[1] : "NOT-RECORDED";
    return { ...g, value, met: g.met(value) };
  });
}

function main() {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes("--json");
  const wantMutate = argv.includes("--mutate");
  const stage = argv.includes("--stage") ? argv[argv.indexOf("--stage") + 1] : null;

  if (!existsSync(CONTRACT)) {
    console.error(`no contract at ${CONTRACT}`);
    process.exit(2);
  }
  const all = parseContract(readFileSync(CONTRACT, "utf8"));
  const rows = stage ? all.filter((r) => r.stage === stage) : all;
  if (rows.length === 0) {
    console.error(`no acceptance rows${stage ? ` for stage ${stage}` : ""} — the table did not parse`);
    process.exit(2);
  }

  const gates = readGates();
  const results = rows.map((row) => ({ row, ...runRow(row, ROOT) }));
  const mutations = wantMutate ? rows.map((row) => ({ row, ...mutateRow(row) })) : [];

  const passed = results.filter((r) => r.pass).length;
  const gateMet = gates.every((g) => g.met);
  const unfalsifiable = mutations.filter((m) => m.mutatable && !m.red);

  if (wantJson) {
    console.log(JSON.stringify({
      gate_met: gateMet,
      gates: gates.map(({ id, value, met }) => ({ id, value, met })),
      rows: { total: rows.length, pass: passed, red: rows.length - passed },
      red_rows: results.filter((r) => !r.pass).map((r) => ({ stage: r.row.stage, cmd: r.row.cmd, exit: r.exit })),
      mutation: wantMutate ? {
        falsifiable: mutations.filter((m) => m.mutatable && m.red).length,
        unfalsifiable: unfalsifiable.map((m) => ({ cmd: m.row.cmd, why: m.why })),
        not_mutatable: mutations.filter((m) => !m.mutatable).map((m) => ({ cmd: m.row.cmd, why: m.why })),
      } : null,
    }, null, 2));
    process.exit(gateMet && passed === rows.length && unfalsifiable.length === 0 ? 0 : 1);
  }

  // The gate first, always. The count is meaningless above a failed gate and this ordering is the
  // whole reason the tool exists.
  for (const g of gates) {
    console.log(`${g.met ? "GATE MET" : "GATE NOT MET"} — ${g.id}: ${g.value}`);
    if (!g.met) console.log(`   ${g.consequence}`);
  }
  console.log(`\n${passed} PASS / ${rows.length - passed} RED${stage ? ` (stage ${stage})` : ""}`);
  for (const r of results.filter((x) => !x.pass)) {
    console.log(`  RED  ${r.row.stage}  ${r.row.cmd.slice(0, 100)}${r.row.cmd.length > 100 ? "…" : ""}  (exit ${r.exit})`);
  }
  if (!gateMet) console.log("\nThe row count above is not progress. A green row proves its evidence file was written; the gate is what the evidence SAYS.");

  if (wantMutate) {
    console.log(`\nFalsifiability (G5) — ${mutations.filter((m) => m.mutatable && m.red).length}/${mutations.filter((m) => m.mutatable).length} mutatable rows went red under mutation`);
    for (const m of unfalsifiable) console.log(`  CANNOT FAIL  ${m.row.cmd.slice(0, 90)}  — ${m.why}`);
    for (const m of mutations.filter((x) => !x.mutatable)) console.log(`  not mutatable  ${m.row.cmd.slice(0, 70)}  — ${m.why}`);
  }

  process.exit(gateMet && passed === rows.length && unfalsifiable.length === 0 ? 0 : 1);
}

if (isMain(import.meta.url)) {
  main();
}
