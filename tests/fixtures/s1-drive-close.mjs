#!/usr/bin/env node
// s1-drive-close.mjs — HD-026, defect-plan-3.7 Stage 1: drive one RunReturn arm through the
// kernel's arm→status derivation end to end, against a real throwaway run, and read the outcome
// back OFF DISK — never off the call site (guardrail rule 7: "a guard that asserts a call must
// also assert its effect").
//
// Usage: node tests/fixtures/s1-drive-close.mjs <arm>
//   <arm> ∈ shipped | aborted | gate_h | paused | ok | escalated
//     shipped / aborted / gate_h / paused / ok — a RunReturn arm (domain.schema.json
//       `$defs/RunReturn.properties.status.enum`), resolved through `closeArm`/`RUN_RETURN_CLOSE`
//       (kernel/probe/resume.mjs) — the exact derivation shapeup-run.js's own `closeIfTerminal`
//       now calls instead of deciding locally which arms are terminal.
//     escalated — NOT a RunReturn arm; the schema's five members are the ones above. This is the
//       OTHER path to the same terminal status: an operator, or the tech-lead skill's own
//       prose-driven GATE H → L4 close, calling `probe resume --close escalated` directly —
//       `closeRun` already accepts it (TERMINAL_STATUSES has always carried `escalated`), this
//       stage did not add that. Both paths must land the identical on-disk shape, which is what
//       "gate_h" and "escalated" both printing `closed_status=escalated` proves.
//
// Prints `closed_status=<v> close_cause=<v> closed_at=<v>` (read back off disk) for a terminal
// close, or the literal `NO CLOSE` for an arm RUN_RETURN_CLOSE marks explicitly non-terminal.
// Exits 2 on a malformed invocation or a fixture-setup failure (rule 3: a broken probe is not a
// failing one), 1 when the close itself did not take.

import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arm = process.argv[2];
const KNOWN = ["shipped", "aborted", "gate_h", "paused", "ok", "escalated"];

if (!arm || !KNOWN.includes(arm)) {
  console.error(`usage: node tests/fixtures/s1-drive-close.mjs <${KNOWN.join("|")}>`);
  process.exit(2);
}

// Never the live ledger (guardrail rule 5) — a throwaway workspace, and the decisions channel
// redirected before the fixture opens a run, in case any call site along the way logs one.
const ws = mkdtempSync(join(tmpdir(), "s1-drive-close-"));
process.env.SHAPEUP_DECISIONS_PATH = join(ws, "decisions.jsonl");

try {
  const slug = "s1-fixture";
  const opened = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", slug, "--intake-text", "Drive the S1 close-out fixture end to end",
    "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
  if (opened.status !== 0) {
    console.error(`CANNOT OPEN FIXTURE RUN (exit ${opened.status}): ${opened.stderr || opened.stdout}`);
    process.exit(2);
  }

  const { closeArm, closeRun, parseFrontmatter } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  const { harnessRun } = await import(join(ROOT, "kernel/lib/paths.mjs"));

  const result = arm === "escalated"
    // The direct path — never a RunReturn arm — is closeRun itself, the same call an operator or
    // the tech-lead skill's own prose-driven close makes; RUN_RETURN_CLOSE plays no part in it.
    ? closeRun(ws, slug, { status: "escalated", cause: "driven by s1-drive-close.mjs (direct escalated close)" })
    : closeArm(ws, slug, arm, `driven by s1-drive-close.mjs (arm=${arm})`);

  if (result.terminal === false) {
    console.log("NO CLOSE");
    process.exit(0);
  }
  if (!result.ok) {
    console.error(`CLOSE DID NOT TAKE: ${result.reason || JSON.stringify(result)}`);
    process.exit(1);
  }

  // Read back OFF DISK (rule 7) — never trust the in-memory return value alone for what the
  // artifact itself now claims.
  const fm = parseFrontmatter(readFileSync(harnessRun(ws, slug), "utf8"));
  if (fm.closed_status !== result.status || !fm.closed_at || fm.closed_at === "~") {
    console.error(`LEDGER DID NOT TAKE THE CLOSE: closed_status=${fm.closed_status} closed_at=${fm.closed_at}`);
    process.exit(1);
  }
  console.log(`closed_status=${fm.closed_status} close_cause=${fm.close_cause} closed_at=${fm.closed_at}`);
} finally {
  rmSync(ws, { recursive: true, force: true });
}
