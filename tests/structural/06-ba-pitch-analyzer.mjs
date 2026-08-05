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

    // HD-004 — the board parser reads BOTH frontmatter list forms.
    //
    // §46(f)(g)(h)(i) pin the same family in `contract-md.mjs`, and that is the whole of the
    // coverage: this repo shipped TWO hand-rolled frontmatter readers for one documented format,
    // so fixing the first left the second silently returning empty and cost a full paid
    // `ba-pitch-analyzer` measurement — every list field on all twenty tasks came back empty,
    // `depends_on`/`unlocks` in BOTH directions so edge-symmetry passed VACUOUSLY, and the run was
    // published as `NOT met` before the cause was found. A guard on one parser is not a guard on
    // the format. This is the second parser's.
    const { parseBoard } = await import(bdPath);
    const hdTmp = mkdtempSync(join(tmpdir(), "board-hd004-"));
    try {
      writeFileSync(join(hdTmp, "TASK-001.md"), [
        "---", "id: TASK-001", "type: task", "status: ready",
        "depends_on:", "  - TASK-002", "  - TASK-003",
        "use_case_refs:", "  - UC-01",
        "unlocks: []",
        "---", "", "body", "",
      ].join("\n"));
      writeFileSync(join(hdTmp, "TASK-002.md"), [
        "---", "id: TASK-002", "type: task", "status: ready",
        "depends_on: [TASK-003, TASK-004]", "use_case_refs: [UC-02]", "unlocks: []",
        "---", "", "body", "",
      ].join("\n"));
      const board = Object.fromEntries(parseBoard(hdTmp).map((t) => [t.id, t]));
      const blockTask = board["TASK-001"], inlineTask = board["TASK-002"];
      if (blockTask && blockTask.depends_on.join(",") === "TASK-002,TASK-003" && blockTask.use_case_refs.join(",") === "UC-01")
        ok("HD-004: board-derive reads a YAML block sequence (was: every list field silently empty)");
      else fail(`HD-004 regression: a block-sequence board task parsed as depends_on=${JSON.stringify(blockTask?.depends_on)} use_case_refs=${JSON.stringify(blockTask?.use_case_refs)} — the SECOND frontmatter parser has drifted from the first again`);
      // Non-regression in the other direction: the inline form is what every committed board uses,
      // and a fix that reads block sequences by breaking `[a, b]` trades one silent empty for another.
      if (inlineTask && inlineTask.depends_on.join(",") === "TASK-003,TASK-004" && inlineTask.use_case_refs.join(",") === "UC-02")
        ok("HD-004 fix leaves the inline [a, b] list form intact (discriminates)");
      else fail(`HD-004 fix broke the inline list form: depends_on=${JSON.stringify(inlineTask?.depends_on)} use_case_refs=${JSON.stringify(inlineTask?.use_case_refs)}`);
      if (blockTask && blockTask.unlocks.length === 0) ok("HD-004: an empty inline list is still empty (no phantom member)");
      else fail(`HD-004: \`unlocks: []\` parsed as ${JSON.stringify(blockTask?.unlocks)} — an empty list must not gain a member`);
    } finally {
      rmSync(hdTmp, { recursive: true, force: true });
    }

    // HD-001, spec-lint's arm. §46(f) pins the PARSER — that an unreadable contract reports a
    // reason instead of an empty field. This pins the CONSUMER: a lint that reads a contract it
    // cannot see must say so, because every rule below it then passes for the part it could not
    // read, and a green lint over an unread file is the same fail-open `trace-lint` was made to
    // stop. Same defect, second call site.
    const { lint } = await import(slPath);
    const ulTmp = mkdtempSync(join(tmpdir(), "spec-lint-unreadable-"));
    try {
      const scopes = join(ulTmp, "shapeup", "demo", "scopes");
      mkdirSync(scopes, { recursive: true });
      writeFileSync(join(scopes, "SC-01.md"), [
        "---", "schema_version: 1", "scope_id: SC-01", "substrate: [src/cart/**]", "---",
        "# Affordance manifest — SC-01",            // <- not the heading the parser claims
        "| test_id | role | name |", "|---|---|---|", "| T-01 | button | Add to cart |", "",
      ].join("\n"));
      const findings = lint({ cwd: ulTmp, slug: "demo" }).findings || [];
      const unreadable = findings.find((f) => f.rule === "CONTRACT-UNREADABLE");
      if (unreadable && unreadable.level === "red") ok("HD-001: spec-lint reports a scope contract it cannot read (was: every rule passed over an unread file)");
      else fail(`HD-001 regression: spec-lint returned ${JSON.stringify(findings.map((f) => f.rule))} for a contract whose table it could not parse — silence here means the rules below graded nothing`);
      // Discriminates: the correctly-headed contract must not trip it, or every scope goes red.
      writeFileSync(join(scopes, "SC-01.md"), [
        "---", "schema_version: 1", "scope_id: SC-01", "substrate: [src/cart/**]", "---",
        "## Affordances",
        "| test_id | role | name |", "|---|---|---|", "| T-01 | button | Add to cart |", "",
      ].join("\n"));
      if (!(lint({ cwd: ulTmp, slug: "demo" }).findings || []).some((f) => f.rule === "CONTRACT-UNREADABLE"))
        ok("HD-001 spec-lint guard is silent on a correctly-headed scope contract (no false alarm)");
      else fail("HD-001 spec-lint guard fired on a VALID scope contract — a guard that cannot stay quiet gets switched off");
    } finally {
      rmSync(ulTmp, { recursive: true, force: true });
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
