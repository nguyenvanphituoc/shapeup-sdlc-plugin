#!/usr/bin/env node
// hd040-l4-precondition.mjs — `ship` is not a valid L4 answer without a census that says so.
//
// MEASURED ON A CONSUMER, and worse than the summary suggests. A run's dispatch receipts carried
// exactly two entries — `orient` and `task-executor`. `scope-hammer` was never dispatched. The gate
// ledger nonetheless recorded:
//
//     H  -> accept-cut-list | preset:ci
//     L4 -> ship            | preset:ci   ("THIS is the one a reviewer should look at first")
//
// while the run ledger read `status: escalated`, `final_verdict: ~`, every requirement at
// `no evidence`. Both gates resolved over a census that never ran.
//
// `shapeup-run.js` DOES guard this — `if (h.verdict === "cannot-ship") … aborted("H", …)` — but
// that line sits after the hammer dispatch, and a run that returns `gate_h` from the inner breaker
// never reaches it; the orchestrator skill's own prose path then resolves both gates from the
// preset. A guard on one route to L4 and not the other is a check on the call site rather than on
// the outcome, which is the failure shape this repo already has a rule about.
//
// So the property under test is a PRECONDITION on the answer, not a branch in one caller: an answer
// set chooses among valid answers and can never supply the evidence that makes one valid.
//
// Usage: node tests/fixtures/hd040-l4-precondition.mjs <no-census|cannot-ship|shippable>
// Exits 0 when L4 resolves as it should, 1 when `ship` was allowed without warrant, 2 on a broken
// probe.

import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mode = process.argv[2];
const KNOWN = ["no-census", "cannot-ship", "shippable"];
if (!mode || !KNOWN.includes(mode)) {
  console.error(`usage: node tests/fixtures/hd040-l4-precondition.mjs <${KNOWN.join("|")}>`);
  process.exit(2);
}

const SLUG = "hd040fx";
const ws = mkdtempSync(join(tmpdir(), "hd040-"));
process.env.SHAPEUP_DECISIONS_PATH = join(ws, "decisions.jsonl");

const w = (p, body) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); };

try {
  const opened = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", SLUG, "--intake-text", "L4 must not ship without a census",
    "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
  if (opened.status !== 0) {
    console.error(`CANNOT OPEN FIXTURE RUN (exit ${opened.status}): ${opened.stderr || opened.stdout}`);
    process.exit(2);
  }

  // The census, or its deliberate absence. `no-census` writes nothing at all — the consumer's own
  // state, where scope-hammer never ran.
  if (mode !== "no-census") {
    const verdict = mode === "cannot-ship" ? "cannot-ship" : "ship-now";
    w(join(ws, ".shapeup", SLUG, "results", "hammer.json"), JSON.stringify({
      schema_version: 1, order_id: `${SLUG}/hammer`, worker: "scope-hammer",
      status: "done", payload: { verdict, cut_list: [] },
    }, null, 2));
  }

  const r = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "gate", "--resolve", "L4",
    "--preset", "ci", "--slug", SLUG, "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 60_000 });

  let out = null;
  try { out = JSON.parse(r.stdout || "null"); } catch { /* reported below */ }
  if (!out) {
    console.error(`CANNOT PARSE gate OUTPUT (exit ${r.status}): ${`${r.stdout}${r.stderr}`.slice(0, 300)}`);
    process.exit(2);
  }

  const shipped = out.decision === "ship" && out.status === "ok";

  if (mode === "shippable") {
    if (shipped) { console.log("SHIP ALLOWED — a census that says ship-now still lets the preset answer ship"); process.exit(0); }
    console.error(`SHIP REFUSED OVER A GOOD CENSUS: ${JSON.stringify(out).slice(0, 240)} — the fix must narrow the answer, not disarm the gate`);
    process.exit(1);
  }

  // no-census and cannot-ship: `ship` must not be the answer.
  if (!shipped) {
    console.log(`SHIP REFUSED (${mode}) — status=${out.status} decision=${out.decision ?? "-"}`);
    process.exit(0);
  }
  console.error(`L4 ANSWERED "ship" WITH ${mode === "no-census" ? "NO CENSUS AT ALL" : "A CANNOT-SHIP CENSUS"} — ` +
    `the gate ledger would record a ship the run cannot support: ${JSON.stringify(out).slice(0, 240)}`);
  process.exit(1);
} finally {
  rmSync(ws, { recursive: true, force: true });
}
