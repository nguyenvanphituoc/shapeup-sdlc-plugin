// 72 — A RUN EXPORTS ON EVERY TERMINAL ENDING, `shipped` INCLUDED. Sections: 118, 119, 120.
//
// THE DEFECT, originally. `report export` (kernel/report/export.mjs) was called from exactly one place, a
// ship phase that `aborted`, `escalated` and `gate_h` runs never reach. Every fact those endings produced
// (orders, results, T0 verdicts, hook decisions, `graph.jsonl`) sat in the gitignored LOCAL tier and was
// wiped by the next `init run`, with nothing durable surviving it — and the runs whose records are worth
// most (the ones that never shipped) are exactly the ones the exporter never saw.
//
// THE FIX, and where it stands now. `closeRun` (kernel/probe/resume.mjs) — the ONE call site that writes
// `closed_status`/`close_cause`/`closed_at` together — runs the export for every terminal status through a
// private `exportOnClose` helper. It used to leave `shipped` out because the ship phase's own export call
// covered it. That call lived in the retired run script and `probe next` makes none, so a `shipped` close
// that skipped the export would be a run that ships and leaves no durable trace: the exception is gone,
// and section 119(a) pins the new rule. Fail-open: an export that cannot write degrades the return with an
// `export_warning`, never the close itself.
//
// WHY THIS MODULE DRIVES REAL RUNS RATHER THAN READING SOURCE ALONE. A guard that asserts a call must also
// assert its effect — proving `exportOnClose` is WIRED IN is only proof it exists to call; proving the files
// land on disk, for a close that actually happened, is what this module holds to.

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/** Open a real run exactly as the orchestrator does (see tests/structural/19-run-records.mjs). */
function openRun(ROOT, ws, slug, intake) {
  const r = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", slug, "--intake-text", intake, "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
  if (r.status !== 0) throw new Error(`init run failed: ${r.stderr || r.stdout}`);
}

/** The exported run row, read back off disk — null when no export landed at all. */
function exportedRunRow(ws, runId) {
  const p = join(ws, ".shapeup", "exports", String(runId), "run.jsonl");
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, "utf8").split("\n").filter((l) => l.trim());
  return lines.length === 1 ? JSON.parse(lines[0]) : null;
}

export async function run(ctx) {
  const { ROOT, ok, fail, section, read } = ctx;

  const { closeArm, closeRun } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  const { readReceipt, receipt: receiptPath, runIdFromReceipt } = await import(join(ROOT, "kernel/lib/paths.mjs"));

  const runIdOf = (ws, slug) => runIdFromReceipt(readReceipt(receiptPath(ws, slug)));

  // ===============================================================================================
  section("118. Every non-shipped terminal ending exports — both the arm path and the direct path");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "export-close-118-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");
      const runId = runIdOf(ws, "checkout");

      // (a) aborted, via closeArm — the path every `probe next` close command takes.
      const aborted = closeArm(ws, "checkout", "aborted", "driven by 72-export-on-close.mjs");
      const abortedRow = exportedRunRow(ws, runId);
      if (aborted.ok && aborted.terminal && abortedRow?.closed_status === "aborted" && abortedRow?.close_cause) {
        ok("(a) an aborted close leaves .shapeup/exports/<run_id>/run.jsonl carrying closed_status=aborted and a close_cause");
      } else fail(`(a) aborted close did not export as expected: close=${JSON.stringify(aborted)} row=${JSON.stringify(abortedRow)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }
  {
    const ws = mkdtempSync(join(tmpdir(), "export-close-118b-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");
      const runId = runIdOf(ws, "checkout");

      // (b) gate_h, via closeArm — closes AS escalated.
      const gateH = closeArm(ws, "checkout", "gate_h", "breaker=outer driven by 72-export-on-close.mjs");
      const gateHRow = exportedRunRow(ws, runId);
      if (gateH.ok && gateH.terminal && gateHRow?.closed_status === "escalated" && gateHRow?.close_cause) {
        ok("(b) a gate_h close (closes AS escalated) leaves an exported run row carrying closed_status=escalated");
      } else fail(`(b) gate_h close did not export as expected: close=${JSON.stringify(gateH)} row=${JSON.stringify(gateHRow)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }
  {
    const ws = mkdtempSync(join(tmpdir(), "export-close-118c-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");
      const runId = runIdOf(ws, "checkout");

      // (c) escalated, via closeRun DIRECTLY — the operator path, never an arm and never touching
      // CLOSE_ARM_STATUS at all. Proves the export lives in the one shared close-out, not in the
      // arm-derivation layer above it.
      const escalated = closeRun(ws, "checkout", { status: "escalated", cause: "operator escalation driven by 72-export-on-close.mjs" });
      const escalatedRow = exportedRunRow(ws, runId);
      if (escalated.ok && escalatedRow?.closed_status === "escalated" && escalatedRow?.close_cause) {
        ok("(c) a direct closeRun(\"escalated\") call — never an arm — exports on exactly the same terms");
      } else fail(`(c) direct escalated close did not export as expected: close=${JSON.stringify(escalated)} row=${JSON.stringify(escalatedRow)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("119. A shipped close exports too, a failed export is advisory, and the guard is real");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "export-close-119a-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");

      // (a) `shipped` exports like every other ending. The ship phase that used to export for it is gone,
      // so the close is the only call site left; a shipped close that wrote nothing would leave the
      // runs that DID ship with no durable trace.
      const runId = runIdOf(ws, "checkout");
      const shipped = closeRun(ws, "checkout", { status: "shipped", cause: "verdict=pass driven by 72-export-on-close.mjs" });
      const row = exportedRunRow(ws, runId);
      if (shipped.ok && shipped.export_warning === undefined && row?.closed_status === "shipped" && row?.close_cause) {
        ok("(a) closeRun(\"shipped\") writes .shapeup/exports/<run_id>/run.jsonl carrying closed_status=shipped — every ending exports, none is exempted by a call site that no longer exists");
      } else fail(`(a) a shipped close did not export: close=${JSON.stringify(shipped)} row=${JSON.stringify(row)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }
  {
    const ws = mkdtempSync(join(tmpdir(), "export-close-119b-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");

      // (b) FAIL-OPEN — occupy .shapeup/exports with a plain FILE (not a directory) so the writer's
      // own mkdirSync(..., {recursive:true}) throws ENOTDIR. A chmod-based read-only directory is
      // the more obvious sabotage but is silently bypassed by a root-owned sandbox process, which a
      // structural suite sometimes runs under — this failure mode does not depend on uid at all.
      mkdirSync(join(ws, ".shapeup"), { recursive: true });
      writeFileSync(join(ws, ".shapeup", "exports"), "occupied by 72-export-on-close.mjs\n");

      const aborted = closeRun(ws, "checkout", { status: "aborted", cause: "driven by 72-export-on-close.mjs (fail-export)" });
      const ledger = read(join(ws, ".shapeup", "checkout", "harness-run.md"));
      const closeStood = /^closed_status:\s*aborted/m.test(ledger) && !/^closed_at:\s*~/m.test(ledger);
      if (aborted.ok && closeStood && typeof aborted.export_warning === "string" && aborted.export_warning.length) {
        ok("(b) a close-write failure in the export leaves the close intact and surfaces export_warning on the return — never swallowed, never fatal to the close");
      } else fail(`(b) a blocked export did not degrade gracefully: close=${JSON.stringify(aborted)} closeStood=${closeStood}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }
  {
    const ws = mkdtempSync(join(tmpdir(), "export-close-119c-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");
      const runId = runIdOf(ws, "checkout");

      // (c) THE GUARD'S OWN FALSIFIER — closeArm's withExport:false must produce a close with NO
      // export at all, proving (a)/(b)/118's assertions read a real artifact rather than a return
      // value that always looks the same regardless of whether anything was written.
      const noExport = closeArm(ws, "checkout", "aborted", "driven by 72-export-on-close.mjs (withExport=false)", false);
      const row = exportedRunRow(ws, runId);
      if (noExport.ok && noExport.terminal && row === null) {
        ok("(c) withExport:false closes the run but writes no export row — the falsifier the acceptance table's BOTH_DIRECTIONS row drives for real");
      } else fail(`(c) withExport:false still produced an export row: close=${JSON.stringify(noExport)} row=${JSON.stringify(row)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("120. The loop makes no export call of its own — the close is the one call site");
  // ===============================================================================================
  const next = read(join(ROOT, "kernel/probe/next.mjs"));
  if (!/report export/.test(next)) {
    ok("(a) `probe next` hands out no `report export` command: the export is the close's own side effect, so no step can skip it and none can run it twice");
  } else fail("(a) probe next carries a `report export` command — the export must stay the close's side effect, not a step a session can skip");
  const resume = read(join(ROOT, "kernel/probe/resume.mjs"));
  if (/const shouldExport = withExport;/.test(resume) && !/status !== "shipped"/.test(resume.slice(resume.indexOf("const shouldExport") - 200, resume.indexOf("const shouldExport") + 200))) {
    ok("(b) closeRun exports for every terminal status unless a test fixture passes withExport:false");
  } else fail("(b) closeRun's export is gated on the status again");
}
