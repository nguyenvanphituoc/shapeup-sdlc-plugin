#!/usr/bin/env node
// s1-drive-close.mjs — drive one close arm through the kernel's arm→status derivation end to end, against a
// real throwaway run, and read the outcome back OFF DISK — never off the call site (a guard that asserts a call
// must also assert its effect).
//
// Usage: node tests/fixtures/s1-drive-close.mjs <arm>
//   <arm> ∈ shipped | aborted | gate_h | escalated
//     shipped / aborted / gate_h — an arm a `probe next` close command names (`probe resume --close-arm <arm>`),
//       resolved through `closeArm`/`CLOSE_ARM_STATUS` (kernel/probe/resume.mjs).
//     escalated — NOT an arm; the OTHER path to the same terminal status: an operator calling
//       `probe resume --close escalated` directly. `closeRun` accepts it (TERMINAL_STATUSES has always carried
//       `escalated`). Both paths must land the identical on-disk shape, which is what "gate_h" and "escalated"
//       both printing `closed_status=escalated` proves.
//   `paused` and `ok` were arms of the retired run script's return union; they are not arms now, so passing one
//   prints `CLOSE DID NOT TAKE` — which is the point.
//
// Prints `closed_status=<v> close_cause=<v> closed_at=<v>` (read back off disk) for a terminal close.
// Exits 2 on a malformed invocation or a fixture-setup failure (a broken probe is not a failing one), 1 when
// the close itself did not take.

import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arm = process.argv[2];
const KNOWN = ["shipped", "aborted", "gate_h", "paused", "ok", "escalated"]; // paused/ok: kept to show they are refused

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
    // The direct path — never an arm — is closeRun itself, the same call an operator makes;
    // CLOSE_ARM_STATUS plays no part in it.
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
