#!/usr/bin/env node
// s2-drive-export.mjs — defect-plan-3.7 Stage 2: drive a run's terminal close through the kernel's
// export-on-close derivation (`kernel/probe/resume.mjs`'s `closeRun`/`closeArm`, calling
// `kernel/report/export.mjs`) end to end, against a real throwaway run, and read the outcome back
// OFF DISK — never off the call site (guardrail rule 7: "a guard that asserts a call must also
// assert its effect").
//
// Usage: node tests/fixtures/s2-drive-export.mjs <mode>
//   <mode> ∈ aborted | gate_h | escalated | fail-export | no-export-assert
//     aborted / gate_h  — a RunReturn arm, closed through `closeArm`/`RUN_RETURN_CLOSE`, exactly
//       as `shapeup-run.js`'s own `closeIfTerminal` would drive it.
//     escalated         — NOT a RunReturn arm; the direct path an operator or the tech-lead skill's
//       own prose-driven close takes, straight through `closeRun`. Proves both paths export.
//     fail-export       — drives an `aborted` close with `.shapeup/exports` pre-occupied by a plain
//       FILE (not a directory), the cheapest close-write failure that does not depend on the
//       process's own uid (a chmod-based read-only directory is silently bypassed when the fixture
//       runs as root, which a sandboxed agent sometimes does). The close must still stand and the
//       failure must surface on the return value, not be swallowed.
//     no-export-assert  — the fixture's OWN falsifier. Re-runs the `aborted` case with export
//       explicitly disabled (`withExport:false`) and performs the SAME assertion the `aborted` mode
//       does, which must now fail: proving this driver actually reads the exported artifact rather
//       than printing success regardless of whether anything was written.
//
// Prints `EXPORT OK closed_status=<v>` when `.shapeup/exports/<run_id>/run.jsonl` holds one row
// carrying the expected `closed_status` and a non-empty `close_cause`, or `CLOSE INTACT <warning>`
// for `fail-export` when the close still took and the export failure is on the return value.
// Exits 2 on a malformed invocation or fixture-setup failure (rule 3), 1 when an assertion fails.

import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mode = process.argv[2];
const KNOWN = ["aborted", "gate_h", "escalated", "fail-export", "no-export-assert"];

if (!mode || !KNOWN.includes(mode)) {
  console.error(`usage: node tests/fixtures/s2-drive-export.mjs <${KNOWN.join("|")}>`);
  process.exit(2);
}

// Never the live ledger (guardrail rule 5) — a throwaway workspace, and the decisions channel
// redirected before the fixture opens a run, in case any call site along the way logs one.
const ws = mkdtempSync(join(tmpdir(), "s2-drive-export-"));
process.env.SHAPEUP_DECISIONS_PATH = join(ws, "decisions.jsonl");

const { closeArm, closeRun, parseFrontmatter } = await import(join(ROOT, "kernel/probe/resume.mjs"));
const { harnessRun, receipt: receiptPath, readReceipt, runIdFromReceipt } = await import(join(ROOT, "kernel/lib/paths.mjs"));

/** Read back `<ws>/.shapeup/exports/<runId>/run.jsonl` off disk — the one row it must hold. */
function readExportedRunRow(runId) {
  const p = join(ws, ".shapeup", "exports", String(runId), "run.jsonl");
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, "utf8").split("\n").filter((l) => l.trim());
  if (lines.length !== 1) return null;
  try { return JSON.parse(lines[0]); } catch { return null; }
}

try {
  const slug = "s2-fixture";
  const opened = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", slug, "--intake-text", "Drive the S2 export-on-close fixture end to end",
    "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
  if (opened.status !== 0) {
    console.error(`CANNOT OPEN FIXTURE RUN (exit ${opened.status}): ${opened.stderr || opened.stdout}`);
    process.exit(2);
  }

  const rec = readReceipt(receiptPath(ws, slug));
  const runId = rec && runIdFromReceipt(rec);
  if (!runId) {
    console.error("CANNOT RESOLVE run_id FROM THE FIXTURE RUN'S OWN RECEIPT");
    process.exit(2);
  }

  /**
   * Drive one `aborted` close (through the RunReturn-arm path) and assert the exported run row —
   * shared by the `aborted` mode and the `no-export-assert` falsifier, which is the same drive with
   * export turned off.
   * @param {boolean} withExport
   * @returns {{ok:boolean, r:object, row:(object|null)}}
   */
  function driveAbortedAndAssert(withExport) {
    const r = closeArm(ws, slug, "aborted", "driven by s2-drive-export.mjs", withExport);
    if (r.terminal !== true || !r.ok) {
      console.error(`CLOSE DID NOT TAKE: ${r.reason || JSON.stringify(r)}`);
      process.exit(2);
    }
    const row = readExportedRunRow(runId);
    const ok = !!row && row.closed_status === "aborted" && !!row.close_cause;
    return { ok, r, row };
  }

  if (mode === "aborted") {
    const { ok, r, row } = driveAbortedAndAssert(true);
    if (!ok) {
      console.error(`EXPORT DID NOT SURVIVE THE CLOSE: ${JSON.stringify(row)}`);
      process.exit(1);
    }
    console.log(`EXPORT OK closed_status=${r.status}`);
    process.exit(0);
  }

  if (mode === "gate_h" || mode === "escalated") {
    const r = mode === "gate_h"
      ? closeArm(ws, slug, "gate_h", "breaker=outer driven by s2-drive-export.mjs")
      : closeRun(ws, slug, { status: "escalated", cause: "driven by s2-drive-export.mjs (direct escalated close)" });
    if (!r.ok) {
      console.error(`CLOSE DID NOT TAKE: ${r.reason || JSON.stringify(r)}`);
      process.exit(2);
    }
    const row = readExportedRunRow(runId);
    if (!row || row.closed_status !== "escalated" || !row.close_cause) {
      console.error(`EXPORT DID NOT SURVIVE THE CLOSE: ${JSON.stringify(row)}`);
      process.exit(1);
    }
    console.log(`EXPORT OK closed_status=${row.closed_status}`);
    process.exit(0);
  }

  if (mode === "fail-export") {
    // The cheapest close-write failure that does not depend on the process's own uid: occupy the
    // exports root with a plain FILE, so the writer's own `mkdirSync(..., {recursive:true})` throws
    // ENOTDIR rather than silently succeeding for a root-owned sandbox that ignores permission bits.
    mkdirSync(join(ws, ".shapeup"), { recursive: true });
    writeFileSync(join(ws, ".shapeup", "exports"), "occupied by s2-drive-export.mjs (fail-export mode)\n");

    const r = closeArm(ws, slug, "aborted", "driven by s2-drive-export.mjs (fail-export mode)");
    if (r.terminal !== true || !r.ok) {
      console.error(`CLOSE DID NOT TAKE: ${r.reason || JSON.stringify(r)}`);
      process.exit(2);
    }
    // The close itself must stand — read back off disk, not off the in-memory return.
    const fm = parseFrontmatter(readFileSync(harnessRun(ws, slug), "utf8"));
    if (fm.closed_status !== "aborted" || !fm.closed_at || fm.closed_at === "~") {
      console.error(`CLOSE DID NOT SURVIVE THE FAILED EXPORT: closed_status=${fm.closed_status} closed_at=${fm.closed_at}`);
      process.exit(1);
    }
    if (!r.export_warning) {
      console.error(`EXPORT FAILURE WAS SWALLOWED — the close's own return carries no export_warning: ${JSON.stringify(r)}`);
      process.exit(1);
    }
    console.log(`CLOSE INTACT ${r.export_warning}`);
    process.exit(0);
  }

  // no-export-assert — the falsifier. Same assertion as `aborted`, export explicitly turned off.
  const { ok, row } = driveAbortedAndAssert(false);
  if (ok) {
    // Deliberately NOT exit 1 here: a falsifier that cannot fail is the defect this mode exists to
    // catch, and printing that plainly (rather than a bare non-zero exit indistinguishable from the
    // real assertion failing below) is what "STATE THE FALSIFIER" (guardrail rule 6) asks for.
    console.error("FALSIFIER FAILED — the export assertion passed with the export step disabled, " +
      "which means it asserts nothing real.");
    process.exit(0);
  }
  console.error(`export step disabled — assertion correctly failed: ${JSON.stringify(row)}`);
  process.exit(1);
} finally {
  rmSync(ws, { recursive: true, force: true });
}
