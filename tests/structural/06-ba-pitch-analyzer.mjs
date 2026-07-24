// Structural test module: ba-pitch-analyzer. Split out of tests/structural.mjs (Track C).
// Sections: 23. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { assertJsdocCoverage } from "../lib/jsdoc.mjs";

/**
 * Run the ba-pitch-analyzer structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;

  // =============================================================================
  section("23. board-derive + spec-lint mechanize the planner's graph math and lints (pure-skill P3)");
  // =============================================================================
  const bdPath = join(ROOT, "skills/ba-pitch-analyzer/scripts/board-derive.mjs");
  const slPath = join(ROOT, "skills/ba-pitch-analyzer/scripts/spec-lint.mjs");
  if (existsSync(bdPath) && existsSync(slPath)) {
    const { deriveUnlocks, criticalPath } = await import(bdPath);
    const { lintScopes } = await import(slPath);
    const tasks = [
      { id: "T1", depends_on: [], unlocks: [], hours: 2 },
      { id: "T2", depends_on: ["T1"], unlocks: [], hours: 3 },
      { id: "T3", depends_on: ["T2"], unlocks: [], hours: 1 },
    ];
    const un = deriveUnlocks(tasks);
    if (un.T1.includes("T2") && un.T2.includes("T3") && un.T3.length === 0) ok("deriveUnlocks computes the depends_on inverse (KB-BA-001 mechanized)");
    else fail(`deriveUnlocks wrong: ${JSON.stringify(un)}`);
    const cp = criticalPath(tasks);
    if (cp.hours === 6 && cp.chain.join(">") === "T1>T2>T3") ok("criticalPath finds the longest chain by hours");
    else fail(`criticalPath wrong: ${JSON.stringify(cp)}`);
    // PA1 discriminates: single-layer substrate red, cross-layer substrate clean.
    const repoFiles = ["apps/web/cart/Cart.tsx", "apps/api/cart/route.ts"];
    const layerScope = [{ scope_id: "web-only", topology_type: "LAYER_CAKE", allowed_file_substrate: ["apps/web/cart/*.tsx"] }];
    const flowScope = [{ scope_id: "cart", topology_type: "LAYER_CAKE", allowed_file_substrate: ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"] }];
    if (lintScopes(layerScope, repoFiles).some((f) => f.rule === "PA1" && f.level === "red")) ok("spec-lint PA1 flags a directory-aligned scope");
    else fail("spec-lint PA1 missed a single-layer scope");
    if (!lintScopes(flowScope, repoFiles).some((f) => f.rule === "PA1")) ok("spec-lint PA1 passes a cross-layer flow slice (discriminates)");
    else fail("spec-lint PA1 wrongly flagged a flow slice");
    // DISJOINT: undeclared overlap red; declared-in-both shared clean.
    const overlapping = [
      { scope_id: "a", allowed_file_substrate: ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"], shared_substrate: [] },
      { scope_id: "b", allowed_file_substrate: ["apps/api/cart/*.ts", "apps/web/cart/*.tsx"], shared_substrate: [] },
    ];
    if (lintScopes(overlapping, repoFiles).some((f) => f.rule === "DISJOINT" && f.level === "red")) ok("spec-lint flags an undeclared substrate overlap");
    else fail("spec-lint missed a substrate overlap");
    const declared = overlapping.map((s) => ({ ...s, shared_substrate: ["apps/api/cart/*.ts", "apps/web/cart/*.tsx"] }));
    if (!lintScopes(declared, repoFiles).some((f) => f.rule === "DISJOINT")) ok("spec-lint accepts overlap declared in BOTH shared_substrate lists");
    else fail("spec-lint wrongly flagged a declared shared substrate");
    // TIER-DIRECTION + UC-ANCHOR — the tier rule is mechanical: a SHARED spec doc never links
    // the LOCAL board; a LOCAL task must fully anchor into the committed spec.
    const { lintStructure } = await import(slPath);
    const tierTmp = mkdtempSync(join(tmpdir(), "spec-lint-tier-"));
    try {
      const specDir = join(tierTmp, "spec");
      mkdirSync(join(specDir, "usecases"), { recursive: true });
      writeFileSync(join(specDir, "domain-model.md"), "# dm\n");
      writeFileSync(join(specDir, "usecases", "UC-Checkout.md"), "## Steps\n");
      writeFileSync(join(specDir, "synthesis.md"), "covered by [[tasks/TASK-001]]\n");
      const tierTasks = [
        { id: "TASK-001", file: "TASK-001.md", type: "task", status: "ready", depends_on: [], unlocks: [], use_case_refs: ["UC-Checkout"] },
        { id: "TASK-002", file: "TASK-002.md", type: "task", status: "ready", depends_on: [], unlocks: [], use_case_refs: [] },
        { id: "TASK-003", file: "TASK-003.md", type: "task", status: "ready", depends_on: [], unlocks: [], use_case_refs: ["UC-Ghost"] },
        { id: "TASK-004", file: "TASK-004.md", type: "SPIKE", status: "ready", depends_on: [], unlocks: [], use_case_refs: [] },
      ];
      const tierFindings = lintStructure({ specDir, tasks: tierTasks });
      if (tierFindings.some((f) => f.rule === "TIER-DIRECTION" && f.level === "red" && f.detail.includes("synthesis.md")))
        ok("spec-lint TIER-DIRECTION flags a [[tasks/...]] link in a SHARED spec doc");
      else fail("spec-lint TIER-DIRECTION missed a SHARED→LOCAL task link");
      if (tierFindings.some((f) => f.rule === "UC-ANCHOR" && f.level === "red" && f.detail.includes("TASK-002")))
        ok("spec-lint UC-ANCHOR flags a task with empty use_case_refs");
      else fail("spec-lint UC-ANCHOR missed an unanchored task");
      if (tierFindings.some((f) => f.rule === "UC-ANCHOR" && f.detail.includes("TASK-003") && f.detail.includes("UC-Ghost")))
        ok("spec-lint UC-ANCHOR flags an anchor naming a nonexistent UC");
      else fail("spec-lint UC-ANCHOR missed an unresolvable use_case_refs entry");
      if (!tierFindings.some((f) => f.rule === "UC-ANCHOR" && f.detail.includes("TASK-001")))
        ok("spec-lint UC-ANCHOR passes a fully anchored task (discriminates)");
      else fail("spec-lint UC-ANCHOR wrongly flagged an anchored task");
      if (!tierFindings.some((f) => f.rule === "UC-ANCHOR" && f.detail.includes("TASK-004")))
        ok("spec-lint UC-ANCHOR exempts a SPIKE task (anchors via api_ref)");
      else fail("spec-lint UC-ANCHOR wrongly flagged a SPIKE task");
    } finally {
      rmSync(tierTmp, { recursive: true, force: true });
    }
  } else {
    fail("board-derive.mjs / spec-lint.mjs missing — the planner's mechanical layer is absent");
  }

  // =============================================================================
  section("33. JSDoc coverage — ba-pitch-analyzer's board-derive + spec-lint carry contracts");
  // =============================================================================
  // The planner's mechanical layer is graph math a model must never re-derive; its function
  // signatures are the contract (skills-optimization plan, Track D). Counted into the floor.
  assertJsdocCoverage(ctx, [
    "skills/ba-pitch-analyzer/scripts/board-derive.mjs",
    "skills/ba-pitch-analyzer/scripts/spec-lint.mjs",
  ].map((f) => join(ROOT, f)), (p) => p.replace(ROOT + "/", ""));
}
