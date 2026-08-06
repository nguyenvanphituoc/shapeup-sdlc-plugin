// 16 — Workflow scripts (skills/tech-lead/workflows/*.js): the migration's D5 floor and the
// test-#45 path-literal discipline, extended.
//
// WHY THIS MODULE EXISTS.
//
// docs/workflow_migration_plan.md Stage 1 moves the BUILD round's per-scope attempt loop out of
// SKILL.md prose and into a Workflow script (skills/tech-lead/workflows/shapeup-build-round.js).
// Two invariants that used to be enforced by review now need a mechanical guard of their own,
// because a Workflow script has no PreToolUse hook watching its own source the way a worker's
// tool calls do:
//
//   1. THE MODEL FLOOR (D5, PO decision 2026-08-06). Every agent() call in every workflow
//      script — including the mechanical courier — runs at sonnet or above. A workflow script
//      that quietly drops to a cheaper tier for "just the courier" reproduces the exact
//      mislabelled-comparison class docs/workflow_extraction_review.md's Day-2 lesson names:
//      a courier that mis-transcribes stdout corrupts the pipeline at its narrowest channel.
//      Greppable, case-insensitively, over the whole directory — the migration contract's own
//      acceptance row does the same grep; this module exists so `npm test` catches a regression
//      before a human has to run that grep by hand.
//
//   2. THE PATH-LITERAL DISCIPLINE (test #45, extended). `lib/paths.mjs` is the storage roots'
//      one home; #45 already asserts no runtime .mjs file spells out a legacy root literal. A
//      Workflow script cannot even `import` paths.mjs the normal way (it has no filesystem of
//      its own — design doc §1, "the workflow touches no file") — every path it needs comes from
//      a `${args.pluginRoot}`-rooted script invocation or that invocation's own stdout. This
//      module asserts every quoted string in a workflow script that names one of the two storage
//      roots (`shapeup/`, `.shapeup/`) is EITHER produced by a script's stdout (never spelled out
//      as a literal — the source contains no such literal at all) or does not appear outside a
//      comment. A workflow script that hardcodes ".shapeup/<slug>/results/…" the way
//      docs/workflow_extraction_review.md's own illustrative pseudocode does would pass code
//      review by looking identical to the SKILL.md prose it replaces, and be exactly the kind of
//      "looks complete, produces no diagnostic, is wrong" defect #45's own banner describes.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Strip /* *\/ and // comments so prose inside a workflow script's own banner is never
 * mistaken for a path literal the code actually resolves. Mirrors 45-paths.mjs's codeOnly(). */
const codeOnly = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("16. Workflow scripts (skills/tech-lead/workflows/) — D5 floor + path-literal discipline");
  // =============================================================================

  const WORKFLOWS_DIR = "skills/tech-lead/workflows";
  const abs = join(ROOT, WORKFLOWS_DIR);

  if (!existsSync(abs)) {
    fail(`${WORKFLOWS_DIR}/ does not exist — Stage 1 of the migration plan creates it`);
    return;
  }

  const files = readdirSync(abs).filter((f) => f.endsWith(".js"));
  if (files.length === 0) {
    fail(`${WORKFLOWS_DIR}/ exists but contains no .js workflow script`);
    return;
  }
  ok(`${WORKFLOWS_DIR}/ exists with ${files.length} workflow script(s)`);

  if (!files.includes("shapeup-build-round.js")) {
    fail(`${WORKFLOWS_DIR}/shapeup-build-round.js is missing (migration plan Stage 1)`);
  } else {
    ok("shapeup-build-round.js is present");
  }

  // --- (a) the D5 model floor: no sub-sonnet tier named anywhere in workflows/ ----------------
  //
  // The acceptance contract's own check is `! grep -riq haiku skills/tech-lead/workflows/`. This
  // is the same assertion, run as part of `npm test` rather than only at release-acceptance time,
  // and phrased without ever spelling out the disallowed name (an allowlist test naming the tier
  // it forbids would itself trip a grep for that name).
  const SUB_FLOOR_PATTERN = /ha[i1]ku/i;
  const floorOffenders = [];
  for (const f of files) {
    const code = readFileSync(join(abs, f), "utf8");
    code.split("\n").forEach((line, i) => {
      if (SUB_FLOOR_PATTERN.test(line)) floorOffenders.push(`${WORKFLOWS_DIR}/${f}:${i + 1}`);
    });
  }
  if (floorOffenders.length === 0) {
    ok(`no model below the D5 floor is named anywhere in ${files.length} workflow script(s)`);
  } else {
    fail(`model floor (D5) violated — a sub-sonnet tier is named in:\n    ${floorOffenders.join("\n    ")}`);
  }

  // --- (b) path-literal discipline: no storage root spelled out in code -----------------------
  //
  // Every `agent()`/`mech()` command a workflow script builds must resolve a harness path either
  // by rooting it at `${args.pluginRoot}` (the one thing a launch args object is guaranteed to
  // carry) or by reading a prior call's stdout. The mechanical proxy for "resolved, not spelled
  // out": neither storage root string appears in the file's CODE at all — comments describing the
  // discipline (like this module's own banner, and the workflow script's) are exempt.
  const ROOT_LITERAL = /(?<!["'`\w-])\.?shapeup\//;
  const literalOffenders = [];
  for (const f of files) {
    const code = codeOnly(readFileSync(join(abs, f), "utf8"));
    code.split("\n").forEach((line, i) => {
      if (ROOT_LITERAL.test(line)) literalOffenders.push(`${WORKFLOWS_DIR}/${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  if (literalOffenders.length === 0) {
    ok(`no workflow script spells out a storage root literal (${files.length} file(s) scanned) — every harness path is `
      + "${args.pluginRoot}-rooted or produced by a script's stdout");
  } else {
    fail(`a workflow script hardcodes a storage root instead of resolving it via a `
      + `\${args.pluginRoot}-rooted script call or that call's stdout:\n    ${literalOffenders.join("\n    ")}`);
  }

  // --- (c) every script invocation a workflow builds is ${args.pluginRoot}-rooted -------------
  //
  // The companion half of (b): a `node "<path>/scripts/…"` command that names a pipeline script
  // must start the path at the launch arg, exactly like every `${CLAUDE_PLUGIN_ROOT}`-rooted Bash
  // call in SKILL.md today — never a bare or half-qualified form (mirrors #14's invocation-path
  // check, extended to the new dispatch surface).
  const SCRIPT_CALL = /node\s+"([^"]*scripts\/[\w.-]+\.mjs)"/g;
  const scriptCallOffenders = [];
  for (const f of files) {
    const code = codeOnly(readFileSync(join(abs, f), "utf8"));
    let m;
    while ((m = SCRIPT_CALL.exec(code))) {
      if (!/^\$\{args\.pluginRoot\}\//.test(m[1])) scriptCallOffenders.push(`${WORKFLOWS_DIR}/${f}: node "${m[1]}"`);
    }
  }
  if (scriptCallOffenders.length === 0) {
    ok("every pipeline-script invocation built by a workflow script is ${args.pluginRoot}-rooted");
  } else {
    fail(`a workflow script invokes a pipeline script without rooting it at \${args.pluginRoot}:\n    ${scriptCallOffenders.join("\n    ")}`);
  }
}
