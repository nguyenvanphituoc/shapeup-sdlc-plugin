// 29 — STOP CERTIFYING AN UNRUN REGRESSION CHECK (Phase 3.5 / S4).
//
// THE DEFECT THIS CLOSES. `hill.mjs` used to infer `seesawGreen` from `regression === false` on a
// green T0 verdict. `t0.mjs`'s `computeVerdict()` defines `seesawGreen = !seesaw.ran || seesaw.pass`
// and `regression = fixturesGreen && dbGreen && !seesawGreen` — so when the seesaw check never runs
// at all (`seesaw.ran === false`), `seesawGreen` is vacuously `true` and `regression` is always
// `false`. Nothing anywhere in this codebase currently passes `--seesaw-registry` to `verify t0`, so
// that "never ran" branch is the ONLY branch that ever fires today. `hill.mjs` was reading "not
// asked" as "clean": a scope could reach FINISHED on a regression check that had never executed once.
//
// THE FIX reads the REAL signal `t0.mjs` already persists on the verdict artifact — `seesaw.ran &&
// seesaw.pass` — instead of the derived-and-wrong `regression === false`. A scope with no seesaw
// registry wired (every scope today) simply cannot reach FINISHED via the seesaw arm; wiring the
// registry for real is a deferred Betting Table decision (real running cost), not built here.
//
// WHAT THIS MODULE PROVES, by calling the shipped `deriveHill()` directly against two fixture verdict
// artifacts that differ ONLY in `seesaw.ran`:
//   (1) `seesaw: {ran: false, pass: true, ...}` (today's only real-world shape, with `regression:
//       false` exactly as `computeVerdict()` always emits it when nothing ran) must NOT reach
//       FINISHED — it lands at DOWNHILL_EXECUTION. This fixture is also the "watched red" proof: the
//       OLD `regression === false` inference reads FINISHED off this exact fixture (that field really
//       is `false` here), so a check that could not tell these two fixtures apart would not have
//       caught the defect.
//   (2) `seesaw: {ran: true, pass: true, ...}` — a seesaw check that genuinely ran and passed — DOES
//       reach FINISHED, proving the new read is not simply "never FINISHED."

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

/** Write a file (JSON object or raw string), creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/**
 * Build one fixture run root: a single scope contract, a passing T1 spec-conformance verdict, and
 * one green T0 verdict artifact carrying the given `seesaw` object.
 * @param {object} seesaw - The `seesaw` fact block to embed on the verdict artifact.
 * @returns {string} The fixture's project root (`cwd`).
 */
function buildFixture(seesaw) {
  const cwd = mkdtempSync(join(tmpdir(), "struct-hill-seesaw-"));
  const slug = "hill-seesaw-demo";
  w(cwd, `shapeup/${slug}/scopes/SC-HILL.json`, {
    schema_version: 1, scope_id: "SC-HILL",
    allowed_file_substrate: ["src/hill/**"],
  });
  w(cwd, `.shapeup/${slug}/evaluation/.verdicts-run.jsonl`,
    JSON.stringify({ run: 1, dimension: "spec-conformance", verdict: "PASS" }) + "\n");
  w(cwd, `.shapeup/${slug}/t0/verdicts/r1-a1-t1.json`, {
    schema_version: 2, round: 1, attempt: 1, trial: 1, scope_id: "SC-HILL",
    fixtures_green: true, db_probe_green: true, seesaw_green: seesaw.ran ? seesaw.pass : true,
    overall: "green",
    // computeVerdict() always emits this exact value when fixtures+db are green: `false` whenever
    // seesaw never ran (vacuous seesawGreen), and also `false` here in the ran-and-passed case —
    // it is NOT a discriminator between the two fixtures, which is exactly why reading it was wrong.
    regression: false,
    seesaw,
  });
  return { cwd, slug };
}

/**
 * Run the hill-seesaw derivation checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("29. hill.mjs stops certifying a seesaw check that never ran (Phase 3.5 / S4)");
  // =============================================================================

  const { deriveHill } = await import(join(ROOT, "kernel/reduce/hill.mjs"));

  // --- (1) seesaw never ran: must NOT reach FINISHED, and this is the exact fixture the old
  //         `regression === false` inference would have wrongly certified -------------------------
  {
    const { cwd, slug } = buildFixture({ ran: false, pass: true, scopes_checked: [], failing: [] });
    try {
      const report = deriveHill(cwd, slug);
      const row = report.find((r) => r.scope_id === "SC-HILL");
      if (!row) fail("deriveHill() returned no row for SC-HILL against the seesaw-never-ran fixture");
      else if (row.phase === "FINISHED") {
        fail("SC-HILL reached FINISHED with seesaw.ran===false — the exact defect this stage closes: a regression check that never executed is being certified as clean");
      } else if (row.phase === "DOWNHILL_EXECUTION") {
        ok("SC-HILL with seesaw.ran===false lands at DOWNHILL_EXECUTION, not FINISHED — an unrun seesaw check no longer certifies a scope");
      } else {
        fail(`SC-HILL with seesaw.ran===false landed at unexpected phase ${JSON.stringify(row.phase)} (expected DOWNHILL_EXECUTION)`);
      }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (2) seesaw genuinely ran and passed: DOES reach FINISHED — proves the new read is a real
  //         signal, not just "never FINISHED" -----------------------------------------------------
  {
    const { cwd, slug } = buildFixture({ ran: true, pass: true, scopes_checked: ["SC-OTHER"], failing: [] });
    try {
      const report = deriveHill(cwd, slug);
      const row = report.find((r) => r.scope_id === "SC-HILL");
      if (!row) fail("deriveHill() returned no row for SC-HILL against the seesaw-ran-and-passed fixture");
      else if (row.phase === "FINISHED") {
        ok("SC-HILL with seesaw.ran===true && seesaw.pass===true correctly reaches FINISHED");
      } else {
        fail(`SC-HILL with a genuine passing seesaw check landed at ${JSON.stringify(row.phase)}, expected FINISHED — the new read rejects a real green signal, not only the vacuous one`);
      }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
}
