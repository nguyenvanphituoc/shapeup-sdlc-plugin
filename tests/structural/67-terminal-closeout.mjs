// 67 — the run tells the kernel something, and it survives a relaunch (defect-sweep Stage 8, part
// 1 of 2). Sections: 106, 107, 108.
//
// THE COMMON SHAPE, measured against three separate defects. Every fact the orchestrator held only
// in a JS variable was a fact a relaunch lost:
//
//   HD-011  An abort (or a ship) left `harness-run.md` reading `status: evaluating`, `closed_at: ~`,
//           with no cause recorded anywhere — a live EVAL and a dead one were indistinguishable from
//           the trace alone. `closeRun` (kernel/probe/resume.mjs) is the one call site that stamps a
//           terminal status, its cause and `closed_at` together, and the export carries the row.
//   HD-017  A worker's ESCALATE (`status:"escalated"`, `deviations[]`) reached nothing: `deviations`
//           was read in exactly two places, neither of them a channel anybody else consults.
//           `reduce ingest` now routes it into the SAME discovery ledger `discoveries[]` already
//           uses, and this module proves the channel is READ (by `reduce ship`'s own "Discovered,
//           not built" section), not merely written.
//   HD-018  A run whose rounds never reached EVAL reported zero: `rounds_used` was derived only from
//           `evaluate-r<N>.json` results. `deriveRounds` (kernel/probe/rounds.mjs) derives from the
//           highest round carrying an order, a T0 verdict OR a build-gate artifact, and keeps
//           "judged" as its own field.
//
// Every function under test here is PURE (reads the trace fresh, on every call, from files alone) —
// which is what "survives a relaunch" means when the orchestrator that calls it cannot itself be
// imported (see 58-relaunch-memory.mjs's own banner). Calling the same derivation twice, from two
// unrelated invocations, and getting the identical answer both times IS the relaunch proof.

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

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  const { closeRun, setRunStatus, TERMINAL_STATUSES, parseFrontmatter } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  const { deriveRounds } = await import(join(ROOT, "kernel/probe/rounds.mjs"));
  const { collectRun } = await import(join(ROOT, "kernel/report/export.mjs"));
  const { applyResult } = await import(join(ROOT, "kernel/reduce/ingest.mjs"));
  const { generate } = await import(join(ROOT, "kernel/reduce/ship.mjs"));
  const { deriveSnapshot } = await import(join(ROOT, "kernel/reduce/snapshot.mjs"));

  // ===============================================================================================
  section("106. HD-011 — a terminal close is a status, a cause and a timestamp, in one write");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "closeout-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");

      // --- (a) refuses a non-terminal status, rather than silently stamping a live run as done ---
      const badStatus = closeRun(ws, "checkout", { status: "building", cause: "x" });
      if (badStatus.ok === false && /not terminal/.test(badStatus.reason) && TERMINAL_STATUSES.includes("aborted")) {
        ok("(a) closeRun refuses a non-terminal status rather than closing a run that is still in flight");
      } else fail(`(a) closeRun accepted a non-terminal status: ${JSON.stringify(badStatus)}`);
      if (!/^status:\s*building/m.test(readFileSync(join(ws, ".shapeup/checkout/harness-run.md"), "utf8"))) {
        // status is still "orienting" (init run's own default) — the refused write touched nothing
        ok("(a) the refused write left the ledger's status untouched");
      } else fail("(a) closeRun wrote a status it should have refused");

      // --- (b) the measured HD-011 scenario: an EVAL worker escalates, the run aborts -------------
      // Deliberately carries a quote, a colon, an em-dash and an embedded newline — the shapes a
      // real escalation reason takes, and the ones that break a line-based frontmatter dialect if
      // spelled in naively.
      const RAW_CAUSE = 'evaluator escalated: missing repository method "listOrdersByUser"\nno safe guess — stopped rather than invent one';
      const STORED_CAUSE = 'evaluator escalated: missing repository method "listOrdersByUser" no safe guess — stopped rather than invent one';
      const closed = closeRun(ws, "checkout", { status: "aborted", cause: RAW_CAUSE });
      if (closed.ok && closed.status === "aborted" && closed.closed_at) {
        ok("(b) closeRun reports ok, the terminal status, and a closed_at timestamp");
      } else fail(`(b) closeRun did not close cleanly: ${JSON.stringify(closed)}`);

      const ledgerText = readFileSync(join(ws, ".shapeup/checkout/harness-run.md"), "utf8");
      const fm = parseFrontmatter(ledgerText);
      if (fm.status === "aborted" && fm.closed_at && fm.closed_at !== "~") {
        ok("(b) the ledger itself reads status:aborted with a real closed_at — not still \"evaluating\" (the measured defect)");
      } else fail(`(b) the ledger did not take the close: status=${fm.status} closed_at=${fm.closed_at}`);
      // The cause round-trips its quote and its colon verbatim, and its embedded newline collapses
      // to a space rather than splitting the frontmatter's line-based format — proving the single
      // write does not corrupt the ledger it shares the file with.
      if (fm.close_cause === STORED_CAUSE) {
        ok("(b) close_cause round-trips a cause carrying a quote and a colon verbatim, and collapses its embedded newline instead of corrupting the ledger");
      } else fail(`(b) close_cause did not round-trip: got ${JSON.stringify(fm.close_cause)}`);
      // AND the line right after it (max_rounds is unrelated, but any FOLLOWING frontmatter line
      // proves the multi-line cause did not spill past its own key and corrupt a sibling line).
      if (fm.deploy === null && fm.started_at) {
        ok("(b) sibling frontmatter lines are intact — the cause did not leak past its own line");
      } else fail(`(b) a sibling frontmatter line was corrupted: deploy=${JSON.stringify(fm.deploy)} started_at=${JSON.stringify(fm.started_at)}`);

      // --- (c) the acceptance proposition itself: the export carries the row ----------------------
      const collected = collectRun(ws, "checkout");
      const row = collected?.tables?.run?.[0];
      if (row && row.status === "aborted" && row.closed_at && row.close_cause === STORED_CAUSE) {
        ok("(c) a forced abort leaves a terminal status, a cause, AND an export row carrying both — the HD-011 acceptance proposition");
      } else fail(`(c) the export's run row is missing the close: ${JSON.stringify(row)}`);

      // (c2) The export carries the AUTHORITATIVE terminal status, not only the mutable `status:`
      // line. Ordinary Ship-phase traffic rewrites `status:` after a close, so an export that
      // carried only that line could show a run wearing a different close's cause — the close
      // would survive in the ledger and be lost from the fact tables, which are what a later
      // measurement actually reads.
      if (row && row.closed_status === "aborted") {
        ok("(c2) the export's run row carries closed_status — the terminal fact `closeRun` alone writes, beside the mutable status line");
      } else fail(`(c2) the export lost the authoritative terminal status: closed_status=${JSON.stringify(row?.closed_status)}`);

      // --- (d) "a kill mid-run followed by a relaunch loses none of the above" --------------------
      // Every fixture above called closeRun through the file — never through a variable this test
      // held onto. A second, unrelated call (a fresh read, exactly what a relaunched process would
      // do) reads the SAME state back, because there was never anywhere else for it to live.
      const reread = parseFrontmatter(readFileSync(join(ws, ".shapeup/checkout/harness-run.md"), "utf8"));
      if (reread?.close_cause === STORED_CAUSE && reread?.status === "aborted") {
        ok("(d) a second, independent read of the ledger (simulating a relaunch) sees the identical close — nothing lived only in memory");
      } else fail("(d) a second read of the ledger disagreed with the first — the close is not durable");

      // --- (e) a terminal close is a ONCE-ONLY fact in the kernel, not a rule in prose -------------
      // REWORK — measured: `--close aborted` (H: CANNOT SHIP) followed by `--close shipped` (L4)
      // flipped status and destroyed the original cause, with only a sentence in gates.md standing
      // between the two calls. A DIFFERENT terminal status over an already-closed run must refuse.
      const overwrite = closeRun(ws, "checkout", { status: "shipped", cause: "verdict=PASS rounds=2 decision=ship" });
      if (overwrite.ok === false && /already closed/.test(overwrite.reason || "") && overwrite.closed_status === "aborted") {
        ok("(e) closeRun refuses to overwrite an already-closed run with a DIFFERENT terminal status");
      } else fail(`(e) closeRun accepted a second, different close: ${JSON.stringify(overwrite)}`);
      const afterOverwrite = parseFrontmatter(readFileSync(join(ws, ".shapeup/checkout/harness-run.md"), "utf8"));
      if (afterOverwrite.status === "aborted" && afterOverwrite.close_cause === STORED_CAUSE) {
        ok("(e) the refused overwrite left the ledger's original status and cause completely intact");
      } else fail(`(e) the refused overwrite still corrupted the ledger: status=${afterOverwrite.status} cause=${afterOverwrite.close_cause}`);

      // --- (e2) REWORK ROUND 2 — BLOCKING #1, reproduced exactly: an intervening `status:` rewrite
      // (the product's OWN `setRunStatus`, not a hand-edited fixture) between the first close and a
      // second, different-status close attempt must NOT fool the once-only guard. Measured: the
      // pre-rework guard read `before.status` — the SAME mutable line `setRunStatus` just rewrote to
      // "shipped" — matched the incoming "shipped" close, and reported the run "already closed as
      // shipped", silently keeping the ABORT's own closed_at/cause under a status line that now read
      // "shipped". `shapeup-run.js:1659` does exactly this rewrite immediately before its own Ship-
      // phase close call runs.
      const midMutation = setRunStatus(ws, "checkout", "shipped");
      if (!midMutation.ok) fail(`(e2) fixture setup failed — setRunStatus could not rewrite status: ${JSON.stringify(midMutation)}`);
      const mutatedFm = parseFrontmatter(readFileSync(join(ws, ".shapeup/checkout/harness-run.md"), "utf8"));
      if (mutatedFm.status === "shipped" && mutatedFm.closed_status === "aborted") {
        ok("(e2) fixture: status: now reads \"shipped\" (an intervening rewrite) while closed_status: still reads \"aborted\" — the exact divergence the product's own Ship phase produces");
      } else fail(`(e2) fixture did not set up the divergence: status=${mutatedFm.status} closed_status=${mutatedFm.closed_status}`);
      const shipAfterMutation = closeRun(ws, "checkout", { status: "shipped", cause: "verdict=pass rounds=2 qa_findings=0" });
      if (shipAfterMutation.ok === false && shipAfterMutation.closed_status === "aborted" && shipAfterMutation.closed_at === closed.closed_at) {
        ok("(e2) BLOCKING #1 — closeRun still refuses the different-status close after status: was rewritten out from under it; the guard reads closed_status, immune to the mutation");
      } else fail(`(e2) BLOCKING #1 REOPENED — the guard was fooled by the intervening status: rewrite: ${JSON.stringify(shipAfterMutation)}`);
      const afterMutationAttempt = parseFrontmatter(readFileSync(join(ws, ".shapeup/checkout/harness-run.md"), "utf8"));
      if (afterMutationAttempt.closed_status === "aborted" && afterMutationAttempt.close_cause === STORED_CAUSE) {
        ok("(e2) the ledger's close record (closed_status/close_cause) is still the original abort — the refused write touched neither");
      } else fail(`(e2) the ledger's close record was disturbed by the refused write: closed_status=${afterMutationAttempt.closed_status} close_cause=${afterMutationAttempt.close_cause}`);
      // Restore status: to "aborted" for the sections below, which reason about it directly — the
      // mutation above was this sub-section's own fixture, not a standing change to the run.
      setRunStatus(ws, "checkout", "aborted");

      // --- (f) REWORK ROUND 2 — BLOCKING #2: the SAME terminal status, a DIFFERENT cause, is a
      // SECOND real close (a later relaunch's own abort), not a replay — it must SUPERSEDE, folding
      // the prior cause in, rather than being silently discarded as "idempotent". Measured: the
      // pre-rework guard treated ANY repeat of the same status as idempotent regardless of cause —
      // `--close aborted --cause A` then `--close aborted --cause B` kept cause A forever, `ok:true`,
      // with nothing anywhere recording that B ever happened.
      const relaunchCause = "a genuinely different reason — this launch's own abort, not a retry of the first";
      const superseded = closeRun(ws, "checkout", { status: "aborted", cause: relaunchCause });
      if (superseded.ok === true && superseded.superseded === true && superseded.decision === "superseded") {
        ok("(f) BLOCKING #2 — closing the SAME status with a DIFFERENT cause supersedes (ok:true, superseded:true) rather than a silent idempotent no-op");
      } else fail(`(f) BLOCKING #2 REOPENED — a same-status, different-cause close was not recognised as a supersede: ${JSON.stringify(superseded)}`);
      const afterSupersede = parseFrontmatter(readFileSync(join(ws, ".shapeup/checkout/harness-run.md"), "utf8"));
      if (afterSupersede.close_cause?.includes(relaunchCause) && afterSupersede.close_cause?.includes("listOrdersByUser")) {
        ok("(f) the ledger's close_cause carries the NEW cause AND folds the prior one in — nothing is silently lost");
      } else fail(`(f) the superseding close lost a cause: ${JSON.stringify(afterSupersede.close_cause)}`);
      if (afterSupersede.status === "aborted" && afterSupersede.closed_status === "aborted") {
        ok("(f) the supersede kept the SAME terminal status — only the cause and closed_at moved");
      } else fail(`(f) the supersede unexpectedly changed status: status=${afterSupersede.status} closed_status=${afterSupersede.closed_status}`);

      // --- (g) a TRUE replay — identical status AND identical cause — is still a real no-op ---------
      const trueReplay = closeRun(ws, "checkout", { status: "aborted", cause: afterSupersede.close_cause });
      if (trueReplay.ok === true && trueReplay.decision === "idempotent" && trueReplay.closed_at === superseded.closed_at) {
        ok("(g) replaying the EXACT close already on disk (same status, byte-identical cause) is a true idempotent no-op, not a second supersede");
      } else fail(`(g) an exact replay was not treated as idempotent: ${JSON.stringify(trueReplay)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("107. HD-018 — rounds built and rounds judged are two fields, derived from disk");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "rounds-"));
    try {
      openRun(ROOT, ws, "budgets", "Add category budgets");
      const local = join(ws, ".shapeup/budgets");

      // --- (a) the acceptance proposition itself: two build rounds, no EVAL, reports two ----------
      mkdirSync(join(local, "orders"), { recursive: true });
      writeFileSync(join(local, "orders/o1.json"), JSON.stringify({ order_id: "budgets/sc-01-r1-a1" }));
      writeFileSync(join(local, "orders/o2.json"), JSON.stringify({ order_id: "budgets/sc-01-r2-a1" }));
      let r = deriveRounds(ws, "budgets", 0);
      if (r.rounds_used === 2 && r.rounds_judged === null) {
        ok("(a) a run with two build rounds and no EVAL reports rounds_used=2, rounds_judged=null — the HD-018 acceptance proposition");
      } else fail(`(a) two build rounds with no EVAL mis-derived: ${JSON.stringify(r)}`);

      // --- (b) a T0 verdict artifact counts as build evidence too, even with no order on disk -----
      mkdirSync(join(local, "t0/verdicts"), { recursive: true });
      writeFileSync(join(local, "t0/verdicts/r3-a1-t1.json"), JSON.stringify({ round: 3 }));
      r = deriveRounds(ws, "budgets", 0);
      if (r.rounds_used === 3) ok("(b) a T0 verdict artifact for a later round raises rounds_used, independent of the order set");
      else fail(`(b) T0 verdict evidence was not picked up: ${JSON.stringify(r)}`);

      // --- (c) a round build-gate artifact counts too (AGENTS.md's round build gate ends a round) -
      mkdirSync(join(local, "build"), { recursive: true });
      writeFileSync(join(local, "build/r4-t1.json"), JSON.stringify({ round: 4, overall: "green" }));
      r = deriveRounds(ws, "budgets", 0);
      if (r.rounds_used === 4) ok("(c) a round build-gate artifact for a later round raises rounds_used too");
      else fail(`(c) build-gate evidence was not picked up: ${JSON.stringify(r)}`);

      // --- (d) rounds_judged is its OWN field — populated only by evaluate-r<N>.json results -------
      mkdirSync(join(local, "results"), { recursive: true });
      writeFileSync(join(local, "results/evaluate-r1.json"), "{}");
      r = deriveRounds(ws, "budgets", 0);
      if (r.rounds_used === 4 && r.rounds_judged === 1) {
        ok("(d) rounds_judged (1) stays separate from rounds_used (4) — a round built is not a round judged");
      } else fail(`(d) the two fields collapsed into one: ${JSON.stringify(r)}`);

      // --- (e) both numbers survive to the export ---------------------------------------------------
      const collected = collectRun(ws, "budgets");
      const row = collected?.tables?.run?.[0];
      if (row?.rounds_used === 4 && row?.rounds_judged === 1) {
        ok("(e) both rounds_used and rounds_judged survive to the export's run row");
      } else fail(`(e) the export lost one of the two round numbers: ${JSON.stringify(row)}`);

      // --- (f) the ship report renders "Rounds judged" as its own line, only when there is one ----
      const built = generate({ cwd: ws, slug: "budgets" });
      if (/Rounds judged \| 1/.test(built.markdown)) ok("(f) the ship report prints a Rounds judged row separate from Rounds used");
      else fail("(f) the ship report does not print the judged-rounds row at all");

      // --- (g) no EVAL at all -> the row is omitted, not printed as a false zero --------------------
      const ws2 = mkdtempSync(join(tmpdir(), "rounds-noeval-"));
      try {
        openRun(ROOT, ws2, "budgets", "Add category budgets");
        mkdirSync(join(ws2, ".shapeup/budgets/build"), { recursive: true });
        writeFileSync(join(ws2, ".shapeup/budgets/build/r1-t1.json"), JSON.stringify({ round: 1, overall: "green" }));
        writeFileSync(join(ws2, ".shapeup/budgets/build/r2-t1.json"), JSON.stringify({ round: 2, overall: "green" }));
        const { markdown, facts } = generate({ cwd: ws2, slug: "budgets" });
        if (facts.rounds === 2 && facts.roundsJudged === null && !/Rounds judged/.test(markdown)) {
          ok("(g) two built, unjudged rounds report rounds=2 and omit the judged row — never a misleading 0");
        } else fail(`(g) unjudged rounds mis-rendered: rounds=${facts.rounds} judged=${facts.roundsJudged}`);
      } finally { rmSync(ws2, { recursive: true, force: true }); }

      // --- (h) REWORK — the THIRD mechanical reader (compaction-rehydration snapshot) agrees too ---
      // `kernel/reduce/snapshot.mjs` used to read `harness-run.md`'s literal `rounds_used` frontmatter
      // line — written once, as 0, by `init run`, never rewritten — instead of `deriveRounds`.
      // Measured on this exact fixture (two build orders + a T0 verdict + a build-gate artifact +
      // one judged round, `round: 4` per its own latest T0 filename): `reduce snapshot` reported
      // `rounds_used: 0` beside its own `round: 4` — the rehydration record an orchestrator reads
      // after a context-compaction boundary disagreeing with itself, and with the ship report and
      // export this same section already proved agree at 4/1. Now all three read the same numbers.
      const snap = deriveSnapshot(ws);
      if (snap?.rounds_used === 4 && snap?.rounds_judged === 1) {
        ok("(h) the compaction-rehydration snapshot's rounds_used/rounds_judged now agree with the ship report and the export (4/1), not the ledger's stale literal 0");
      } else fail(`(h) the snapshot disagrees with the other two mechanical readers: ${JSON.stringify({ rounds_used: snap?.rounds_used, rounds_judged: snap?.rounds_judged })}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("108. HD-017 — an ESCALATE deviation lands in the discovery ledger, and is read back");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "escalate-"));
    try {
      openRun(ROOT, ws, "checkout", "Add checkout flow");

      // --- (a) a worker that escalates routes its FIRST deviation (the blocker) into the ledger ---
      const escalated = {
        schema_version: 1, order_id: "checkout/sc-01-r1-a1", worker: "task-executor",
        status: "escalated",
        deviations: ["blocked: repository method listOrdersByUser does not exist — no safe guess"],
      };
      const summary = applyResult(escalated, { cwd: ws });
      if (summary.escalations_appended === 1) ok("(a) applyResult reports one escalation appended");
      else fail(`(a) escalations_appended is wrong: ${summary.escalations_appended}`);

      const ledgerPath = join(ws, ".shapeup/checkout/discovery/ledger.md");
      if (existsSync(ledgerPath) && /\[ESCALATE\]/.test(readFileSync(ledgerPath, "utf8"))) {
        ok("(a) the discovery ledger carries an [ESCALATE] entry naming the blocker");
      } else fail("(a) nothing landed in the discovery ledger — the channel this fix routes to");

      // --- (b) NOT merely written — READ by a real consumer: reduce ship's own report -------------
      const { markdown } = generate({ cwd: ws, slug: "checkout" });
      if (markdown.includes("listOrdersByUser")) {
        ok("(b) the ship report's \"Discovered, not built\" section surfaces the escalated blocker — the channel is READ, not merely written");
      } else fail("(b) the ship report does not surface the escalation — a channel written and never read is HD-017 again");

      // --- (c) a non-escalated result with deviations present does NOT route here (scoped) --------
      const ws2 = mkdtempSync(join(tmpdir(), "escalate-scoped-"));
      try {
        openRun(ROOT, ws2, "checkout", "Add checkout flow");
        const done = {
          schema_version: 1, order_id: "checkout/sc-02-r1-a1", worker: "task-executor",
          status: "done", deviations: ["minor: used library default instead of a custom formatter"],
        };
        const s2 = applyResult(done, { cwd: ws2 });
        if (s2.escalations_appended === 0) ok("(c) a non-escalated result's deviations are not routed as an ESCALATE — the channel is scoped to status:escalated");
        else fail(`(c) a done result's deviations leaked into the escalation channel: ${s2.escalations_appended}`);
      } finally { rmSync(ws2, { recursive: true, force: true }); }

      // --- (d) REWORK — re-ingesting the IDENTICAL escalated result does not double-count it -------
      // Measured: replaying the same WorkResult through applyResult a second time appended a SECOND
      // "## Discovered — checkout/sc-01-r1-a1" block, so `grep -c '\[ESCALATE\]'` read 2 for a
      // WorkResult that ran exactly once — and both GATE H's census and the ship report's own
      // "Discovered, not built" section count this ledger's entries.
      const replay = applyResult(escalated, { cwd: ws });
      if (replay.escalations_appended === 0) {
        ok("(d) re-ingesting the identical escalated WorkResult reports zero NEW escalations appended — recognised as already logged");
      } else fail(`(d) a replayed ingest appended again: escalations_appended=${replay.escalations_appended}`);
      const ledgerAfterReplay = readFileSync(ledgerPath, "utf8");
      const escalateCount = (ledgerAfterReplay.match(/\[ESCALATE\]/g) || []).length;
      if (escalateCount === 1) {
        ok("(d) the discovery ledger still carries exactly ONE [ESCALATE] entry for the replayed order — not doubled");
      } else fail(`(d) the ledger carries ${escalateCount} [ESCALATE] entries after a replay — a re-ingest inflated GATE H's census`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }
}
