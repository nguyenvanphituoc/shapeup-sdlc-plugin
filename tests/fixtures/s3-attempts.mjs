#!/usr/bin/env node
// s3-attempts.mjs — HD-2, defect-plan-3.7 Stage 3: drive the kernel's attested-channel attempt
// derivation (`kernel/probe/attempts.mjs`'s `scopeAttempts`) end to end against fixtures built
// straight from the three attested channels — never from the order set or the T0 verdict set
// alone — and read the outcome back OFF the function's own return (and, for `agree`, off a real
// spawned `probe attempts` process too — guardrail rule 7: "a guard that asserts a call must also
// assert its effect").
//
// Usage: node tests/fixtures/s3-attempts.mjs <mode>
//   <mode> ∈ unattested | in-flight | exhausted | agree | revert-check
//     unattested   — an order plus a T0 verdict for attempt 1, with NO dispatch receipt, leg row
//       or WorkResult anywhere. Prints `attempts_spent=0` — a compiled order and a verdict are
//       both writable by the scope being judged and prove nothing on their own.
//     in-flight    — attempt 1 is fully attested and closed (red, no green), attempt 2 has a
//       dispatch receipt but neither a leg row nor a WorkResult — a real dispatch still running.
//       Prints `BREAKER HELD`: spent (1) stays below the budget (2) while one attempt is open.
//     exhausted    — attempt_budget attempts (2) are each fully attested and closed, none green.
//       Prints `BREAKER TRIPPED` — THE regression that matters: the cheapest wrong fix to this
//       stage never trips the breaker at all.
//     agree        — the same exhausted fixture, read two independent ways: a direct import (what
//       the round loop's own inner breaker would call) and a spawned `harness probe attempts`
//       process (what scope-hammer's SKILL.md now instructs the census to run). Prints
//       `CENSUS==BREAKER` when both agree on `spent` and `tripped`.
//     revert-check — the SAME `unattested` fixture, read by a NAIVE re-derivation straight from
//       the order set and the T0 verdict set (exactly what this stage forbids) instead of the
//       attested channels. This is the fixture's own falsifier: the naive reading counts the
//       unattested order+verdict as ONE spent attempt where the real derivation counts zero, so
//       this mode must find them disagreeing and exit 1 — the "revert the fix" arm of the
//       mutation test in the acceptance table (rule 4: mutation is the acceptance, not the green
//       check).
//
// Exits 2 on a malformed invocation or fixture-setup failure (rule 3: a broken probe is not a
// failing one), 1 when the mode's own assertion fails.

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, appendFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mode = process.argv[2];
const KNOWN = ["unattested", "in-flight", "exhausted", "agree", "revert-check", "compile-guard"];

if (!mode || !KNOWN.includes(mode)) {
  console.error(`usage: node tests/fixtures/s3-attempts.mjs <${KNOWN.join("|")}>`);
  process.exit(2);
}

// Never the live ledger (guardrail rule 5) — a throwaway workspace, and the decisions channel
// redirected in case any imported module logs a hook decision along the way.
const ws = mkdtempSync(join(tmpdir(), "s3-attempts-"));
process.env.SHAPEUP_DECISIONS_PATH = join(ws, "decisions.jsonl");

const SLUG = "s3fx";
const SCOPE = "widget";
const ROUND = 1;

try {
  const { ordersDir, verdictsDir, dispatchReceipts, legLedger, resultsDir, readRunId } =
    await import(join(ROOT, "kernel/lib/paths.mjs"));
  const { scopeAttempts } = await import(join(ROOT, "kernel/probe/attempts.mjs"));

  // A REAL RUN, so the attested rows below can carry a real run key.
  //
  // This fixture used to build the ledgers by hand with `run_id: null`, which made every mode here
  // pass over evidence no real dispatch ever writes — and that unfaithfulness is exactly what hid
  // the cross-run defect: attestation is scoped to the run that produced it, and rows belonging to
  // no run attest nothing. Opening the run makes the fixture answer the same question the pipeline
  // does.
  const opened = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", SLUG, "--intake-text", "Drive the attested-attempt derivation",
    "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
  if (opened.status !== 0) {
    console.error(`CANNOT OPEN FIXTURE RUN (exit ${opened.status}): ${opened.stderr || opened.stdout}`);
    process.exit(2);
  }
  const RUN_ID = readRunId(ws, SLUG);
  if (!RUN_ID) { console.error("broken probe: no run_id after init run"); process.exit(2); }

  /** Write a file, creating its directory. */
  const w = (path, body) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  };
  const orderId = (attempt) => `${SLUG}/${SCOPE}-r${ROUND}-a${attempt}`;
  const orderPath = (attempt) => join(ordersDir(ws, SLUG), `${SCOPE}-r${ROUND}-a${attempt}.json`);
  const resultPath = (attempt) => join(resultsDir(ws, SLUG), `${SCOPE}-r${ROUND}-a${attempt}.json`);

  /** A minimal, schema-shaped order file for one attempt — enough for the readers under test. */
  function writeOrder(attempt) {
    w(orderPath(attempt), {
      schema_version: 1, order_id: orderId(attempt), worker: "task-executor", mode: "orchestrated",
      operation: attempt > 1 ? "fix" : "execute", compiled_at: new Date().toISOString(),
      substrate: { allowed: [`src/${SCOPE}/**`], shared: [], append_only: [], frozen: [] },
      payload: {},
    });
  }

  /** A T0 verdict for one attempt — writable by the very leg being judged, never by itself proof of anything. */
  function writeVerdict(attempt, overall) {
    w(join(verdictsDir(ws, SLUG), `r${ROUND}-a${attempt}.json`), {
      schema_version: 1, scope_id: SCOPE, round: ROUND, attempt, overall,
      score: { regressions: 0, fixtures_passed: overall === "green" ? 1 : 0, fixtures_total: 1, db_probe: null },
    });
  }

  /** Append one JSONL row, creating its directory (mirrors the real writers — receipts/legs are append-only). */
  const append = (path, row) => { mkdirSync(dirname(path), { recursive: true }); appendFileSync(path, JSON.stringify(row) + "\n"); };

  /** A dispatch receipt row — the START a PostToolUse hook attests, never the leg's own claim. */
  function writeReceipt(attempt) {
    append(dispatchReceipts(ws, SLUG), {
      at: new Date().toISOString(), order_id: orderId(attempt), run_id: RUN_ID,
      worker_declared: "task-executor", skill_invoked: "task-executor",
      dispatch_ok: true, tool: "Skill", agent_id: null, agent_type: null,
    });
  }

  /** A leg-completion row — the END `reduce ingest` attests, never invented for a leg still running. */
  function writeLeg(attempt) {
    append(legLedger(ws, SLUG), {
      schema_version: 1, run_id: RUN_ID, order_id: orderId(attempt), worker: "task-executor",
      operation: attempt > 1 ? "fix" : "execute", mode: "orchestrated", scope_id: SCOPE, round: ROUND, attempt,
      compiled_at: new Date().toISOString(), dispatched_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(), started_from: "dispatch-receipt", duration_ms: 1000, attested: true,
    });
  }

  /** A WorkResult file — the artifact `results/` holds once a worker actually answers an order. */
  function writeResult(attempt) {
    w(resultPath(attempt), { schema_version: 1, order_id: orderId(attempt), status: "done" });
  }

  /** A fully attested, CLOSED attempt: dispatched (receipt) and closed (leg) — never green. */
  function closedAttempt(attempt) {
    writeOrder(attempt);
    writeVerdict(attempt, "red");
    writeReceipt(attempt);
    writeLeg(attempt);
  }

  if (mode === "unattested" || mode === "revert-check") {
    // The one shared fixture BOTH modes read: an order and a red T0 verdict for attempt 1 — and
    // nothing else. No receipt, no leg, no result anywhere in the workspace.
    writeOrder(1);
    writeVerdict(1, "red");

    if (mode === "unattested") {
      const r = scopeAttempts(ws, SLUG, SCOPE, ROUND, 1);
      if (r.spent === 0) {
        console.log(`attempts_spent=${r.spent}`);
        process.exit(0);
      }
      console.error(`ATTESTED DERIVATION COUNTED A WRITABLE ARTIFACT AS SPENT: ${JSON.stringify(r)}`);
      process.exit(1);
    }

    // revert-check — the fixture's own falsifier. A NAIVE re-derivation straight from the order
    // set / T0 verdict set (exactly the thing kernel/probe/attempts.mjs exists to stop trusting),
    // written here rather than imported: there is no flag on the real derivation to revert, so the
    // mutation is this fixture's own stand-in for "someone reverted the fix". It must disagree with
    // the real, attested-only answer on this exact fixture, or the mutation row proves nothing.
    const naiveSpent = existsSync(ordersDir(ws, SLUG))
      ? readdirSync(ordersDir(ws, SLUG)).filter((f) => f === `${SCOPE}-r${ROUND}-a1.json`).length
      : 0;
    const real = scopeAttempts(ws, SLUG, SCOPE, ROUND, 1);
    if (naiveSpent !== real.spent) {
      console.error(`REVERTED (order/T0-derived) COUNT DISAGREES WITH THE ATTESTED COUNT, as it must: ` +
        `naive=${naiveSpent} attested=${real.spent} — a derivation keyed off the order/T0 set alone ` +
        `counts this unattested attempt as spent.`);
      process.exit(1);
    }
    // Deliberately NOT the falsifier's own silent pass: state plainly that the mutation failed to
    // discriminate, matching guardrail rule 6 rather than a bare, ambiguous non-1 exit.
    console.error(`FALSIFIER FAILED — the naive order/T0-derived count (${naiveSpent}) matched the ` +
      `attested count (${real.spent}), which means this fixture cannot tell the two derivations apart.`);
    process.exit(0);
  }

  // compile-guard — THE ROW THAT DRIVES THE MECHANISM, not the derivation.
  //
  // Every other mode here calls `scopeAttempts` directly, so all of them pass over a derivation
  // nothing consults — which is exactly how this stage first scored 7/7 while the defect it exists
  // to close was still live. This mode spawns the real `harness compile` and asks whether the
  // PIPELINE refuses, so a correct function with no call site fails it.
  //
  // The scenario is HD-2's own, reduced: attempt 1 has an order and a green-shaped T0 verdict —
  // both writable by the scope being judged — and no dispatch receipt, no leg row and no
  // WorkResult. Attempt 1 is therefore UNANSWERED, and opening attempt 2 against it is the exact
  // interleaving the consumer run recorded.
  if (mode === "compile-guard") {
    const specDir = join(ws, "shapeup", SLUG, "scopes");
    w(join(specDir, `${SCOPE}.md`), [
      "---",
      `scope_id: ${SCOPE}`,
      "topology_type: LAYER_CAKE",
      "allowed_file_substrate: [apps/web/widget/*.tsx]",
      "shared_substrate: []",
      "---",
      "## Why this slice",
      "The widget is the riskiest flow.",
      "",
      "## Affordances",
      "| test_id | role | required_states |",
      "|---|---|---|",
      "| use-widget | button | [empty, one-item] |",
      "",
    ].join("\n"));
    w(join(ws, ".shapeup", SLUG, "tasks", "_index.md"), "| ID | Title | Status |\n|---|---|---|\n");

    // HD-2's own state, reproduced exactly. Attempt 1 WAS dispatched — the receipts ledger exists
    // and carries its row — and has simply not come back: no leg-completion row, no WorkResult.
    // That is "in-flight", and it is the state the consumer run was in when it opened attempt 2.
    //
    // Modelling attempt 1 as having no receipts ledger AT ALL would be a different and weaker
    // scenario: the guard deliberately fails open there, because a lane that never attests
    // dispatches cannot be judged by this rule. Writing the receipt is what makes this fixture
    // test the defect rather than the exemption.
    writeOrder(1);
    writeVerdict(1, "red");   // an order and a verdict: the two channels a scope can write alone.
    writeReceipt(1);          // dispatched…
    // …and deliberately NOT closed: no writeLeg(1), no writeResult(1). Still unanswered.

    const r = spawnSync(process.execPath, [
      join(ROOT, "kernel/harness.mjs"), "compile",
      "--scope", join("shapeup", SLUG, "scopes", `${SCOPE}.md`),
      "--round", String(ROUND), "--attempt", "2", "--cwd", ws,
    ], { cwd: ws, encoding: "utf8", timeout: 60_000 });

    const said = `${r.stdout || ""}${r.stderr || ""}`;
    if (r.status !== 0 && /unanswered|unattested|attest/i.test(said)) {
      console.log("COMPILE REFUSED an attempt opened over an unanswered one");
      process.exit(0);
    }
    if (r.status !== 0) {
      console.error(`compile failed, but NOT for this reason — the probe is answering a different ` +
        `question than the one asked (exit ${r.status}): ${said.trim().slice(0, 400)}`);
      process.exit(2);
    }
    console.error("COMPILE OPENED ATTEMPT 2 while attempt 1 was unanswered — no receipt, no leg, " +
      "no WorkResult for r1-a1. This is HD-2's interleaving, and the pipeline still permits it: " +
      `the order was written to ${(r.stdout || "").trim()}`);
    process.exit(1);
  }

  if (mode === "in-flight") {
    closedAttempt(1);                       // attempt 1: attested, closed, red.
    writeOrder(2);
    writeReceipt(2);                        // attempt 2: dispatched…
    // …and deliberately NOT closed — no leg, no result. Still genuinely running.
    const r = scopeAttempts(ws, SLUG, SCOPE, ROUND, 2);
    if (r.spent < 2 && !r.tripped) {
      console.log("BREAKER HELD");
      process.exit(0);
    }
    console.error(`BREAKER TRIPPED WHILE AN ATTEMPT WAS STILL UNANSWERED: ${JSON.stringify(r)}`);
    process.exit(1);
  }

  if (mode === "exhausted" || mode === "agree") {
    closedAttempt(1);
    closedAttempt(2);                       // both attempts attested, closed, red — budget genuinely spent.
    const r = scopeAttempts(ws, SLUG, SCOPE, ROUND, 2);

    if (mode === "exhausted") {
      if (r.tripped) {
        console.log("BREAKER TRIPPED");
        process.exit(0);
      }
      console.error(`A GENUINELY EXHAUSTED BUDGET DID NOT TRIP — the cheapest wrong fix to this ` +
        `stage disarms the breaker entirely: ${JSON.stringify(r)}`);
      process.exit(1);
    }

    // agree — the SAME fixture, read by the round loop's own path (a direct import) and by the
    // census's own path (a spawned `probe attempts` process, exactly as scope-hammer's SKILL.md
    // now instructs it to run), then compared.
    const cli = spawnSync(process.execPath, [
      join(ROOT, "kernel/harness.mjs"), "probe", "attempts",
      "--slug", SLUG, "--scope", SCOPE, "--round", String(ROUND), "--attempt-budget", "2", "--cwd", ws,
    ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
    let census = null;
    try { census = JSON.parse(cli.stdout || "null"); } catch { /* reported below */ }
    if (!census) {
      console.error(`CANNOT PARSE probe attempts OUTPUT (exit ${cli.status}): ${cli.stdout}${cli.stderr}`);
      process.exit(2);
    }
    const censusTripped = cli.status === 1;
    if (census.spent === r.spent && census.tripped === r.tripped && censusTripped === r.tripped) {
      console.log("CENSUS==BREAKER");
      process.exit(0);
    }
    console.error(`CENSUS AND BREAKER DISAGREE: breaker=${JSON.stringify(r)} census=${JSON.stringify(census)} ` +
      `(cli exit ${cli.status})`);
    process.exit(1);
  }
} finally {
  rmSync(ws, { recursive: true, force: true });
}
