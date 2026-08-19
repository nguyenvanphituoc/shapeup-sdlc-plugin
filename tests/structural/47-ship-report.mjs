// 47 — the ship report is derived, and reports the code that actually shipped.
//
// ADR-0001 keeps run state gitignored and freezes ONE markdown report into the committed tier at
// GATE L4, so a reviewer sees the evidence without the churn. That makes this file the only thing
// a teammate reads about how the run went — which means the ways it can be wrong are the ways the
// whole harness can lie.
//
// Two failure modes are worth pinning:
//
//   1. REPORTING A TREE THAT WAS THROWN AWAY. The ratchet reverts a trial whose score did not
//      improve, so the LAST trial for a scope is frequently NOT the one on the branch. A report
//      that took the last row would describe code nobody can see, and it would look completely
//      normal doing it. The surviving trial (`kept`/`rebased`) is the only honest one.
//   2. QUIETLY DROPPING THE CAVEAT. A run can reach L4 with unfinished tasks (GATE L2 only warns
//      since this same ADR). A PASS printed without saying so reads as "the feature is done".
//
// Everything else here asserts the report is DERIVED — no field is a claim the orchestrator makes
// about its own run.

import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("47. The ship report is derived from artifacts, and names the surviving tree");
  // =============================================================================

  const SR = await import(join(ROOT, "kernel/reduce/ship.mjs"));
  const dir = mkdtempSync(join(tmpdir(), "ship-report-"));

  try {
    const w = (rel, body) => {
      const p = join(dir, rel);
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, body);
    };

    w(".shapeup/demo/tasks/TASK-001-a.md", "---\nid: TASK-001\nstatus: done\n---\n");
    w(".shapeup/demo/tasks/TASK-002-b.md", "---\nid: TASK-002\nstatus: in-progress\n---\n");
    w(".shapeup/demo/harness-run.md", "---\ntype: harness-run\nrounds_used: 2\nfinal_verdict: PASS\n---\n");
    w(".shapeup/demo/receipt.json", JSON.stringify({ intake_sha256: "deadbeef" }));
    w(".shapeup/demo/t0/verdicts/r1-a1-t1.json", "{}");
    w(".shapeup/demo/t0/verdicts/r1-a2-t1.json", "{}");

    // The trial history that matters: attempt 2 reached 5/5 and was KEPT; attempt 3 regressed to
    // 4/5 and was REVERTED, so the tree on the branch is the 5/5 one.
    w(".shapeup/demo/t0/trials.jsonl", [
      JSON.stringify({ trial: 1, scope_id: "cart", score: { regressions: 0, fixtures_passed: 2, fixtures_total: 5 }, status: "kept", delta: "baseline" }),
      JSON.stringify({ trial: 2, scope_id: "cart", score: { regressions: 0, fixtures_passed: 5, fixtures_total: 5 }, status: "kept", delta: "+3 fixtures" }),
      JSON.stringify({ trial: 3, scope_id: "cart", score: { regressions: 0, fixtures_passed: 4, fixtures_total: 5 }, status: "reverted", delta: "-1 fixture" }),
    ].join("\n") + "\n");

    w(".shapeup/demo/evaluation/EVAL-FEATURE-demo.md", "# EVAL\n\n## Bugs\n### BUG-1 — minor\nrounding off by one\n");
    w(".shapeup/demo/qa/hunt-report.md", "# Hunt\n\n## Findings\n- ~ empty-cart badge flickers\n");
    w(".shapeup/demo/round-ledger.md", "## Decisions\n| ID | Scope | A |\n|---|---|---|\n| ESC-1 | cart | use idempotency key |\n");

    const { markdown, facts, path } = SR.generate({ cwd: dir, slug: "demo" });

    // --- (1) the surviving tree, not the last trial ---------------------------
    const cart = facts.t0.find((s) => s.scope_id === "cart");
    if (cart?.score?.fixtures_passed === 5 && cart.status === "kept") {
      ok("T0 summary reports the SURVIVING trial (5/5 kept), not the reverted one (4/5)");
    } else {
      fail(`T0 summary took a discarded tree: ${JSON.stringify(cart)} — a reverted trial's code is not on the branch`);
    }
    if (cart?.trials === 3) ok("T0 summary counts every attempt (3) while scoring only the survivor");
    else fail(`trial count wrong: ${cart?.trials}`);

    // --- (2) the unfinished-work caveat ---------------------------------------
    if (facts.board.total === 2 && facts.board.done === 1) ok("board census derives 1/2 done from task frontmatter");
    else fail(`board census wrong: ${JSON.stringify(facts.board)}`);

    if (/did not finish/.test(markdown) && markdown.includes("TASK-002")) {
      ok("report states plainly that a task did not finish, and names it");
    } else {
      fail("report printed a verdict without disclosing unfinished tasks — that reads as 'the feature is done'");
    }

    // --- derivation, not assertion --------------------------------------------
    if (facts.verdict === "PASS" && facts.rounds === "2") ok("verdict and round count come from harness-run.md frontmatter");
    else fail(`verdict/rounds not derived: ${facts.verdict} / ${facts.rounds}`);

    if (facts.artifacts === 2) ok("T0 artifact count is a directory census (2), not a claim");
    else fail(`artifact count wrong: ${facts.artifacts}`);

    if (facts.intakeSha === "deadbeef") ok("the intake digest is carried through from the run receipt");
    else fail(`intake sha not carried: ${facts.intakeSha}`);

    // --- lifted sections -------------------------------------------------------
    for (const [label, needle] of [["evaluation bugs", "rounding off by one"], ["QA findings", "badge flickers"], ["adjudicated decisions", "idempotency key"]]) {
      if (markdown.includes(needle)) ok(`report lifts ${label} out of the local run trace`);
      else fail(`report dropped ${label} — the reviewer loses the evidence`);
    }

    // --- (3) the ratchet reading is harvested, not lost with the local tier -----
    // `ratchetReport()` is the instrument for Day 1's exit criterion — measured quality
    // improvement — and the trial ledger it reduces lives in the gitignored tier: harvested at
    // SHIP or gone with the run. These ~10 derived scalars do not grow, which is why they belong
    // in the committed report even though `metrics/` correctly does not (ADR-0001). The fixture
    // above is deliberately a sawtooth (kept → kept → reverted), the shape that says the loop is
    // still a budgeted retry loop, so a report that flattered it would be caught here.
    const R = facts.ratchet;
    if (R?.trials === 3 && R.sawtooth_count === 1) ok("ratchet aggregate is derived from the trial ledger (3 trials, 1 sawtooth)");
    else fail(`ratchet aggregate wrong: ${JSON.stringify(R)}`);

    if (R?.improvement_rate === 0.5 && R.monotone_rate === 0) ok("improvement rate excludes the baseline trial, and the revert breaks monotonicity");
    else fail(`ratchet rates wrong: improvement=${R?.improvement_rate} monotone=${R?.monotone_rate} — a scope carrying a revert is not monotone`);

    if (/## Ratchet/.test(markdown) && /Sawtooth count \| 1 /.test(markdown)) ok("the report renders the ratchet reading, not just the T0 table");
    else fail("the run has trials but the report has no Ratchet section — the instrument was built and never read");

    // --- destination -----------------------------------------------------------
    if (path.endsWith(join("shapeup", "demo", "REPORT.md"))) ok("report lands in the committed tier as shapeup/<slug>/REPORT.md");
    else fail(`report destination wrong: ${path}`);

    // --- (4) rounds_used is derived from evaluate-r<N>.json results, not trusted from
    //     harness-run.md's frontmatter, which nothing in the round loop ever rewrites -----------
    // Reproduced against a real live run: `harness-run.md` is written once at GATE L0.1 with
    // `rounds_used: 0` and no writer anywhere updates that field as rounds complete (the
    // orchestrator's own RunReturn carries the real count, but shapeup-run.js never passes it to
    // `reduce ship`), so a real one-round run's `REPORT.md` printed "Rounds used | 0" beside its
    // own `results/evaluate-r1.json`. This fixture reproduces exactly that shape: a stale
    // `rounds_used: 0` in the frontmatter alongside two real completed rounds on disk.
    const roundsDir = mkdtempSync(join(tmpdir(), "ship-report-rounds-"));
    try {
      const w2 = (rel, body) => {
        const p = join(roundsDir, rel);
        mkdirSync(join(p, ".."), { recursive: true });
        writeFileSync(p, body);
      };
      w2(".shapeup/rounds-demo/harness-run.md", "---\ntype: harness-run\nrounds_used: 0\nfinal_verdict: PASS\n---\n");
      w2(".shapeup/rounds-demo/results/evaluate-r1.json", "{}");
      w2(".shapeup/rounds-demo/results/evaluate-r2.json", "{}");

      const { facts: rf } = SR.generate({ cwd: roundsDir, slug: "rounds-demo" });
      if (rf.rounds === 2) ok("rounds_used is derived from the highest evaluate-r<N>.json result on disk (2), not the stale frontmatter (0)");
      else fail(`rounds_used still trusted the stale frontmatter claim instead of the real artifacts: got ${JSON.stringify(rf.rounds)}, expected 2`);
    } finally { rmSync(roundsDir, { recursive: true, force: true }); }

    // --- a bare run still produces a valid report -------------------------------
    const bare = mkdtempSync(join(tmpdir(), "ship-report-bare-"));
    try {
      const r = SR.generate({ cwd: bare, slug: "empty" });
      if (r.markdown.includes("type: ship-report") && r.markdown.includes("not-evaluated")) {
        ok("a run with no artifacts still renders a valid report (verdict: not-evaluated)");
      } else fail("report generator failed on a bare run — every section must be optional");
      // Zeroes from an empty ledger are not a measurement: an improvement_rate of 0 with no trials
      // reads exactly like a loop that never improved anything.
      if (!/## Ratchet/.test(r.markdown)) ok("a run with no trials omits the Ratchet section rather than printing zeroes as a reading");
      else fail("bare run printed a Ratchet section — an unmeasured run must not look like a flat series");
    } finally { rmSync(bare, { recursive: true, force: true }); }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
