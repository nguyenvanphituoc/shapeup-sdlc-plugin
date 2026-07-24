// Structural test module: spec-evaluator. Split out of tests/structural.mjs (Track C).
// Sections: 15. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { assertJsdocCoverage } from "../lib/jsdoc.mjs";

/**
 * Run the spec-evaluator structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;

  // =============================================================================
  section("15. Verdict-ledger grammar flags flips and forces low confidence (Stage D1)");
  // =============================================================================
  // The judge-calibration reference impl (audit D1 / F3). Proves the documented flip/confidence
  // grammar discriminates an unstable judge (verdict changed across runs) from a stable one — and
  // that a flip FORCES confidence low regardless of what the judge proposed. The skill performs this
  // procedure itself (verdict-ledger.md, no script dep); this is the executable proof, like the oracles.
  const vlPath = join(ROOT, "skills/spec-evaluator/scripts/verdict-ledger.mjs");
  if (existsSync(vlPath)) {
    const { reconcile, detectFlips, stability, parseLedger } = await import(vlPath);

    // reconcile: AC4 PASS(run1) → FAIL(run2) is a flip → confidence forced low; AC1 PASS→PASS stable.
    const prior = [
      { run: 1, dimension: "spec-conformance", criterion: "AC1", verdict: "PASS", confidence: "high" },
      { run: 1, dimension: "spec-conformance", criterion: "AC4", verdict: "PASS", confidence: "high" },
    ];
    const current = [
      { run: 2, dimension: "spec-conformance", criterion: "AC1", verdict: "PASS", confidence: "medium" },
      { run: 2, dimension: "spec-conformance", criterion: "AC4", verdict: "FAIL", confidence: "high" },
    ];
    const { records, summary } = reconcile(prior, current);
    const ac4 = records.find((r) => r.criterion === "AC4");
    const ac1 = records.find((r) => r.criterion === "AC1");
    if (ac4.flip && ac4.confidence === "low") ok("reconcile flags a PASS→FAIL flip and forces confidence low");
    else fail(`reconcile did not flag/downgrade the AC4 flip (flip=${ac4.flip}, confidence=${ac4.confidence})`);
    if (!ac1.flip && ac1.confidence === "medium") ok("reconcile leaves a stable criterion untouched");
    else fail(`reconcile wrongly altered the stable AC1 (flip=${ac1.flip}, confidence=${ac1.confidence})`);
    if (summary.flipped === 1 && summary.stable === 1) ok("reconcile summary counts 1 flipped / 1 stable");
    else fail(`reconcile summary wrong: ${JSON.stringify(summary)}`);

    // detectFlips over a full ledger: only AC4 flipped.
    const ledger = [...prior, ...current];
    const flips = detectFlips(ledger);
    if (flips.length === 1 && flips[0].criterion === "AC4" && flips[0].from === "PASS" && flips[0].to === "FAIL")
      ok("detectFlips finds the AC4 PASS→FAIL transition and nothing else");
    else fail(`detectFlips wrong: ${JSON.stringify(flips)}`);

    // stability: 1 of 2 latest-run criteria stable.
    const s = stability(ledger);
    if (s.stable === 1 && s.total === 2) ok("stability reports 1/2 stable for the latest run");
    else fail(`stability wrong: ${JSON.stringify(s)}`);

    // Negative control: a fully-stable ledger has no flips and stability 1.0.
    const stable = [
      { run: 1, dimension: "d", criterion: "X", verdict: "PASS" },
      { run: 2, dimension: "d", criterion: "X", verdict: "PASS" },
    ];
    if (detectFlips(stable).length === 0 && stability(stable).ratio === 1) ok("a stable ledger yields no flips (discriminates)");
    else fail("verdict-ledger reported a flip on a stable ledger — grammar is not discriminating");

    // CLI: exit 1 on a flip, exit 0 on a clean ledger.
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const d = mkdtempSync(join(tmpdir(), "vl-"));
    try {
      const flipFile = join(d, ".verdicts-TASK-001.jsonl");
      writeFileSync(flipFile, ledger.map((l) => JSON.stringify(l)).join("\n"));
      const rf = spawnSync("node", [vlPath, flipFile], { encoding: "utf8" });
      if (rf.status === 1 && /flip/i.test(rf.stdout)) ok("verdict-ledger CLI exits 1 and reports the flip");
      else fail(`verdict-ledger CLI did not flag the flip (exit ${rf.status})\n${rf.stdout}`);

      const okFile = join(d, ".verdicts-TASK-002.jsonl");
      writeFileSync(okFile, stable.map((l) => JSON.stringify(l)).join("\n"));
      const rs = spawnSync("node", [vlPath, okFile], { encoding: "utf8" });
      if (rs.status === 0 && /no verdict flips/i.test(rs.stdout)) ok("verdict-ledger CLI exits 0 on a stable ledger");
      else fail(`verdict-ledger CLI mis-graded a stable ledger (exit ${rs.status})\n${rs.stdout}`);
      parseLedger(""); // smoke: empty parse must not throw
    } finally { rmSync(d, { recursive: true, force: true }); }
  } else {
    console.log("  (verdict-ledger reference impl not found — skipping)");
  }

  // =============================================================================
  section("34. JSDoc coverage — spec-evaluator's verdict-ledger reference impl carries contracts");
  // =============================================================================
  // The executable proof of the flip/confidence grammar; its exported functions are the seam a
  // consumer imports (skills-optimization plan, Track D). Counted into the checks-floor.
  assertJsdocCoverage(ctx, [
    "skills/spec-evaluator/scripts/verdict-ledger.mjs",
  ].map((f) => join(ROOT, f)), (p) => p.replace(ROOT + "/", ""));
}
