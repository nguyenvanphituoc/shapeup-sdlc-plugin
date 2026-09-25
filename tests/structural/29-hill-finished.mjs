// 29 — THE HILL'S TOP PHASE IS REACHABLE, AND ONLY ON EVIDENCE.
//
// WHAT THIS MODULE USED TO BE. It pinned the hill's refusal to certify a seesaw regression check
// that had never run: `hill.mjs` once inferred the arm was clean from `regression === false`, which
// is what `computeVerdict()` emits whenever the arm does not run — so a scope reached FINISHED on a
// check that never executed. The refusal was right, and it exposed the deeper fact: nothing in the
// codebase ever wrote the registry that arm read, so `seesaw.ran` was false on every verdict ever
// written, and FINISHED was therefore unreachable. Thirty-eight committed hill shards across the
// live consumer's features contain no FINISHED at all.
//
// The arm was removed in 3.8.0 by a Betting Table decision — wire it or delete it, and the answer
// was delete. This module keeps the question that outlives the arm: does the top phase derive from
// evidence that exists, and does it refuse when that evidence is missing? FINISHED now means T1
// passed and the scope holds a T0 green from a round the build gate did not red.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

/** Write a file (JSON object or raw string), creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/**
 * Build one fixture run root: a single scope contract, a T0 verdict, and — unless the caller says
 * otherwise — a passing T1 spec-conformance verdict that cites it.
 *
 * @param {{t0Green?:boolean, t1Pass?:boolean, redRound?:boolean}} [opts] - Which evidence exists.
 * @returns {{cwd:string, slug:string}} The fixture's project root and slug.
 */
function buildFixture({ t0Green = true, t1Pass = true, redRound = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "struct-hill-finished-"));
  const slug = "hill-demo";
  w(cwd, `shapeup/${slug}/scopes/SC-HILL.json`, {
    schema_version: 1, scope_id: "SC-HILL",
    allowed_file_substrate: ["src/hill/**"],
  });
  w(cwd, `.shapeup/${slug}/receipt.json`, {
    schema_version: 1, slug, run_id: `${slug}-20260101T000000Z-aaaaaaaa`, started_at: "2026-01-01T00:00:00.000Z",
  });
  const t0Body = {
    schema_version: 2, round: 1, attempt: 1, trial: 1, scope_id: "SC-HILL",
    fixtures_green: t0Green, db_probe_green: true,
    overall: t0Green ? "green" : "red",
  };
  const t0Path = `.shapeup/${slug}/t0/verdicts/r1-a1-t1.json`;
  // The evaluator's citation is re-hashed from disk, so the fixture cites the real digest of the
  // bytes it is about to write rather than a placeholder.
  const t0Hash = createHash("sha256").update(JSON.stringify(t0Body, null, 2)).digest("hex");
  if (t1Pass) {
    w(cwd, `.shapeup/${slug}/results/evaluate-r1.json`, {
      schema_version: 1, order_id: `${slug}/evaluate-r1`, worker: "spec-evaluator", status: "done",
      verdict: {
        overall: "PASS", bugs: [],
        criteria: [{ criterion: "UC-01 step 1", verdict: "PASS", evidence: "src/a.ts:1 measured" }],
        t0_citations: [{ scope_id: "SC-HILL", path: t0Path, sha256: t0Hash }],
      },
    });
  }
  w(cwd, t0Path, t0Body);
  // The round build gate: a T0 green from a round the gate red'd is evidence about the fixture, not
  // about the feature, and must not move the dot.
  if (redRound) w(cwd, `.shapeup/${slug}/build/r1-t1.json`, { round: 1, overall: "red" });
  return { cwd, slug };
}

/**
 * Run the hill phase-derivation checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("74. The hill's top phase is reachable, and only on evidence that exists");
  // =============================================================================

  const { deriveHill } = await import(join(ROOT, "kernel/reduce/hill.mjs"));
  const phaseOf = (opts) => {
    const { cwd, slug } = buildFixture(opts);
    try { return deriveHill(cwd, slug).find((r) => r.scope_id === "SC-HILL")?.phase ?? null; }
    finally { rmSync(cwd, { recursive: true, force: true }); }
  };

  // (1) The phase the removal bought back. For the life of the seesaw arm this was unreachable —
  //     not by policy but by an arm nobody wired, and no shard in any recorded run ever held it.
  const finished = phaseOf({});
  if (finished === "FINISHED") ok("T1 passed and a T0 green from a clean round reaches FINISHED — the top phase is no longer held shut by an arm that never ran");
  else fail(`a scope with T1 PASS and a green T0 landed at ${JSON.stringify(finished)}, expected FINISHED`);

  // (2) and (3) It still refuses on each missing half, which is what makes (1) a signal.
  const noT1 = phaseOf({ t1Pass: false });
  if (noT1 === "DOWNHILL_EXECUTION") ok("without a T1 pass the same green T0 stops at DOWNHILL_EXECUTION — the judge's verdict is half of FINISHED, not a formality");
  else fail(`a green T0 with no T1 verdict landed at ${JSON.stringify(noT1)}, expected DOWNHILL_EXECUTION`);

  const noT0 = phaseOf({ t0Green: false });
  if (noT0 !== "FINISHED" && noT0 !== "DOWNHILL_EXECUTION") ok(`without a green T0 the scope cannot reach either downhill phase (${noT0})`);
  else fail(`a scope with no green T0 landed at ${JSON.stringify(noT0)}`);

  // (4) The round build gate still outranks the fixture: a green T0 from a round that did not build
  //     is evidence about the fixture, and moves no dot.
  const redRound = phaseOf({ redRound: true });
  if (redRound !== "FINISHED") ok(`a T0 green from a round whose build gate is red does not reach FINISHED (${redRound}) — a green fixture in a round the feature did not build is evidence about the fixture`);
  else fail("a red round build gate let the scope reach FINISHED on its fixture alone");

  // (5) And the arm is gone from the scorer, not merely unused: the axes are what the two remaining
  //     arms produce, so a future reader cannot mistake a dropped field for an unread one.
  const { score } = await import(join(ROOT, "kernel/verify/t0.mjs"));
  const axes = Object.keys(score({ fixtures: { results: [{ pass: true }] }, dbProbe: null })).sort();
  if (JSON.stringify(axes) === JSON.stringify(["db_probe", "fixtures_passed", "fixtures_total"])) {
    ok("the T0 score vector carries exactly the axes the fixtures and the DB probe produce");
  } else fail(`verify t0's score() axes are ${JSON.stringify(axes)} — the vector and the arms disagree`);
  const t0Src = await import("node:fs").then((fs) => fs.readFileSync(join(ROOT, "kernel/verify/t0.mjs"), "utf8"));
  if (!/seesawCheck|seesaw_green|--seesaw-registry/.test(t0Src)) ok("no seesaw entry point, verdict field or flag survives in the verifier");
  else fail("the arm was removed from the scorer but something of it is still exported");
}
