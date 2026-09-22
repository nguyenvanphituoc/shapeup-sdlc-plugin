// 75 — a run must not read a PREVIOUS run's work as its own.
//
// THE CASE NO SINGLE-RUN FIXTURE CAN HOLD, and that is precisely why it shipped. Every fixture
// written for the attested-channel work held one run's rows, so three readers that ignored the run
// key all passed: the attempt census, the compile guard that consults it, and the stagnation
// breaker. `receipts/dispatch.jsonl`, `legs.jsonl` and `t0/trials.jsonl` are per-slug and
// append-only — they accumulate across every run of a pitch — while `order_id`, round and attempt
// all repeat. AGENTS.md states the consequence outright: `run_id` is the only key that separates
// two runs of one feature.
//
// MEASURED ON A CONSUMER, not imagined. A new run compiled `…-r1-a1`, dispatched no worker, and:
//   - the census answered `a1 spent, receipt/leg/result all true` — rows from a run two launches
//     earlier, one of them already filed as an invalid grading;
//   - the stagnation breaker fired during *compile*, before any dispatch, on `streak=2` — two
//     non-kept trials from earlier runs, grading a tree that had been fixed seven hours before.
// The run escalated with its 5-attempt budget untouched, on evidence that predated its own fix.
//
// Both directions matter here. Scoping the read must not disarm the readers for the run's OWN
// rows, so section (c) plants this run's work and requires the census to see it.

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const PRIOR_RUN = "xrun-20260101T000000Z-0ddba11a";

/** Open a real run, so the rows below can carry a real run key. */
function openRun(ROOT, ws, slug, intake) {
  const r = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", slug, "--intake-text", intake, "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) throw new Error(`init run failed: ${r.stderr || r.stdout}`);
}

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { dispatchReceipts, legLedger, trials, readRunId } = await import(join(ROOT, "kernel/lib/paths.mjs"));
  const { scopeAttempts } = await import(join(ROOT, "kernel/probe/attempts.mjs"));

  const w = (p, body) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); };
  const append = (p, row) => { mkdirSync(dirname(p), { recursive: true }); appendFileSync(p, JSON.stringify(row) + "\n"); };

  // ===============================================================================================
  section("127. Attestation and stagnation are scoped to the run that produced them");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "xrun-127-"));
    const slug = "xrun";
    const scope = "widget";
    try {
      openRun(ROOT, ws, slug, "A run must not inherit a previous run's attestation");
      const thisRun = readRunId(ws, slug);
      if (!thisRun || thisRun === PRIOR_RUN) {
        fail(`(setup) current run_id resolved to ${JSON.stringify(thisRun)} — broken fixture, not a failing check`);
        return;
      }
      const orderId = `${slug}/${scope}-r1-a1`;

      // A PRIOR run's work: complete, genuine, and not this run's.
      append(dispatchReceipts(ws, slug), {
        at: "2026-01-01T00:05:00.000Z", order_id: orderId, run_id: PRIOR_RUN,
        worker_declared: "task-executor", skill_invoked: "task-executor", dispatch_ok: true, tool: "Skill",
      });
      append(legLedger(ws, slug), {
        schema_version: 1, run_id: PRIOR_RUN, order_id: orderId, worker: "task-executor",
        operation: "execute", mode: "orchestrated", scope_id: scope, round: 1, attempt: 1,
        ingested_at: "2026-01-01T00:20:00.000Z", attested: true,
      });
      w(join(ws, ".shapeup", slug, "results", `${scope}-r1-a1.json`),
        JSON.stringify({ schema_version: 1, order_id: orderId, status: "done" }, null, 2));
      for (const at of ["2026-01-01T00:10:00.000Z", "2026-01-01T00:15:00.000Z"]) {
        append(trials(ws, slug), {
          schema_version: 1, run_id: PRIOR_RUN, scope_id: scope, round: 1, attempt: 1, trial: 1, at,
          status: "reverted", delta: "", digest: [],
          score: { regressions: 0, fixtures_passed: 0, fixtures_total: 2, db_probe: null },
        });
      }

      // (a) the census
      const census = scopeAttempts(ws, slug, scope, 1, 5);
      if (census.spent === 0 && census.attempts[0].state === "unattested") {
        ok("(a) the census counts none of a prior run's receipt, leg or result as this run's work");
      } else {
        fail(`(a) census inherited another run's work: spent=${census.spent} a1=${census.attempts[0].state} ` +
             `— those rows carry run_id=${PRIOR_RUN}, not ${thisRun}`);
      }

      // (b) the stagnation breaker, through the real compile
      w(join(ws, "shapeup", slug, "scopes", `${scope}.md`), [
        "---", "type: scope-contract", `scope_id: ${scope}`, `feature: ${slug}`,
        "topology_type: CHOWDER", "use_cases: []",
        `allowed_file_substrate: [src/${scope}/**]`, "shared_substrate: []",
        "hill_phase: UPHILL_UNKNOWN", "e2e_verification_fixtures: [exit 0]", "---", "", `# ${scope}`, "",
      ].join("\n"));
      w(join(ws, ".shapeup", slug, "tasks", "_index.md"), "| ID | Title | Status |\n|---|---|---|\n");
      const c = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "compile",
        "--scope", join("shapeup", slug, "scopes", `${scope}.md`),
        "--round", "1", "--attempt", "1", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
      const said = `${c.stdout || ""}${c.stderr || ""}`;
      if (c.status === 0 && !/"breaker":"stagnation"/.test(said)) {
        ok("(b) the stagnation breaker does not inherit a prior run's streak — compile proceeds for a run that has graded nothing");
      } else if (/"breaker":"stagnation"/.test(said)) {
        fail("(b) the stagnation breaker fired on a prior run's trials, before this run dispatched anything — " +
             `both rows carry run_id=${PRIOR_RUN}`);
      } else {
        fail(`(b) compile failed for an unrelated reason (exit ${c.status}): ${said.trim().slice(0, 200)}`);
      }

      // (c) THE OTHER DIRECTION — scoping must not blind a run to its OWN work.
      append(dispatchReceipts(ws, slug), {
        at: new Date().toISOString(), order_id: orderId, run_id: thisRun,
        worker_declared: "task-executor", skill_invoked: "task-executor", dispatch_ok: true, tool: "Skill",
      });
      append(legLedger(ws, slug), {
        schema_version: 1, run_id: thisRun, order_id: orderId, worker: "task-executor",
        operation: "execute", mode: "orchestrated", scope_id: scope, round: 1, attempt: 1,
        ingested_at: new Date().toISOString(), attested: true,
      });
      const mine = scopeAttempts(ws, slug, scope, 1, 5);
      if (mine.spent === 1 && mine.attempts[0].state === "spent") {
        ok("(c) the same census counts this run's own receipt and leg — scoping narrows the read, it does not disarm it");
      } else {
        fail(`(c) scoping blinded the census to this run's OWN work: spent=${mine.spent} a1=${mine.attempts[0].state}`);
      }
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }
}
