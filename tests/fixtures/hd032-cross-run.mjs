#!/usr/bin/env node
// hd032-cross-run.mjs — a run must not read a PREVIOUS run's work as its own.
//
// `receipts/dispatch.jsonl`, `legs.jsonl` and `t0/trials.jsonl` are per-slug and append-only, so
// they accumulate across every run of a pitch. `AGENTS.md` says what that means: "`run_id` … is the
// only key that separates two runs of the same feature: everything else (`order_id`, round/attempt)
// repeats." Three readers ignored it — the attempt census, the compile guard that consults it, and
// the stagnation breaker.
//
// Measured on a consumer: a new run compiled `…-r1-a1`, dispatched no worker, and the census
// answered `a1 spent, receipt/leg/result all true` from a run two launches earlier. The stagnation
// breaker did worse — it fired during compile on `streak=2`, both trials belonging to earlier runs,
// one of them already documented as invalid, against a tree that had been fixed seven hours before.
//
// THE CASE NO SINGLE-RUN FIXTURE CAN HOLD, which is exactly why it shipped: every fixture written
// for the attested-channel work held one run's rows. This one plants TWO runs in one set of ledgers
// and asks the current run what it sees.
//
// Usage: node tests/fixtures/hd032-cross-run.mjs <census|stagnation|both>
// Exits 0 when the current run sees only its own work, 1 when it inherits the prior run's, 2 on a
// broken probe.

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mode = process.argv[2];
const KNOWN = ["census", "stagnation", "both"];
if (!mode || !KNOWN.includes(mode)) {
  console.error(`usage: node tests/fixtures/hd032-cross-run.mjs <${KNOWN.join("|")}>`);
  process.exit(2);
}

const SLUG = "hd032fx";
const SCOPE = "widget";
const PRIOR_RUN = "hd032fx-20260101T000000Z-oldrun00";   // a run that finished long ago
const ws = mkdtempSync(join(tmpdir(), "hd032-"));
process.env.SHAPEUP_DECISIONS_PATH = join(ws, "decisions.jsonl");

const w = (p, body) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); };
const append = (p, row) => { mkdirSync(dirname(p), { recursive: true }); appendFileSync(p, JSON.stringify(row) + "\n"); };

let failed = false;
const bad = (msg) => { console.error(msg); failed = true; };

try {
  const opened = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", SLUG, "--intake-text", "A run must not inherit a previous run's attestation",
    "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
  if (opened.status !== 0) {
    console.error(`CANNOT OPEN FIXTURE RUN (exit ${opened.status}): ${opened.stderr || opened.stdout}`);
    process.exit(2);
  }

  const { dispatchReceipts, legLedger, trials, readRunId } = await import(join(ROOT, "kernel/lib/paths.mjs"));
  const thisRun = readRunId(ws, SLUG);
  if (!thisRun || thisRun === PRIOR_RUN) {
    console.error(`broken probe: current run_id resolved to ${JSON.stringify(thisRun)}`);
    process.exit(2);
  }

  const orderId = `${SLUG}/${SCOPE}-r1-a1`;

  // ── THE PRIOR RUN'S WORK, complete and genuine — it just belongs to a different run ──────────
  append(dispatchReceipts(ws, SLUG), {
    at: "2026-01-01T00:05:00.000Z", order_id: orderId, run_id: PRIOR_RUN,
    worker_declared: "task-executor", skill_invoked: "task-executor", dispatch_ok: true, tool: "Skill",
  });
  append(legLedger(ws, SLUG), {
    schema_version: 1, run_id: PRIOR_RUN, order_id: orderId, worker: "task-executor",
    operation: "execute", mode: "orchestrated", scope_id: SCOPE, round: 1, attempt: 1,
    ingested_at: "2026-01-01T00:20:00.000Z", attested: true,
  });
  w(join(ws, ".shapeup", SLUG, "results", `${SCOPE}-r1-a1.json`),
    JSON.stringify({ schema_version: 1, order_id: orderId, status: "done" }, null, 2));

  // Two non-kept trials from the prior run — a stagnation streak that is not this run's.
  for (const at of ["2026-01-01T00:10:00.000Z", "2026-01-01T00:15:00.000Z"]) {
    append(trials(ws, SLUG), {
      schema_version: 1, run_id: PRIOR_RUN, scope_id: SCOPE, round: 1, attempt: 1, trial: 1, at,
      status: "reverted", delta: "", digest: [],
      score: { regressions: 0, fixtures_passed: 0, fixtures_total: 2, db_probe: null },
    });
  }

  // ── (a) THE CENSUS ───────────────────────────────────────────────────────────────────────────
  if (mode === "census" || mode === "both") {
    const { scopeAttempts } = await import(join(ROOT, "kernel/probe/attempts.mjs"));
    const r = scopeAttempts(ws, SLUG, SCOPE, 1, 5);
    if (r.spent === 0 && r.attempts[0].state === "unattested") {
      console.log(`CENSUS SCOPED TO THIS RUN — spent=0 (the prior run's receipt, leg and result are not this run's)`);
    } else {
      bad(`CENSUS INHERITED ANOTHER RUN'S WORK: spent=${r.spent} a1=${r.attempts[0].state} ` +
          `(receipt=${r.attempts[0].hasReceipt} leg=${r.attempts[0].hasLeg} result=${r.attempts[0].hasResult}) ` +
          `— every one of those rows carries run_id=${PRIOR_RUN}, not ${thisRun}`);
    }
  }

  // ── (b) THE STAGNATION BREAKER, driven through the real compile ──────────────────────────────
  if (mode === "stagnation" || mode === "both") {
    w(join(ws, "shapeup", SLUG, "scopes", `${SCOPE}.md`), [
      "---", "type: scope-contract", `scope_id: ${SCOPE}`, `feature: ${SLUG}`,
      "topology_type: CHOWDER", "use_cases: []",
      `allowed_file_substrate: [src/${SCOPE}/**]`, "shared_substrate: []",
      "hill_phase: UPHILL_UNKNOWN", "e2e_verification_fixtures: [exit 0]", "---", "", `# ${SCOPE}`, "",
    ].join("\n"));
    w(join(ws, ".shapeup", SLUG, "tasks", "_index.md"), "| ID | Title | Status |\n|---|---|---|\n");

    const r = spawnSync(process.execPath, [
      join(ROOT, "kernel/harness.mjs"), "compile",
      "--scope", join("shapeup", SLUG, "scopes", `${SCOPE}.md`),
      "--round", "1", "--attempt", "1", "--cwd", ws,
    ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
    const said = `${r.stdout || ""}${r.stderr || ""}`;

    if (r.status === 0 && !/stagnation/i.test(said)) {
      console.log("STAGNATION SCOPED TO THIS RUN — compile proceeded; the prior run's streak is not this run's");
    } else if (/stagnation/i.test(said)) {
      bad(`STAGNATION BREAKER INHERITED ANOTHER RUN'S STREAK: compile refused attempt 1 of a run that has ` +
          `graded nothing. Both trials carry run_id=${PRIOR_RUN}. Said: ${said.trim().slice(0, 240)}`);
    } else {
      console.error(`compile failed for an unrelated reason (exit ${r.status}): ${said.trim().slice(0, 240)}`);
      process.exit(2);
    }
  }
} finally {
  rmSync(ws, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
