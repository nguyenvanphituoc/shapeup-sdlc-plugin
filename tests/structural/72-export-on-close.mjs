// 72 — defect-plan-3.7 Stage 2: a run exports on every terminal ending, not only the one that
// ships. Sections: 118, 119, 120.
//
// THE DEFECT. `report export` (kernel/report/export.mjs) was called exactly once,
// `skills/tech-lead/workflows/shapeup-run.js`'s Ship phase, through `advisory(...)` — a call site
// inside a phase that `aborted`, `escalated` and `gate_h` runs never reach. Every fact those
// endings produced (orders, results, T0 verdicts, hook decisions, `graph.jsonl`) sat in the
// gitignored LOCAL tier and was wiped by the next `init run`, with nothing durable surviving it —
// and the runs whose records are worth most (the ones that never shipped) are exactly the ones the
// exporter never saw.
//
// THE FIX. `closeRun` (kernel/probe/resume.mjs) — the ONE call site that writes
// `closed_status`/`close_cause`/`closed_at` together, Stage 1's own close-out — now also runs the
// export for every terminal status EXCEPT `"shipped"`, through a private `exportOnClose` helper.
// `"shipped"` is deliberately excluded: the Ship phase's own `report export` call already covers
// it, several lines before this close-out runs, and Stage 2's own deliverable is to leave that
// path's output byte-comparable to before — add the endings that wrote nothing, change nothing
// about the one that did. Fail-open: an export that cannot write degrades the return with an
// `export_warning`, never the close itself.
//
// WHY THIS MODULE DRIVES REAL RUNS RATHER THAN READING SOURCE ALONE. Rule 7 ("a guard that asserts
// a call must also assert its effect") — proving `exportOnClose` is WIRED IN is only proof it
// exists to call; proving the files land on disk, for a close that actually happened, is the
// standard `tests/fixtures/s2-drive-export.mjs` (this stage's own acceptance driver) and this
// module both hold to. Section 120 is the one exception, checking the orchestrator's own call site
// at the source level — `shapeup-run.js` cannot be imported (58-relaunch-memory.mjs's own banner).

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

      // (a) aborted, via closeArm — the same path shapeup-run.js's closeIfTerminal drives.
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

      // (b) gate_h, via closeArm — closes AS escalated (operator decision 1 from Stage 1).
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

      // (c) escalated, via closeRun DIRECTLY — the operator/tech-lead-skill path, never a
      // RunReturn arm and never touching RUN_RETURN_CLOSE at all. Proves the export lives in the
      // one shared close-out, not in the arm-derivation layer above it.
      const escalated = closeRun(ws, "checkout", { status: "escalated", cause: "operator escalation driven by 72-export-on-close.mjs" });
      const escalatedRow = exportedRunRow(ws, runId);
      if (escalated.ok && escalatedRow?.closed_status === "escalated" && escalatedRow?.close_cause) {
        ok("(c) a direct closeRun(\"escalated\") call — never a RunReturn arm — exports on exactly the same terms");
      } else fail(`(c) direct escalated close did not export as expected: close=${JSON.stringify(escalated)} row=${JSON.stringify(escalatedRow)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("119. The shipped path is untouched, a failed export is advisory, and the guard is real");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "export-close-119a-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");

      // (a) NON-REGRESSION — the deliverable's own words: "do not change what a shipping run
      // writes, only add the endings that wrote nothing." closeRun("shipped") must not itself
      // create .shapeup/exports/ — that call site remains solely shapeup-run.js's own Ship-phase
      // `report export`, run separately, before this close-out is ever reached.
      const shipped = closeRun(ws, "checkout", { status: "shipped", cause: "verdict=pass driven by 72-export-on-close.mjs" });
      const exportsExists = existsSync(join(ws, ".shapeup", "exports"));
      if (shipped.ok && shipped.export_warning === undefined && !exportsExists) {
        ok("(a) closeRun(\"shipped\") writes no .shapeup/exports/ of its own — the Ship phase's existing export call is the only one for this ending");
      } else fail(`(a) closeRun(\"shipped\") side-effects changed: close=${JSON.stringify(shipped)} exportsExists=${exportsExists}`);
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
  section("120. The orchestrator's own wiring — source-level, since shapeup-run.js cannot be executed here");
  // ===============================================================================================
  const runJs = read(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"));

  // The Ship-phase export call site Stage 2 must leave untouched — same command, same phase label.
  if (/await advisory\(`report export --slug \$\{slug\}`, "Ship", "export-run"\);/.test(runJs)) {
    ok("(a) the Ship phase's own \"report export --slug\" call site is unchanged — the shipped path's export stays byte-comparable to before Stage 2");
  } else {
    fail("(a) the Ship phase's \"report export --slug\" call site has changed or gone missing — Stage 2 was only meant to add the endings that wrote nothing");
  }

  // closeIfTerminal must not have grown a SECOND explicit export call of its own — the export for
  // aborted/escalated/gate_h is meant to arrive as a side effect of the existing
  // `--close-arm` dispatch (kernel/probe/resume.mjs), not as new prose in this file.
  const closeIfTerminalMatch = runJs.match(/async function closeIfTerminal\(ret\) \{([\s\S]*?)\n\}\n/);
  if (closeIfTerminalMatch && !/report export/.test(closeIfTerminalMatch[1])) {
    ok("(b) closeIfTerminal calls no \"report export\" of its own — the export for a non-shipped ending is the kernel close-out's own side effect, not duplicated prose here");
  } else {
    fail(`(b) closeIfTerminal appears to call "report export" directly: ${closeIfTerminalMatch ? closeIfTerminalMatch[1].slice(0, 200) : "function not found"}`);
  }

  // A failed export must surface, never be swallowed — closeIfTerminal reads it off the close
  // command's own report and pushes it onto stateWarnings, the same channel every other
  // close-degradation in this function already uses.
  if (closeIfTerminalMatch && /r\.export_warning/.test(closeIfTerminalMatch[1]) && /stateWarnings\.push/.test(closeIfTerminalMatch[1])) {
    ok("(c) closeIfTerminal reads export_warning off the close command's report and pushes it onto stateWarnings — not swallowed");
  } else {
    fail("(c) closeIfTerminal does not appear to surface an export_warning onto stateWarnings");
  }
}
