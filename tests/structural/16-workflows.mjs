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
  // call — `node "…/kernel/harness.mjs" run "…/workflows/shapeup-run.js"` — because the tool form
  // cannot be granted headlessly. Against the old `scriptPath:`-only regex that lands as
  // "launches no workflow script at all: the dispatch surface is gone", i.e. the instrument
  // reporting a deletion at the moment the launcher moved. The INVARIANT is reachability, not a
  // spelling, so both spellings count and the failure modes below still fail in both directions.
  const SKILL_MD = "skills/tech-lead/SKILL.md";
  const skillSrc = existsSync(join(ROOT, SKILL_MD)) ? readFileSync(join(ROOT, SKILL_MD), "utf8") : "";
  const launched = new Set([
    ...[...skillSrc.matchAll(/scriptPath:\s*"[^"]*\/workflows\/([\w.-]+\.js)"/g)].map((m) => m[1]),
    ...[...skillSrc.matchAll(/harness\.mjs"\s+run[\s\\]*"[^"]*\/workflows\/([\w.-]+\.js)"/g)].map((m) => m[1]),
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
  // The list is "helpers that RETURN an outcome", not "everything that runs something". A wrapper
  // that inspects the outcome itself and acts on it — `setRunStatus` and `advisory` both log the
  // failure and let the run continue, because neither result is a gate — has already discharged the
  // obligation, and its own `cmd()` call is covered by this same check one level down. That is the
  // difference between a value nobody looked at and a value somebody handled.
  // `requirePhase` (Stage A3) joins the list for the same reason `ingest` did: it returns the ABORT
  // a phase with no artifact earns, and a call site that awaits it without returning that value
  // drops the stop — the run would proceed past a phase that produced nothing, which is the defect
  // the post-condition exists to catch.
  const COURIERS = ["cmd", "query", "worker", "requirePhase", "buildScope"];
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

  // --- (g) an ingest a workflow script DESCRIBES is aimed the same way one it CODES is ---------
  //
  // THE DEFECT THIS CLOSES, measured. Check (e) above forbids aiming an ingest with a worker's
  // self-reported `result_path`, because a worker that had done its whole job once reported a
  // DIRECTORY and the phase was thrown away on EISDIR. The native-runtime cutover deleted the
  // helper that derived the pairing (`resultFor`) along with the courier layer, and moved the
  // ingest call OUT of script code and INTO the prompt a sub-agent is handed — where it read
  // "reduce ingest <the result path the worker wrote>". That is check (e)'s exact defect, in prose,
  // one layer below the regex that guards it: a shell command a model composes from a claim.
  //
  // So the invariant is restated for the prose surface: every `reduce ingest` a workflow script
  // builds must be aimed by `--order`, which the kernel resolves through the orders/→results/
  // pairing itself. A control plane that stopped shelling out did not stop issuing commands; it
  // only stopped issuing them where the earlier checks were looking.
  const INGEST_CALL = /reduce\s+ingest\s+(\S+)/g;
  const proseOffenders = [];
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    codeOnly(src).split("\n").forEach((line, i) => {
      for (const m of line.matchAll(INGEST_CALL)) {
        if (!m[1].startsWith("--order")) {
          proseOffenders.push(`${WORKFLOWS_DIR}/${f}:${i + 1}  reduce ingest ${m[1].slice(0, 40)}`);
        }
      }
    });
  }
  if (proseOffenders.length === 0) {
    ok("every `reduce ingest` a workflow script builds is aimed by --order — the kernel derives the result from the order, so no dispatch rides on a claim about where the work was put");
  } else {
    fail("a workflow script aims an ingest at something other than `--order`; the orders/→results/ "
      + `pairing is a fact the kernel can derive, and anything else is a worker's claim:\n    ${proseOffenders.join("\n    ")}`);
  }

  // --- (h) no payload field is forwarded to compile as a bare null ------------------------------
  //
  // THE DEFECT THIS CLOSES, measured. `probe resume` answers `null` for context it does not know
  // yet (`stack`, `lens`, `run_cmd`, `app_url`); `WorkOrderPayload` types those `string` and marks
  // them OPTIONAL, so the contract says "omit it", not "send null". The cutover forwarded the
  // probe's value straight into the payload, and four of the seven operations this file dispatches
  // — orient, analyze, evaluate, hunt — were refused by their own order schema before any worker
  // ran. ORIENT is one of them, so the FIRST dispatch of every fresh run failed at compile; the
  // three operations carrying no nullable field always worked, which made a total failure look
  // intermittent.
  //
  // The mechanical guard: a payload object literal handed to compile must pass through a compacting
  // step. Checked by requiring the file to define one and to use it on the compile line, which is
  // weaker than type-checking the payload and is the strongest thing available to a static scan.
  const compileOffenders = [];
  for (const f of files) {
    const code = codeOnly(readFileSync(join(abs, f), "utf8"));
    if (!/compile\s+--operation/.test(code)) continue;
    const definesCompact = /const\s+compact\s*=/.test(code);
    const usesCompact = /--payload\s+'\$\{JSON\.stringify\(compact\(/.test(code);
    if (!definesCompact || !usesCompact) {
      compileOffenders.push(`${WORKFLOWS_DIR}/${f} — ${!definesCompact ? "defines no compact() helper" : "builds --payload without compact()"}`);
    }
  }
  if (compileOffenders.length === 0) {
    ok("every workflow script that compiles an order strips null/undefined payload fields first — an unknown value is an absent key, which is what WorkOrderPayload's optional string fields require");
  } else {
    fail("a workflow script forwards a possibly-null payload field into `compile`; `probe resume` "
      + "returns null for unknown context and the order schema types those fields `string`, so the "
      + `order is refused before any worker sees it:\n    ${compileOffenders.join("\n    ")}`);
  }

  // --- (i) every run status a workflow script sets is a member of the kernel's enum -------------
  //
  // THE DEFECT THIS CLOSES, measured. `shapeup-run.js` called `setRunStatus("analyzing")` at the
  // ANALYZE phase. `RUN_STATUSES` in the kernel is `orienting | mapping | building | evaluating |
  // shipped | escalated` — deliberately coarser than the file's phases — so that call was rejected
  // with exit 2 on EVERY run since the cutover, and the string "analyzing" appears nowhere in the
  // kernel at all. Because the write is advisory the run continued, and the only trace was a line
  // in a state-warning array nobody had read.
  //
  // The enum comes from the module that owns it, never from a copy kept here: a second list beside
  // the first is a second thing to forget, which is the same failure one level up.
  const { RUN_STATUSES } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  const statusOffenders = [];
  for (const f of files) {
    const code = codeOnly(readFileSync(join(abs, f), "utf8"));
    for (const m of code.matchAll(/setRunStatus\(\s*"([^"]+)"/g)) {
      if (!RUN_STATUSES.includes(m[1])) {
        const line = code.slice(0, m.index).split("\n").length;
        statusOffenders.push(`${WORKFLOWS_DIR}/${f}:${line}  setRunStatus("${m[1]}") — not one of ${RUN_STATUSES.join(" | ")}`);
      }
    }
  }
  if (statusOffenders.length === 0) {
    ok(`every run status a workflow script sets is a member of the kernel's RUN_STATUSES enum (${RUN_STATUSES.length} values, read from the module that defines it)`);
  } else {
    fail("a workflow script sets a run status the kernel does not accept; the write is advisory, so "
      + `it fails silently on every run and the ledger under-reports the phase:\n    ${statusOffenders.join("\n    ")}`);
  }

  // --- (f) `meta` is a PURE LITERAL, or the runtime never runs the file at all -----------------
  //
  // THE DEFECT THIS CLOSES, measured. Every check above this one asks whether the orchestrator is
  // shaped correctly. None of them asked whether it LOADS — and it did not. The runtime parses
  // `meta` statically, before the body executes, and rejects the whole script on any node it would
  // have to evaluate. `shapeup-run.js` wrote its description as three `+`-joined string literals,
  // which reads better in source and is a BinaryExpression to a parser, so the launch failed with
  // "meta must be a pure literal" and the pipeline could not start. It shipped that way through the
  // rebuild, tagged 2.0.0, under a fully green suite: the file was never once launched, because
  // every instrument pointed at it was static and this property is only visible to a parse.
  //
  // That is the general lesson worth the guard: a suite that checks a file's SHAPE exhaustively can
  // still miss whether the thing runs, and "the tests are green" then means less than it reads.
  //
  // The mechanical proxy for "pure literal": strip the string CONTENTS out of the meta block, then
  // look at the skeleton that remains. Anything that survives and implies evaluation — `+`
  // (BinaryExpression), `${` (a template with an expression), `(` (CallExpression), `...`
  // (SpreadElement) — is a node the runtime would refuse. Naming the classes, rather than pattern-
  // matching the one that bit, is what makes this catch the next spelling too.
  const META_START = /export\s+const\s+meta\s*=\s*\{/;

  /** The source of the `meta = { … }` object, brace-balanced with string state tracked. */
  function metaBlock(src) {
    const m = META_START.exec(src);
    if (!m) return null;
    let i = m.index + m[0].length - 1, depth = 0, quote = null;
    for (; i < src.length; i++) {
      const c = src[i], prev = src[i - 1];
      if (quote) {
        if (c === quote && prev !== "\\") quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return src.slice(m.index, i + 1);
    }
    return null;
  }

  /** Replace every string literal's CONTENTS with nothing, leaving the quotes in place. */
  const stripStringContents = (block) => {
    let out = "", quote = null;
    for (let i = 0; i < block.length; i++) {
      const c = block[i], prev = block[i - 1];
      if (quote) {
        if (c === quote && prev !== "\\") { quote = null; out += c; }
        else if (c === "`" && quote === "`") out += c;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; out += c; continue; }
      out += c;
    }
    return out;
  };

  const IMPURE = [
    [/\+/, "BinaryExpression (a `+`-joined string — write it as one literal, however long)"],
    [/\$\{/, "TemplateLiteral with an expression"],
    [/\(/, "CallExpression"],
    [/\.\.\./, "SpreadElement"],
  ];

  const metaOffenders = [], metaMissing = [];
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    const block = metaBlock(src);
    if (!block) {
      metaMissing.push(`${WORKFLOWS_DIR}/${f} — no \`export const meta = { … }\`; the runtime requires it`);
      continue;
    }
    const skeleton = stripStringContents(codeOnly(block));
    for (const [pattern, why] of IMPURE) {
      if (pattern.test(skeleton)) metaOffenders.push(`${WORKFLOWS_DIR}/${f} — ${why}`);
    }
    for (const field of ["name", "description"]) {
      if (!new RegExp(`\\b${field}\\s*:`).test(block)) {
        metaMissing.push(`${WORKFLOWS_DIR}/${f} — meta.${field} is required`);
      }
    }
  }

  if (metaOffenders.length === 0 && metaMissing.length === 0) {
    ok(`every workflow script's \`meta\` is a pure literal carrying name + description (${files.length} file(s)) — the runtime can parse it and launch the file`);
  } else {
    if (metaOffenders.length > 0) {
      fail("a workflow script's `meta` is not a pure literal, so the Workflow runtime refuses the "
        + `WHOLE file before its body ever runs — the orchestrator cannot launch:\n    ${metaOffenders.join("\n    ")}`);
    }
    if (metaMissing.length > 0) {
      fail(`a workflow script's \`meta\` is missing a required field:\n    ${metaMissing.join("\n    ")}`);
    }
  }

  // (j) THE CANARY IS THE FIRST THING THE RUN DOES, and its failure aborts.
  //
  // `init run` refuses when the SKILL.md files are not on disk, and that check passes green on both
  // states the failure actually takes — installed-but-disabled, and a different version loaded. Only
  // a live dispatch separates them, so the orchestrator makes one before any worker is paid for, and
  // reads the hook layer's evidence rather than the sub-agent's report of what happened.
  //
  // Checked on the SOURCE because the alternative is a live run: the leg costs a real sub-agent, so
  // it cannot be a Tier-0 check. What is asserted is that the mechanism is wired — the evidence is
  // read from the kernel, and a failure returns an `aborted` rather than logging and continuing.
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    if (!/\bphase\("Preflight"\)/.test(src)) continue;   // only the orchestrator carries one
    const problems = [];
    if (!/Skill\(shapeup-sdlc-plugin:\$\{canarySkill\}\)/.test(src)) {
      problems.push("the preflight makes no Skill dispatch — a file check cannot prove the session resolves one");
    }
    if (!/verify dispatch --skill \$\{canarySkill\}/.test(src)) {
      problems.push("the preflight does not read the hook layer's evidence, so it trusts the sub-agent's own report");
    }
    if (!/--within \d+/.test(src)) {
      problems.push("the evidence query is unbounded in time — a checkout that once loaded the plugin passes forever");
    }
    if (!/if \(!canary\.ok\)[\s\S]{0,400}?return aborted\("preflight"/.test(src)) {
      problems.push("a failed canary does not abort the run — the preflight is advisory, which is the defect it exists to catch");
    }
    // The canary must dispatch with NO order: a compiled order with no result would sit in
    // `orders/`, where three readers enumerate, and a preflight that perturbs the run it clears is
    // not a preflight.
    if (/canarySkill\}\)[\s\S]{0,200}?--order/.test(src)) {
      problems.push("the canary threads an --order, leaving a compiled order with no result in the run's records");
    }
    if (!problems.length) ok(`${WORKFLOWS_DIR}/${f} opens with a live canary dispatch whose evidence is mechanical and whose failure aborts`);
    else fail(`${WORKFLOWS_DIR}/${f} preflight is not load-bearing:\n    ${problems.join("\n    ")}`);
  }

  // (l) NO pipeline() STAGE MAY RETURN A BARE `null` TO MEAN "carry on".
  //
  // The runtime reads a null stage result as DROP THIS ITEM and skips its remaining stages.
  // Measured directly rather than inferred, with a probe whose only job was to ask:
  //
  //     stage1 → null   ⇒ stage2 ran 0/3 times, settled = [NULL, NULL, NULL]
  //     stage1 → {…}    ⇒ stage2 ran 3/3 times
  //
  // The BUILD fan-out used `null` as its "this scope is not green yet, build it" signal, so every
  // scope that was not ALREADY green was dropped before the builder could run. On a fresh run that
  // is every scope: 0 green, all queued, inner breaker, `gate_h` — with no builder ever dispatched.
  // The run reads exactly like six genuinely hard scopes, which is why nothing caught it for the
  // life of the branch and why criterion 1 was never met.
  //
  // A static check earns its place here because the behavioural one cannot: proving it costs a live
  // Workflow launch and real sub-agents, which Tier-0 forbids. What it can do is refuse the SHAPE
  // whose meaning the runtime inverts.
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    if (!/\bpipeline\s*\(/.test(src)) continue;
    // Only the arrow-body form is checked, which is the one that reads as a value and is therefore
    // the one an author writes when they mean "nothing to report yet".
    const nullReturners = [...src.matchAll(/^\s*(?::|\?)?\s*null\s*[,)]/gm)].map((m) => m[0].trim());
    if (!nullReturners.length) {
      ok(`${WORKFLOWS_DIR}/${f} has no pipeline stage returning a bare null — the runtime would read one as "drop this item"`);
    } else {
      fail(`${WORKFLOWS_DIR}/${f} has a pipeline stage whose value is a bare \`null\` (${nullReturners.length} site(s)). ` +
        `The runtime DROPS an item whose stage returned null and skips its remaining stages, so a stage using null ` +
        `to mean "not ready, continue" silently prevents every later stage from running. Return a sentinel object instead.`);
    }
  }

  // (n) A PHASE WHOSE COMPLETION IS DECIDED BY EXACT FILENAMES MUST NAME THEM TO ITS WORKER.
  //
  // ORIENT's completion is `ORIENT_REQUIRED.every(present)` — three exact names plus a spike. The
  // dispatch prose said only "write the orient/ artifacts". A leg then did the work properly and
  // called its output `code-surface-map.md` and `discovered-tasks.md`; the post-condition correctly
  // refused to advance, and a run that had spiked real code and written four useful files aborted
  // over two filenames. The skill doc names them four times over; the dispatch named them zero.
  //
  // The names are READ FROM THE PREDICATE, so this cannot drift: rename a required artifact and the
  // prose must follow, which is the coupling the failure showed was missing.
  const { ORIENT_REQUIRED } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    if (!/skill: "orient"/.test(src)) continue;
    const missing = ORIENT_REQUIRED.filter((name) => !src.includes(name));
    if (!missing.length) {
      ok(`${WORKFLOWS_DIR}/${f} names all ${ORIENT_REQUIRED.length} required ORIENT artifacts in the dispatch itself`);
    } else {
      fail(`${WORKFLOWS_DIR}/${f} dispatches ORIENT without naming ${missing.join(", ")} — completion is decided by ` +
        `those exact filenames, so a leg that does the work under another name aborts the run at the post-condition`);
    }
  }

  // (o) THE MAP-SCOPES DISPATCH MUST STATE THE FIXTURE PASS RULE.
  //
  // `verify t0` passes a fixture iff it exits 0. That rule lived only in the scorer, and the
  // contract the architect reads said "commands that drive this scope end-to-end" — so it wrote the
  // scope's error paths as bare invocations (`todo done abc  # E_INVALID_INDEX, exit 1`). Those
  // cannot pass by construction: four of six scopes burned their attempt budget on code that was
  // already correct, and the run reported them as hard scopes. Same lesson as ORIENT's filenames —
  // a rule enforced in one file and unstated in the prose the worker holds is not a rule, it is a
  // trap.
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    if (!/skill: "scope-architect"/.test(src)) continue;
    // Two rules, both learned the same way — by a run losing a phase to each. A fixture that
    // cannot pass, and a fixture the parser cannot see, fail in opposite directions and are equally
    // fatal: the first makes a correct scope look hard, the second made six scopes go green having
    // run nothing at all.
    const missing = [];
    if (!/MUST EXIT 0/i.test(src)) missing.push("that every fixture must exit 0");
    if (!/FRONTMATTER key/i.test(src)) missing.push("that fixtures go in a frontmatter key, not a markdown section");
    if (!missing.length) {
      ok(`${WORKFLOWS_DIR}/${f} tells the scope architect both fixture rules — must exit 0, and where they are read from`);
    } else {
      fail(`${WORKFLOWS_DIR}/${f} dispatches scope-architect without stating ${missing.join(" and ")}. ` +
        `A fixture that cannot pass strands a correct scope; a fixture written where the parser cannot see it ` +
        `leaves the scope with nothing to verify it at all.`);
    }
  }

  // (p) THE EVALUATE DISPATCH MUST CARRY ITS ROUND, because the resume derivation reads it back.
  //
  // `compile` suffixes a non-build order with its round when given one (`evaluate-r2`), and
  // `probe resume` derives `eval_rounds_done` from `/^evaluate-r\d+\.json$/`. Writer and reader
  // agreed; only this caller omitted `--round`, so the order was always `evaluate.json` and:
  //
  //   • `eval_rounds_done` was ALWAYS [] — every relaunch restarted the round counter at 1, so a
  //     resumed run re-graded a round it had already paid for and the outer breaker could not trip.
  //   • round 2's evaluate result OVERWROTE round 1's, leaving a run with only its last envelope.
  //
  // Both silent, and invisible inside a single uninterrupted launch because `round` is a local
  // variable there — which is exactly why only a resumed run would have shown it.
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    if (!/operation: "evaluate"/.test(src)) continue;
    // Isolate the evaluate call's own object literal. A regex spanning from the file's first
    // `worker({` would swallow every earlier dispatch and find a `round` belonging to one of them —
    // which is how the first version of this guard passed against the defect it was written for.
    const call = src.split(/worker\(\{/).slice(1)
      .map((chunk) => chunk.split(/\n\s*\}\);/)[0])
      .find((body) => /operation: "evaluate"/.test(body)) || "";
    if (/\bround,|\bround:\s*round\b/.test(call)) {
      ok(`${WORKFLOWS_DIR}/${f} passes the round to its evaluate dispatch, so each round's order is addressable`);
    } else {
      fail(`${WORKFLOWS_DIR}/${f} dispatches evaluate without its round. The order is then \`evaluate.json\` for every ` +
        `round: \`eval_rounds_done\` never matches, so a relaunch restarts at round 1, and each round's result ` +
        `overwrites the last.`);
    }
  }

  // (q) THE VERDICT'S BUGS MUST REACH THE ROUND THAT HAS TO FIX THEM.
  //
  // `WorkOrderPayload.bugs` exists and says what it is for — "the EVAL report's bug entries for this
  // task — touch nothing else" — and AGENTS.md states the regression rule as "bugs + full Test
  // Surface of touched UC". The orchestrator captured the evaluator's findings into a local and used
  // them only for the optional refute wave, so a round r+1 leg was dispatched knowing nothing about
  // the verdict. It re-ran T0, found the scope still green, and reported done.
  //
  // Measured: EVAL returned FAIL citing three defects at file:line; round 2 kept all six trees and
  // changed none of them. `digested_errors` cannot cover this — it carries AEGIS triples from a RED
  // T0, and a scope whose fixtures pass while its behaviour contradicts the spec has no red trial to
  // digest. That gap is why EVAL is a separate layer, so its output needs a separate channel.
  //
  // Both halves are checked. The declaration one matters because `findings` inside the round loop is
  // in the temporal dead zone at the BUILD that reads it — a runtime error nothing but a real second
  // round reaches, which is exactly the kind a static suite certifies forever.
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    if (!/while \(round <= maxRounds\)/.test(src)) continue;
    const problems = [];
    if (!/buildScope\(scope, round, findings\)/.test(src)) {
      problems.push("the build call does not pass the verdict's findings, so a fix round is dispatched blind");
    }
    const declIdx = src.indexOf("let findings = []");
    const loopIdx = src.indexOf("while (round <= maxRounds)");
    if (declIdx === -1 || declIdx > loopIdx) {
      problems.push("`findings` is declared inside the round loop, so the BUILD that needs it reads it in the temporal dead zone");
    }
    if (!/payload\.bugs|bugs: forThisScope|\bbugs\b/.test(src)) {
      problems.push("nothing populates the order's `bugs` payload field");
    }
    if (!problems.length) {
      ok(`${WORKFLOWS_DIR}/${f} carries the verdict's bugs into the round that must fix them`);
    } else {
      fail(`${WORKFLOWS_DIR}/${f} cannot act on its own verdict:\n    ${problems.join("\n    ")}`);
    }
  }

  // (m) THE BUILD LOOP MUST CONSUME THE DEPENDENCY WAVES, not the flat scope list.
  //
  // The kernel deriving a correct order buys nothing if the orchestrator chunks around it, and that
  // is a one-token regression: `chunk(waves.flatMap(…))` back to `chunk(scopes, …)` restores the
  // exact scheduling that made criterion 1 fail, with the kernel still cheerfully computing waves
  // nobody reads.
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    if (!/\bmaxParallelScopes\b/.test(src)) continue;
    const usesWaves = /for \(const group of waves\.flatMap\(/.test(src);
    const flatChunk = /for \(const group of chunk\(scopes,/.test(src);
    if (usesWaves && !flatChunk) {
      ok(`${WORKFLOWS_DIR}/${f} builds from dependency waves, so a scope is never built beside one it consumes`);
    } else {
      fail(`${WORKFLOWS_DIR}/${f} chunks the flat scope list instead of the dependency waves. ` +
        `A scope built alongside the scopes it depends on fails for a reason nothing about it caused and burns ` +
        `its attempt budget doing so — measured: it cost criterion 1 an entire run.`);
    }
  }

  // (k) EVERY OPERATION THE SCRIPT DISPATCHES MUST BE ONE `compile` CAN RESOLVE A WORKER FOR.
  //
  // Found by executing a real run, not by reading. `worker()` builds every leg's step 1 as
  //     compile --operation <operation> --slug <slug> --payload '<json>'
  // and `compile` resolves the worker for that form from `OP_OWNER` alone. `OP_OWNER` has no
  // `execute` key, so the BUILD leg's step 1 exits 2 with "could not resolve --worker/--operation"
  // — measured. The build leg survives only because its `extra` prose contradicts step 1 with the
  // correct `--scope … --round … --attempt` form, so the failure costs a round rather than the run,
  // which is precisely why a static suite never saw it: nothing was permanently broken, and the
  // cost showed up as a wasted BUILD round that looks like a hard scope.
  //
  // This is the same defect class as the operations that could not compile a WorkOrder at all: a
  // vocabulary shared by two files where only one of them enumerates it.
  // Checked PER CALL SITE, not per file, because a dispatch may legitimately address its order
  // another way: a build order is identified by scope + round + attempt, which the slug form cannot
  // express, so that leg overrides the compile line and is exempt. What must never happen is a leg
  // taking the generic form for an operation the table cannot resolve — that exits 2 before the
  // dispatch, and the leg's only route out is prose telling it something different.
  const { OP_OWNER } = await import(join(ROOT, "kernel/compile.mjs"));
  for (const f of files) {
    const src = readFileSync(join(abs, f), "utf8");
    if (!/compile --operation \$\{operation\}/.test(src)) continue;   // no generic-leg shape here
    const calls = [...src.matchAll(/worker\(\{([\s\S]*?)\n\s*\}\)/g)].map((m) => m[1]);
    const broken = [];
    for (const body of calls) {
      const op = (body.match(/\boperation:\s*"([^"]+)"/) || [])[1];
      if (!op) continue;
      if (/\bcompile:\s*/.test(body)) continue;            // addresses its order its own way
      if (!OP_OWNER[op]) broken.push(op);
    }
    if (!broken.length) {
      ok(`${WORKFLOWS_DIR}/${f}: every leg taking the generic compile form names an operation OP_OWNER resolves (${calls.length} call site(s))`);
    } else {
      fail(`${WORKFLOWS_DIR}/${f} dispatches operation(s) compile cannot resolve a worker for: ` +
        `${[...new Set(broken)].join(", ")} — the leg's step-1 \`compile --operation <op> --slug <slug>\` exits 2 ` +
        `("could not resolve --worker/--operation"). Either add the operation to OP_OWNER or give that leg a \`compile:\` override.`);
    }
  }
}
