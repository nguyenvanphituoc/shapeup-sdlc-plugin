// 73 — HD-2, defect-plan-3.7 Stage 3: the breaker counts attested work, not writable artifacts.
// Sections: 121, 122, 123, 124.
//
// THE DEFECT, measured in run `find-my-todos-20260922T020229Z-9036e2b6`: `r1-a2` was compiled and
// T0-verified while `r1-a1` was still in flight, with no row for `r1-a2` in ANY attested channel
// (`receipts/dispatch.jsonl`, `legs.jsonl`, `results/`). The loop counted it anyway, and the run
// stopped at GATE H with 4 of 5 attempts and ~2.4 of 3 hours unspent — a budget that stopped work
// it had authorised, because it was reading the order set and the T0 verdict set, both of which
// are writable by the very scope being judged, as if they were proof a dispatch happened.
//
// THE FIX. `kernel/probe/attempts.mjs`'s `scopeAttempts` derives an attempt count ONLY from the
// three attested channels: a dispatch receipt (the hook-attested START), a leg-completion row or a
// WorkResult (either closes it). An attempt with none of the three is UNATTESTED and counts as
// though it never happened; one with a receipt but neither a leg nor a result is IN-FLIGHT — a real
// dispatch still running — and holds the breaker open rather than reading as spent. This is the
// SAME function `scope-hammer`'s SKILL.md (H0.1) now cites for its GATE H0 census, so the two
// readers that disagreed on the measured run cannot drift apart again.
//
// WHY THIS MODULE DRIVES THE REAL PIPELINE (rule 7: a guard that asserts a call must also assert
// its effect). §121 compiles a real order, fires the REAL `hooks/dispatch-receipt.mjs` hook and
// runs the REAL `reduce ingest`, then reads `scopeAttempts` back against what those shipped writers
// actually produced — never a hand-rolled row shape a fixture merely hopes matches. §122 and §123
// are narrower, in-process pins over synthetic fixtures for the read-only assertions rule 7 does
// not require driving live (a writable order/verdict alone, and the mutation both directions).
//
// WHY THIS IS A SEPARATE MODULE FROM tests/fixtures/s3-attempts.mjs. That fixture is the
// contract's own falsifier driver (BOTH_DIRECTIONS) and is disposable by design. This module is the
// durable regression pin: it runs on every `npm test`, forever, the same discipline 70 through 72
// already apply to their own defects.

import { existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Open a real run exactly as the orchestrator does (see tests/structural/19-run-records.mjs). */
function openRun(ROOT, ws, slug, intake) {
  const r = spawnSync(process.execPath, [
    join(ROOT, "kernel/harness.mjs"), "init", "run",
    "--slug", slug, "--intake-text", intake, "--auto-level", "unattended", "--cwd", ws,
  ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
  if (r.status !== 0) throw new Error(`init run failed: ${r.stderr || r.stdout}`);
}

/** A minimal scope contract `compile --scope` accepts. */
function scopeContract(ws, slug, id) {
  const dir = join(ws, "shapeup", slug, "scopes");
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${id}.md`);
  writeFileSync(p, [
    "---", "type: scope-contract", `scope_id: ${id}`, `feature: ${slug}`,
    "topology_type: CHOWDER", "use_cases: []",
    `allowed_file_substrate: [src/${id}/**]`, "shared_substrate: []",
    "hill_phase: UPHILL_UNKNOWN", "e2e_verification_fixtures: [exit 0]", "---", "", `# ${id}`, "",
  ].join("\n"));
  return p;
}

/** Run a kernel subcommand. */
function kernel(ROOT, ws, ...argv) {
  return spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...argv, "--cwd", ws], { cwd: ws, encoding: "utf8", timeout: 30_000 });
}

/**
 * Fire the REAL dispatch-receipt hook for a completed Skill dispatch against `order`.
 * The hook extracts the `--order` VALUE and reads the order FILE from it (not order_id) — the
 * same payload shape 03-hooks.mjs §57 measured from a live session.
 */
function fireDispatchReceipt(ROOT, ws, order, orderPath) {
  const env = { ...process.env };
  delete env.SHAPEUP_DECISIONS_PATH;
  return spawnSync(process.execPath, [join(ROOT, "hooks/dispatch-receipt.mjs")], {
    input: JSON.stringify({
      hook_event_name: "PostToolUse", tool_name: "Skill", cwd: ws,
      agent_id: "a-73", agent_type: "workflow-subagent",
      tool_input: { skill: `shapeup-sdlc-plugin:${order.worker}`, args: `--order '${orderPath}'` },
      tool_response: { success: true, commandName: `shapeup-sdlc-plugin:${order.worker}` },
    }),
    cwd: ws, encoding: "utf8", timeout: 30_000, env,
  });
}

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  const { scopeAttempts, readReceipts } = await import(join(ROOT, "kernel/probe/attempts.mjs"));
  const { dispatchReceipts, legLedger, resultsDir, verdictsDir, readRunId } = await import(join(ROOT, "kernel/lib/paths.mjs"));

  // ===============================================================================================
  section("121. Attempts are counted from attested channels, driven through the real dispatch pipeline");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "attested-121-"));
    try {
      const slug = "attempts73";
      openRun(ROOT, ws, slug, "Drive the attested-attempts derivation end to end");
      scopeContract(ws, slug, "widget");

      // (a) compile attempt 1 — a real order, nothing attested about it yet.
      const co = kernel(ROOT, ws, "compile", "--scope", `shapeup/${slug}/scopes/widget.md`, "--round", "1", "--attempt", "1");
      const orderPath = (co.stdout || "").trim();
      if (co.status !== 0 || !existsSync(orderPath)) fail(`compile failed (exit ${co.status}): ${co.stdout}${co.stderr}`);
      const order = JSON.parse(readFileSync(orderPath, "utf8"));

      let r = scopeAttempts(ws, slug, "widget", 1, 1);
      if (r.spent === 0 && r.attempts[0].state === "unattested") {
        ok("(a) a compiled order with NO receipt, leg or result counts ZERO attempts spent");
      } else fail(`(a) a bare compiled order was counted as spent: ${JSON.stringify(r)}`);

      // (b) fire the REAL dispatch-receipt hook — a genuine dispatch has started.
      const fired = fireDispatchReceipt(ROOT, ws, order, orderPath);
      const receipts = readReceipts(dispatchReceipts(ws, slug));
      if (fired.status !== 0 || !receipts.some((x) => x.order_id === order.order_id)) {
        fail(`(b) dispatch-receipt hook did not attest the dispatch (exit ${fired.status}): ${fired.stderr}`);
      } else ok("(b) the real dispatch-receipt hook wrote a receipt for the compiled order");

      r = scopeAttempts(ws, slug, "widget", 1, 1);
      if (r.spent === 0 && r.in_flight === 1 && !r.tripped) {
        ok("(c) a receipted attempt with no leg and no result is IN-FLIGHT — open, not spent, and holds the breaker (BREAKER HELD)");
      } else fail(`(c) an unanswered dispatch was counted as spent or tripped the breaker: ${JSON.stringify(r)}`);

      // (d) close the leg for real: a WorkResult on disk, then the REAL `reduce ingest`.
      mkdirSync(resultsDir(ws, slug), { recursive: true });
      const resultPath = join(resultsDir(ws, slug), "widget-r1-a1.json");
      writeFileSync(resultPath, JSON.stringify({
        schema_version: 1, order_id: order.order_id, worker: order.worker, status: "done",
        artifacts: [], task_results: [], discoveries: [],
      }));
      const ing = kernel(ROOT, ws, "reduce", "ingest", "--order", orderPath);
      if (ing.status !== 0) fail(`(d) reduce ingest refused the result (exit ${ing.status}): ${ing.stderr}`);

      r = scopeAttempts(ws, slug, "widget", 1, 1);
      if (r.spent === 1 && r.in_flight === 0 && !r.green && r.tripped) {
        ok("(e) a closed, never-green attempt is SPENT — a genuinely exhausted budget (1 of 1) TRIPS (THE regression that matters)");
      } else fail(`(e) a closed attempt did not trip an exhausted budget: ${JSON.stringify(r)}`);

      // (f) the CLI (what scope-hammer's census now runs) reads the identical answer.
      const cli = kernel(ROOT, ws, "probe", "attempts", "--slug", slug, "--scope", "widget", "--round", "1", "--attempt-budget", "1");
      let census = null;
      try { census = JSON.parse(cli.stdout); } catch { /* reported below */ }
      if (cli.status === 1 && census?.spent === r.spent && census?.tripped === true) {
        ok("(f) `probe attempts` (the census's own call) exits 1 and agrees with the direct derivation — CENSUS==BREAKER");
      } else fail(`(f) probe attempts disagreed with the direct call: exit ${cli.status}, ${cli.stdout}${cli.stderr}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("122. A compiled order and a green T0 verdict, alone, are not attested work");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "attested-122-"));
    try {
      const slug = "attempts73b";
      openRun(ROOT, ws, slug, "A scope with a writable order and verdict but no dispatch");
      scopeContract(ws, slug, "gadget");
      const co = kernel(ROOT, ws, "compile", "--scope", `shapeup/${slug}/scopes/gadget.md`, "--round", "1", "--attempt", "1");
      if (co.status !== 0) fail(`compile failed: ${co.stderr}`);

      // A GREEN verdict, planted directly — exactly the writable artifact HD-2 measured, with no
      // receipt, leg or result anywhere for this scope.
      mkdirSync(verdictsDir(ws, slug), { recursive: true });
      writeFileSync(join(verdictsDir(ws, slug), "r1-a1.json"), JSON.stringify({
        schema_version: 1, scope_id: "gadget", round: 1, attempt: 1, overall: "green",
        score: { regressions: 0, fixtures_passed: 1, fixtures_total: 1, db_probe: null },
      }));

      const r = scopeAttempts(ws, slug, "gadget", 1, 1);
      if (r.green === true) ok("(a) `green` legitimately reads the T0 verdict — that channel is not the defect");
      else fail(`(a) a real green verdict was not read: ${JSON.stringify(r)}`);
      if (r.spent === 0 && !r.tripped) {
        ok("(b) the same order+verdict, with no receipt/leg/result, still counts ZERO attempts spent — never derived from the order or T0 verdict set alone");
      } else fail(`(b) a writable order/verdict pair was counted as a spent, tripped attempt: ${JSON.stringify(r)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("123. MUTATION, both directions — re-deriving from the order/T0 channels disagrees, and a genuinely exhausted budget still trips regardless of how the query is shaped");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "attested-123-"));
    try {
      const slug = "f";
      mkdirSync(join(ws, "shapeup", slug), { recursive: true });
      // A REAL run, so the attested rows below carry a real run key. Attestation is scoped to the
      // run that produced it — rows belonging to no run attest nothing — so a hand-built ledger
      // with `run_id: null` would exercise evidence no dispatch ever writes.
      openRun(ROOT, ws, slug, "A genuinely exhausted budget must still trip");
      const runId = readRunId(ws, slug);
      const ordersDirPath = join(ws, ".shapeup", slug, "orders");
      mkdirSync(ordersDirPath, { recursive: true });
      writeFileSync(join(ordersDirPath, "sole-r1-a1.json"), JSON.stringify({
        schema_version: 1, order_id: `${slug}/sole-r1-a1`, worker: "task-executor", mode: "orchestrated",
        operation: "execute", compiled_at: new Date().toISOString(),
        substrate: { allowed: ["src/**"], shared: [], append_only: [], frozen: [] }, payload: {},
      }));
      mkdirSync(verdictsDir(ws, slug), { recursive: true });
      writeFileSync(join(verdictsDir(ws, slug), "r1-a1.json"), JSON.stringify({
        schema_version: 1, scope_id: "sole", round: 1, attempt: 1, overall: "red",
      }));

      const real = scopeAttempts(ws, slug, "sole", 1, 1);
      // The MUTATION: re-derive straight from the order set instead of the attested channels —
      // exactly the reading this stage forbids.
      const naiveSpent = readdirSync(ordersDirPath).filter((f) => f === "sole-r1-a1.json").length;
      if (real.spent === 0 && naiveSpent === 1 && naiveSpent !== real.spent) {
        ok("(a) reverting to an order-set derivation disagrees with the attested one on this exact fixture — the mutation bites");
      } else fail(`(a) order-set and attested derivations did not disagree as required: real=${real.spent} naive=${naiveSpent}`);

      // The falsifier that matters: exhaustion must still trip however small the query's own
      // attempt_budget looks against a scope that was ACTUALLY closed and never went green — a
      // scope with attempt_budget=1 and one closed, red attempt cannot be reported "held" just
      // because nobody asked for a second slot.
      mkdirSync(dirname(dispatchReceipts(ws, slug)), { recursive: true });
      writeFileSync(dispatchReceipts(ws, slug), JSON.stringify({ at: new Date().toISOString(), order_id: `${slug}/sole-r1-a1`, run_id: runId, worker_declared: "task-executor", skill_invoked: "task-executor", dispatch_ok: true, tool: "Skill", agent_id: null, agent_type: null }) + "\n");
      writeFileSync(legLedger(ws, slug), JSON.stringify({ schema_version: 1, run_id: runId, order_id: `${slug}/sole-r1-a1`, worker: "task-executor", operation: "execute", mode: "orchestrated", scope_id: "sole", round: 1, attempt: 1, compiled_at: new Date().toISOString(), dispatched_at: new Date().toISOString(), ingested_at: new Date().toISOString(), started_from: "dispatch-receipt", duration_ms: 1, attested: true }) + "\n");
      const exhausted = scopeAttempts(ws, slug, "sole", 1, 1);
      if (exhausted.spent === 1 && exhausted.tripped === true) {
        ok("(b) a genuinely exhausted budget (1 of 1, closed, never green) trips — the cheapest wrong fix to this stage disarms the breaker entirely, and does not here");
      } else fail(`(b) a genuinely exhausted budget did not trip: ${JSON.stringify(exhausted)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("124. probe attempts is registered, and scope-hammer's own census cites it — the two readers cannot drift apart silently");
  // ===============================================================================================
  {
    const { ROUTES } = await import(join(ROOT, "kernel/harness.mjs"));
    if (ROUTES?.probe?.attempts === "./probe/attempts.mjs") {
      ok("(a) `probe attempts` is registered in the kernel's routing table");
    } else fail(`(a) probe attempts is not wired into ROUTES: ${JSON.stringify(ROUTES?.probe)}`);

    const skillPath = join(ROOT, "skills/scope-hammer/SKILL.md");
    const skillBody = existsSync(skillPath) ? readFileSync(skillPath, "utf8") : "";
    if (/probe attempts\b/.test(skillBody) && /attempt-budget/.test(skillBody)) {
      ok("(b) scope-hammer's SKILL.md cites `probe attempts` for its GATE H0 census, instead of reading t0/verdicts directly");
    } else fail("(b) scope-hammer's SKILL.md does not cite probe attempts — the census can still read exhaustion off writable T0 verdicts alone");
  }

  // ===============================================================================================
  section("125. The pipeline REFUSES an attempt opened over an unanswered one — driven, not read");
  // ===============================================================================================
  //
  // THE SECTION THIS MODULE WAS MISSING, and the reason it is worth having. Every check above
  // drives `scopeAttempts` directly, so all of them pass over a derivation nothing consults — which
  // is exactly the state this stage was first accepted in: a correct function, no call site, seven
  // green rows and the defect still live. Rule 7 says a guard asserting a call must also assert its
  // effect; these assert the effect and must also assert the call.
  //
  // So this spawns the real `harness compile` and asks whether the PIPELINE refuses.
  {
    const ws = mkdtempSync(join(tmpdir(), "attested-125-"));
    try {
      const slug = "guard73";
      const scopeId = "widget";
      openRun(ROOT, ws, slug, "Drive the compile-time attempt guard");
      const contract = scopeContract(ws, slug, scopeId);

      const orderId = `${slug}/${scopeId}-r1-a1`;
      mkdirSync(join(ws, ".shapeup", slug, "orders"), { recursive: true });
      writeFileSync(join(ws, ".shapeup", slug, "orders", `${scopeId}-r1-a1.json`),
        JSON.stringify({ schema_version: 1, order_id: orderId, scope_id: scopeId, round: 1, attempt: 1 }, null, 2));
      mkdirSync(verdictsDir(ws, slug), { recursive: true });
      writeFileSync(join(verdictsDir(ws, slug), "r1-a1.json"),
        JSON.stringify({ schema_version: 1, scope_id: scopeId, round: 1, attempt: 1, overall: "red" }, null, 2));

      // Attempt 1 was DISPATCHED and has not come back: a receipt, no leg row, no WorkResult.
      // That is the consumer run's own state when it opened attempt 2.
      // The receipt carries THIS run's key, as a real dispatch-receipt hook writes it. A receipt
      // without one used to make this case pass for the wrong reason: the gate read every attempt
      // as unattested, so it refused here — and refused an answered attempt just the same.
      const runId = JSON.parse(readFileSync(join(ws, ".shapeup", slug, "receipt.json"), "utf8")).run_id;
      mkdirSync(dirname(dispatchReceipts(ws, slug)), { recursive: true });
      writeFileSync(dispatchReceipts(ws, slug), JSON.stringify({
        at: new Date().toISOString(), order_id: orderId, run_id: runId, worker_declared: "task-executor",
        skill_invoked: "task-executor", dispatch_ok: true, tool: "Skill",
      }) + "\n");

      const r = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "compile",
        "--scope", contract, "--round", "1", "--attempt", "2", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
      const said = `${r.stdout || ""}${r.stderr || ""}`;

      if (r.status !== 0 && /unanswered/i.test(said)) {
        ok("(a) compile refuses --attempt 2 while attempt 1 is dispatched-but-unanswered");
      } else if (r.status === 0) {
        fail("(a) compile OPENED attempt 2 over an unanswered attempt 1 — the derivation exists but " +
             `nothing consults it; the order was written to ${(r.stdout || "").trim()}`);
      } else {
        fail(`(a) compile failed for a different reason than the guard (exit ${r.status}): ${said.trim().slice(0, 300)}`);
      }

      // FAILS OPEN where the bad state cannot be proven: a lane that never attests dispatches has
      // no receipts ledger, and must not be blocked by a rule it cannot satisfy.
      const ws2 = mkdtempSync(join(tmpdir(), "attested-125b-"));
      try {
        const slug2 = "guard73b";
        openRun(ROOT, ws2, slug2, "A lane that does not attest dispatches");
        const contract2 = scopeContract(ws2, slug2, scopeId);
        mkdirSync(join(ws2, ".shapeup", slug2, "orders"), { recursive: true });
        writeFileSync(join(ws2, ".shapeup", slug2, "orders", `${scopeId}-r1-a1.json`),
          JSON.stringify({ schema_version: 1, order_id: `${slug2}/${scopeId}-r1-a1`, scope_id: scopeId, round: 1, attempt: 1 }, null, 2));
        const r2 = spawnSync(process.execPath, [
          join(ROOT, "kernel/harness.mjs"), "compile",
          "--scope", contract2, "--round", "1", "--attempt", "2", "--cwd", ws2,
        ], { cwd: ws2, encoding: "utf8", timeout: 60_000 });
        if (r2.status === 0) {
          ok("(b) with no receipts ledger on disk the guard waves the attempt through — fails open, never closed");
        } else {
          fail(`(b) the guard blocked a lane that never attests dispatches (exit ${r2.status}): ` +
               `${`${r2.stdout || ""}${r2.stderr || ""}`.trim().slice(0, 300)}`);
        }
      } finally { rmSync(ws2, { recursive: true, force: true }); }

      // (c) THE ANSWERED ATTEMPT OPENS THE NEXT ONE. Measured on a live run (3.7.3): receipt, leg
      // row and result all on disk for attempt 1, the census reading it spent, and compile refusing
      // attempt 2 three times as "no dispatch receipt was ever written" — because the gate asked
      // without the run key and nothing could match. The ratchet was one attempt deep.
      mkdirSync(dirname(legLedger(ws, slug)), { recursive: true });
      writeFileSync(legLedger(ws, slug), JSON.stringify({
        schema_version: 1, run_id: runId, order_id: orderId, worker: "task-executor", operation: "execute",
        scope_id: scopeId, round: 1, attempt: 1, dispatched_at: new Date().toISOString(),
        ingested_at: new Date().toISOString(), attested: true,
      }) + "\n");
      mkdirSync(join(ws, ".shapeup", slug, "results"), { recursive: true });
      writeFileSync(join(ws, ".shapeup", slug, "results", `${scopeId}-r1-a1.json`),
        JSON.stringify({ schema_version: 1, order_id: orderId, worker: "task-executor", status: "done" }));
      const census = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "probe", "attempts", "--slug", slug, "--scope", scopeId,
        "--round", "1", "--attempt-budget", "5", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
      const spent = /"spent":1/.test(census.stdout || "");
      const r3 = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "compile",
        "--scope", contract, "--round", "1", "--attempt", "2", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 60_000 });
      if (spent && r3.status === 0 && existsSync(join(ws, ".shapeup", slug, "orders", `${scopeId}-r1-a2.json`))) {
        ok("(c) once attempt 1 is attested (receipt + leg row + result), the census reads it spent AND compile opens attempt 2 — the two readers of one channel agree");
      } else {
        fail(`(c) attempt 1 is attested on every channel, yet compile ${r3.status === 0 ? "opened attempt 2 without an order file" : `refused attempt 2 (exit ${r3.status})`} while the census says ${spent ? "spent" : "NOT spent"}: ` +
             `${`${r3.stdout || ""}${r3.stderr || ""}`.trim().slice(0, 300)}`);
      }
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }
}
