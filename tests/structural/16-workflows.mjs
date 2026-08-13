// 16 — Workflow scripts (skills/tech-lead/workflows/*.js): the migration's D5 floor and the
// test-#45 path-literal discipline, extended.
//
// WHY THIS MODULE EXISTS.
//
// The orchestrator cutover moved the BUILD round's per-scope attempt loop out of SKILL.md prose and
// into a Workflow script. It shipped first as its own file, was then inlined into
// skills/tech-lead/workflows/shapeup-run.js (that file's banner gives the three reasons), and the
// orphan was deleted. The directory is expected to hold exactly the scripts SKILL.md launches —
// check (0) below is what keeps that true.
//
// Two invariants that used to be enforced by review now need a mechanical guard of their own,
// because a Workflow script has no PreToolUse hook watching its own source the way a worker's
// tool calls do:
//
//   1. THE MODEL FLOOR (D5, PO decision 2026-08-06). Every agent() call in every workflow
//      script — including the mechanical courier — runs at sonnet or above. A workflow script
//      that quietly drops to a cheaper tier for "just the courier" reproduces a measured
//      mislabelled-comparison failure: a courier that mis-transcribes stdout corrupts the
//      pipeline at its narrowest channel.
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
//      comment. A workflow script that hardcodes ".shapeup/<slug>/results/…" the way the
//      cutover's own illustrative pseudocode did would pass code
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

  // --- (0) every workflow script on disk is reachable from the skill that launches it ----------
  //
  // THE DEFECT THIS CLOSES, measured. This module used to assert `shapeup-build-round.js` EXISTS.
  // Nothing asserted it RUNS — and for the whole of Stage 2 it did not: `shapeup-run.js` inlined
  // the round loop (see its own banner for why), SKILL.md launched only `shapeup-run.js`, and a
  // 418-line duplicate of the attempt loop sat in this directory reading as shipped code because
  // a green test named it. A presence assertion over an unreachable file is a row that cannot
  // fail in the direction that matters, one layer up from the three that revising the cutover's
  // acceptance instrument caught.
  //
  // The invariant is reachability, so that is what this asserts: every `.js` in workflows/ is
  // named by a `scriptPath:` the skill actually launches. It fails in BOTH directions a divergence
  // can go — a script nobody launches (Stage B's R10), and a launch naming a script that is not
  // there (the same class inverted, which is what deleting the wrong file would produce).
  //
  // ⟐ TWO LAUNCH SPELLINGS ARE RECOGNISED, and the second one is why this check nearly went the
  // wrong way. HD-007's fix moved SKILL.md's front door from `Workflow({scriptPath})` to a Bash
  // call — `node "…/scripts/run-workflow.mjs" "…/workflows/shapeup-run.js"` — because the tool form
  // cannot be granted headlessly. Against the old `scriptPath:`-only regex that lands as
  // "launches no workflow script at all: the dispatch surface is gone", i.e. the instrument
  // reporting a deletion at the moment the launcher moved. The INVARIANT is reachability, not a
  // spelling, so both spellings count and the failure modes below still fail in both directions.
  const SKILL_MD = "skills/tech-lead/SKILL.md";
  const skillSrc = existsSync(join(ROOT, SKILL_MD)) ? readFileSync(join(ROOT, SKILL_MD), "utf8") : "";
  const launched = new Set([
    ...[...skillSrc.matchAll(/scriptPath:\s*"[^"]*\/workflows\/([\w.-]+\.js)"/g)].map((m) => m[1]),
    ...[...skillSrc.matchAll(/run-workflow\.mjs"[\s\\]*"[^"]*\/workflows\/([\w.-]+\.js)"/g)].map((m) => m[1]),
  ]);
  const unreachable = files.filter((f) => !launched.has(f));
  const missing = [...launched].filter((f) => !files.includes(f));

  if (launched.size === 0) {
    fail(`${SKILL_MD} launches no workflow script at all — the Workflow dispatch surface is gone`);
  } else if (unreachable.length === 0 && missing.length === 0) {
    ok(`every workflow script is launched by ${SKILL_MD} (${[...launched].join(", ")}) — none is unreachable, none is missing`);
  } else {
    if (unreachable.length > 0) {
      fail(`a workflow script nobody launches — ${SKILL_MD} names no scriptPath for:\n    ${unreachable.join("\n    ")}\n`
        + "    Resolve it (delete, or document the second entry point in SKILL.md); dead code a green test pins reads as shipped.");
    }
    if (missing.length > 0) {
      fail(`${SKILL_MD} launches a workflow script that is not on disk:\n    ${missing.join("\n    ")}`);
    }
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

  // --- (d) no courier call may discard its own outcome (migration A2.2, row G3) ---------------
  //
  // THE DEFECT THIS CLOSES, measured. `setRunStatus` and `writeActiveScope` were the only two
  // mech() call sites in shapeup-run.js whose return value was never inspected, and they are the
  // only two whose failure went unnoticed — for two complete runs and 46 dispatched agents. The
  // ledger's status stayed pinned at "orienting" (so every relaunch re-dispatched a completed
  // ORIENT phase) and the substrate pointer kept naming scope 1 while scope 2 was built (so the
  // sandbox guard enforced the wrong whitelist, silently). Auditing the two instances found a
  // third class the same afternoon: every `ingest-result.mjs` call — the SINGLE WRITER of the
  // board, the ledger and the verdict record — discarded its outcome too.
  //
  // The general statement is what this check enforces: a courier write whose result nobody reads
  // back is indistinguishable from one that succeeded. `agent()` can return null, the runtime
  // documents it, and the mech envelope turns that into `exit_code: -1` — a fact that is only a
  // fact if somebody looks at it.
  // The list is "helpers that RETURN a raw envelope", not "everything that calls a courier". A
  // wrapper that inspects `exit_code` itself and acts on it — `setRunStatus` logs the failure and
  // lets the run continue, because resume no longer depends on that field — has already discharged
  // the obligation, and its own `mech()` call is covered by this same check one level down. That
  // is the difference between a value nobody looked at and a value somebody handled.
  // `requirePhase` (Stage A3) joins the list for the same reason `ingest` did: it returns the ABORT
  // a phase with no artifact earns, and a call site that awaits it without returning that value
  // drops the stop — the run would proceed past a phase that produced nothing, which is the defect
  // the post-condition exists to catch.
  const COURIERS = ["mech", "mechNode", "ingest", "compile", "writeActiveScope", "requirePhase"];
  // Characters that mean the value IS consumed: assignment, an enclosing call, a return, an
  // operand position. Anything else (`;`, `{`, `}`, `)`, `else`, start of file) drops it.
  const CONSUMED_BY = /(?:[=(,[?:]|\breturn\b|&&|\|\||\?\?)\s*$/;
  const discardOffenders = [];
  for (const f of files) {
    const code = codeOnly(readFileSync(join(abs, f), "utf8"));
    const re = new RegExp(`\\bawait\\s+(${COURIERS.join("|")})\\s*\\(`, "g");
    let m;
    while ((m = re.exec(code))) {
      const before = code.slice(0, m.index).trimEnd();
      if (CONSUMED_BY.test(before)) continue;
      const line = code.slice(0, m.index).split("\n").length;
      discardOffenders.push(`${WORKFLOWS_DIR}/${f}:${line}  await ${m[1]}(…) — outcome discarded`);
    }
  }
  // --- (e) no ingest is aimed by a worker's self-reported path (migration A3) -----------------
  //
  // THE DEFECT THIS CLOSES, measured. Stage A3's probe leg 1 aborted at its FIRST phase: ORIENT ran
  // fine, wrote `results/orient.json` exactly where its order said it would, and reported a
  // DIRECTORY as its `result_path`. `ingest-result.mjs` read it, got EISDIR, and the run returned
  // `{"status":"aborted","aborted_at":"ORIENT"}` — a phase that had done its whole job thrown away
  // on a claim about where it had put the work.
  //
  // The pairing is a FACT of the envelope port: compile-order.mjs writes `orders/<suffix>.json`,
  // every worker writes `results/<suffix>.json`, and the kill/resume probe's own assertions are set
  // operations over exactly that pairing. `resultFor(orderPath, …)` derives it. A `.result_path`
  // handed straight to an ingest call is the pipeline trusting a claim where a fact is available —
  // the same class as the phase post-condition, one field over.
  const REPORTED_PATH = /(?:ingest|ingestOrAbort)\(\s*(?:"[^"]*",\s*)?[A-Za-z_$][\w$]*\.result_path\b|ingest-result\.mjs" \$\{[A-Za-z_$][\w$]*\.result_path\}/;
  const reportedOffenders = [];
  for (const f of files) {
    const code = codeOnly(readFileSync(join(abs, f), "utf8"));
    code.split("\n").forEach((line, i) => {
      if (REPORTED_PATH.test(line)) reportedOffenders.push(`${WORKFLOWS_DIR}/${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  if (reportedOffenders.length === 0) {
    ok("no ingest is aimed by a worker's self-reported result_path — every one is derived from the order it answers");
  } else {
    fail("a workflow script ingests the path a worker CLAIMED it wrote, rather than the one its order "
      + `determines; a mis-reported path throws away a phase that did its job:\n    ${reportedOffenders.join("\n    ")}`);
  }

  if (discardOffenders.length === 0) {
    ok(`no courier call discards its outcome in ${files.length} workflow script(s) — every ${COURIERS.join("/")} result is read back`);
  } else {
    fail("a workflow script discards a courier's outcome; a write nobody reads back is "
      + `indistinguishable from one that succeeded:\n    ${discardOffenders.join("\n    ")}`);
  }
}
