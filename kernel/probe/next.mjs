#!/usr/bin/env node
// probe next — "what does this run do next?", answered from artifacts and nothing else.
//
// CONTRACT. A bounded, read-only query. Prints ONE step as JSON on stdout and exits 0; exits 2 on a
// bad argv, 3 when no run is open at `--slug`. It writes nothing and runs no model: every decision
// below is a predicate over files the run already left behind — the receipt, the launch record, the
// orders, results and leg rows, the gate ledger, the T0 verdicts, the round build gate, the census.
//
// WHY THIS IS A KERNEL VERB AND NOT PROSE. The run's control flow used to live in a script that could
// not be executed against a fixture, and what shipped unverified was exactly what that costs: a
// finished phase dispatched again, a relaunch that skipped an answered gate, a post-condition no one
// asked. The loop that drives a run now is a session, and a session may skip any instruction it is
// given. So the state machine stays in code: the loop calls this verb, does the one thing it names,
// and calls it again. Each "sent back once" rule is a branch of this function — a skipped sentence
// cannot skip it — and the loop advances on a kernel exit code or on this verb's JSON, never on its
// own narration of what it did.
//
// STATELESS BY CONSTRUCTION. Nothing is remembered between calls: "dispatched once already" is the
// count of dispatch receipts against the order, "a gate was crossed" is a row in the gate ledger,
// "this round is over" is a verdict row, "a breaker tripped" is re-derived from the round's own
// records every time. That is what makes a killed session resume into the same step, and what makes
// resume and completion one predicate rather than two that can disagree.
//
// THE STEP SHAPE. Every step carries `step` (a stable name), `kind` and `reason`. Kinds:
//   dispatch  run `compile`, invoke the worker skill on the order, run `ingest`, then `then`.
//   plan      one planning substep, done in the loop's own context: run `open` (it stamps the fence)
//             unless `order_open`, write only what `produces` names, run each of `checks`, run
//             `close` (it answers the fence from the files). `resource`/`section` say where the craft is.
//   stop      the census, done in the loop's own context: run the `probes`, write the census file named by
//             `produces`, run `close`. Satisfied by a readable, valid census on disk — nothing else.
//   command   run one kernel command; `on_fail_close` (when present) is what to run if it fails.
//   gate      show `block`, run `command`; exit 4 = ask the PO and rerun `answer_command`; exit 5 =
//             run `abort_close`. `pre` commands run first, each with its own `on_fail_close`.
//   build     dispatch every scope in `release` at once; `in_flight` and `waiting` say why not more.
//   wait      nothing is releasable until an in-flight scope returns.
//   need      the run cannot go on until something outside the kernel exists (named in `need`).
//   terminal  the run is over: run `close_command` and report `status`. A shipped one carries `retro`: the
//             resource and the COACH-1 gate command the retro crosses.
//   done      the run already ended and there is nothing to resume.
// Every step may carry `pre` (commands to run first) and `warnings` (strings to surface).
//
// USAGE
//   node harness probe next --slug <slug> [--cwd <dir>] [--restart]
//
// `--restart` says "this is a fresh session": an order left unanswered by the session that died is
// dead work, not work in flight, and its scope is released again instead of waited for.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runArgs, isMain } from "../lib/argv.mjs";
import {
  ordersDir, resultsDir, legLedger, dispatchReceipts, readRunId, gates as gatesPath,
  runArgsPath, receipt as receiptPath, relLocal, report as reportPath, orientDir, gateAnswerCandidates, harnessRun,
} from "../lib/paths.mjs";
import { launchProblems } from "../lib/floor.mjs";
import { planOrderFacts, planProduces, planGuidancePaths } from "../lib/plan.mjs";
import { scheduleFor, releasable } from "../lib/schedule.mjs";
import { deriveResumeFacts, parseFrontmatter } from "./resume.mjs";
import { readLegs, legState } from "./leg.mjs";
import { readReceipts, scopeAttempts } from "./attempts.mjs";
import { greenVerdict } from "./t0.mjs";
import { validate } from "../verify/envelope.mjs";
import { evalVerdict } from "./eval.mjs";
import { huntOutcome } from "./hunt.mjs";
import { boardCoversProblem } from "./requirements.mjs";
import { lint as specLint } from "../verify/spec.mjs";
import { latestRoundBuild, declaredSteps } from "../verify/build.mjs";
import { evaluateBudget, findRun } from "../verify/budget.mjs";
import { censusVerdict } from "../gate.mjs";
import { readCensus, censusRefusalRows } from "../lib/census.mjs";

const KERNEL = resolve(dirname(fileURLToPath(import.meta.url)), "../harness.mjs");
const RESULT_SCHEMA = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../schemas/work-result.schema.json"), "utf8"));
const SKILL_NS = "shapeup-sdlc-plugin";

/** What each gate is called in the block the PO reads. L4 prints its own id. */
const GATE_TITLES = {
  L1a: "Orient Review", "L1a.5": "Wiring Review", L1b: "Board Review", L2: "Build Round Complete",
  L3: "Verdict & Loop", QA: "QA Edge Hunt", H: "Decide When to Stop", L4: "Ship Sign-Off",
};

/** The valid decisions at each gate this verb crosses — mirrors `gate.mjs`'s VALID_BY_GATE. */
const VALID = {
  L1a: ["proceed", "ask", "abort"], "L1a.5": ["proceed", "ask", "abort"], L1b: ["proceed", "ask", "abort"],
  L2: ["proceed", "ask", "abort"], L3: ["loop", "stop", "ask"], QA: ["run", "skip", "ask"],
  H: ["accept-cut-list", "ship-all", "ask"], L4: ["ship", "hold", "ask"],
};

/** The run's status line while each activity is in progress (a ledger projection, set when it differs). */
const STATUS_FOR = { orient: "orienting", plan: "mapping", build: "building", eval: "evaluating" };

/** How many dispatches of one order a run spends before it names the phase dead. */
const DISPATCH_CAP = 3;

/**
 * A free-text cause as one close argument: no quote, backtick, dollar, backslash or newline, runs of
 * whitespace collapsed, at most 300 characters. The close text travels through a shell.
 * @param {string} s - Cause text.
 * @returns {string} A shell-safe single-line cause.
 */
export function causeArg(s) {
  return String(s ?? "").replace(/[`"'$\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * The single-quoted form of a JSON payload for a one-line shell command.
 * @param {object} payload - Payload; null and undefined members are dropped.
 * @returns {string} `'{"…"}'`.
 */
function quoted(payload) {
  const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null && v !== undefined));
  return `'${JSON.stringify(clean).replace(/'/g, `'\\''`)}'`;
}

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

/**
 * Derive the run's next step.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {object} [opts] - `restart`: treat unanswered orders as dead (a fresh session).
 * @returns {object} One step; see the banner for its shape.
 */
export function deriveNext(cwd, slug, { restart = false } = {}) {
  const K = (verbs) => `node "${KERNEL}" ${verbs}`;
  const runId = readRunId(cwd, slug);
  const warnings = [];

  // ---- the run's own records, read once -------------------------------------------------------
  const L = readJson(runArgsPath(cwd, slug));
  const rs = deriveResumeFacts(cwd, slug);
  const legs = readLegs(legLedger(cwd, slug));
  const ingested = new Set(legs.filter((r) => r.ingested_at).map((r) => String(r.order_id)));
  const receipts = readReceipts(dispatchReceipts(cwd, slug))
    .filter((r) => r?.order_id && (!runId || !r.run_id || r.run_id === runId));
  const receiptCount = (orderId) => receipts.filter((r) => String(r.order_id) === String(orderId)).length;
  const gateRows = readLegs(gatesPath(cwd, slug)).filter((r) => !runId || !r.run_id || r.run_id === runId);

  const closeCmd = (arm, cause) => K(`probe resume --slug ${slug} --close-arm ${arm} --cause "${causeArg(cause)}"`);
  const unansweredNames = () => [...new Set(receipts
    .filter((r) => {
      const stem = String(r.order_id).split("/")[1];
      return stem && existsSync(join(ordersDir(cwd, slug), `${stem}.json`)) && !existsSync(join(resultsDir(cwd, slug), `${stem}.json`));
    }).map((r) => r.order_id))];
  const withSuffix = (cause) => {
    const n = restart ? 0 : unansweredNames().length;
    return n ? `${cause} unanswered_orders=${n}` : cause;
  };

  /** A terminal abort: the run closes `aborted`, naming where and why. */
  const abort = (at, reason) => ({
    step: `abort.${at}`, kind: "terminal", status: "aborted", aborted_at: at, reason,
    close_command: closeCmd("aborted", withSuffix(`${at}: ${reason}`)), warnings,
  });
  const failClose = (at, reason) => closeCmd("aborted", withSuffix(`${at}: ${reason}`));

  // ---- 0. preconditions -----------------------------------------------------------------------
  if (!L) {
    return abort("preflight", "the run's launch record does not exist (run-args.json) — `init run` writes it in the same act as the receipt; re-open the run with `init run --force`");
  }
  const problems = launchProblems(L);
  if (problems.length) return abort("args", problems.join("; "));
  const dial = Math.max(1, Number(L.maxParallelScopes ?? 4) || 1);
  const maxRounds = L.budgets.maxRounds;
  const attemptBudget = L.budgets.attemptBudget;

  // A run that ended shipped has nothing to resume; any other close is taken back on the record.
  if (rs.closed_status) {
    if (rs.closed_status === "shipped" && existsSync(reportPath(cwd, slug))) {
      return { step: "done.shipped", kind: "done", reason: "the run closed shipped and its report is frozen — nothing to resume", warnings };
    }
    return {
      step: "reopen", kind: "command", reason: `the run closed ${rs.closed_status}; resuming it reopens it on the record, keeping the close under prior_closes`,
      command: K(`probe resume --slug ${slug} --set-status orienting`), warnings,
    };
  }

  // ---- order bookkeeping ------------------------------------------------------------------------
  const orderState = (stem) => {
    const path = join(ordersDir(cwd, slug), `${stem}.json`);
    const order = existsSync(path) ? readJson(path) : null;
    if (!order || (runId && order.run_id && order.run_id !== runId)) {
      return { exists: false, path, stem, receipts: 0, has_receipt: false, has_result: false, applied: false, order_id: null };
    }
    const n = receiptCount(order.order_id);
    return {
      exists: true, path, stem, order_id: order.order_id, receipts: n, has_receipt: n > 0,
      has_result: existsSync(join(resultsDir(cwd, slug), `${stem}.json`)),
      applied: ingested.has(String(order.order_id)),
    };
  };
  const statusPre = (phase) => (rs.status && rs.status !== STATUS_FOR[phase] && STATUS_FOR[phase]
    ? [{ command: K(`probe resume --slug ${slug} --set-status ${STATUS_FOR[phase]}`) }] : []);

  /** Where a scope's first-attempt order for a round is written: the id compile derives, lower-cased and filename-safe. */
  const buildOrderPath = (scopeId, round, attempt = 1) => join(ordersDir(cwd, slug),
    `${scopeId.toLowerCase().replace(/[^a-z0-9.-]/g, "-").replace(/^[^a-z0-9]+/, "")}-r${round}-a${attempt}.json`);

  /** The model tier a worker runs at, from the launch record: the judge at eval, the hunter at qa, the rest at exec. */
  const modelFor = (skill) => (skill === "spec-evaluator" ? L.models.eval : skill === "qa-edge-hunter" ? (L.models.qa || L.models.exec) : L.models.exec);

  /** A worker dispatch: compile, invoke, ingest. */
  const dispatch = ({ step, skill, operation, stem, payload, round, note = "", reason, phase, then = [], extraPre = [] }) => ({
    step, kind: "dispatch", reason, skill: `${SKILL_NS}:${skill}`, operation, model: modelFor(skill),
    order_path: join(ordersDir(cwd, slug), `${stem}.json`),
    compile: K(`compile --operation ${operation} --slug ${slug}${round != null ? ` --round ${round}` : ""} --payload ${quoted(payload)}`),
    ingest: K(`reduce ingest --order "${join(ordersDir(cwd, slug), `${stem}.json`)}"`),
    ...(note ? { note } : {}),
    pre: [...(phase ? statusPre(phase) : []), ...extraPre],
    then,
    on_fail_close: failClose(step.split(".")[0].toUpperCase(), `${skill} ${operation} returned no result`),
    warnings,
  });
  /** Why a result on disk would never be accepted as a WorkResult, or null when it is shaped right. */
  const resultProblem = (os) => {
    const r = readJson(join(resultsDir(cwd, slug), `${os.stem}.json`));
    if (!r) return "the result file is not readable JSON";
    const { valid, errors } = validate(r, RESULT_SCHEMA);
    return valid ? null : errors.slice(0, 4).join("; ");
  };
  /**
   * A result the single writer has not applied. A result that is not even a WorkResult is the
   * worker's slip, and it is sent back once with the reason — a worker that has never seen the
   * writer's refusal cannot correct it. A well-shaped result the writer still refuses (no receipt, a
   * verdict it will not stand behind) goes to the writer's own command, and a second refusal stops
   * the run with what was refused.
   */
  const ingestCmd = (os, at, rebuild = null) => {
    const bad = resultProblem(os);
    if (bad) {
      if (rebuild && os.receipts < 2) {
        return rebuild(` Your previous result was refused before it was applied: ${bad}. Write the WorkResult again exactly as the order's schema says ` +
          `(status is one of done | partial | escalated | failed), keep any artifacts that already stand, and return again.`);
      }
      return abort(at, `${os.stem} returned a result that is not a valid WorkResult after one send-back: ${bad}`);
    }
    return {
      step: `ingest.${os.stem}`, kind: "command", reason: `${os.stem} has a result on disk that the single writer never applied`,
      command: K(`reduce ingest --order "${os.path}"`),
      on_fail_close: failClose(at, `the single writer refused ${os.stem}'s result — it is on disk and was never applied (see the ingest output)`), warnings,
    };
  };

  // ---- gates ------------------------------------------------------------------------------------
  const crossed = (gate, round = null) => {
    let hit = null;
    for (const r of gateRows) if (r.gate === gate && r.status === "ok" && (round == null || Number(r.round) === round)) hit = r;
    return hit;
  };
  // The answer set a gate resolves through: the launch record's, else the one `init run` recorded in
  // the ledger, else an answer file where the resolver looks. With none of those, an interactive run
  // resolves through the interactive preset (nobody pre-answered anything), and an unattended run has
  // no human to ask — it stops here, attributably, instead of stalling at its first gate.
  const ledgerAnswers = (() => {
    try {
      const v = parseFrontmatter(readFileSync(harnessRun(cwd, slug), "utf8")).gate_answers;
      return typeof v === "string" && v && v !== "~" ? v : null;
    } catch { return null; }
  })();
  const answerSet = L.answers || ledgerAnswers;
  const hasAnswerFile = gateAnswerCandidates(cwd, slug).some((p) => existsSync(p));
  if (!answerSet && !hasAnswerFile && L.autoLevel === "unattended") {
    return abort("preflight", "an unattended run has no gate answer set — name one (--gate-answers ci|guarded|<path>) at launch; with nobody to ask, the first gate would stall until the budget ran out");
  }
  const answersFlag = answerSet
    ? (["ci", "guarded", "interactive"].includes(answerSet) ? ` --preset ${answerSet}` : ` --file "${answerSet}"`)
    : (hasAnswerFile ? "" : " --preset interactive");
  const gateStep = (gate, { round = null, verdict = null, ctx = {}, pre = [], abortCause = null }) => {
    const flags = `${round != null ? ` --round ${round}` : ""}${verdict ? ` --verdict ${verdict}` : ""}`;
    const base = `gate --resolve ${gate} --slug ${slug}${flags}`;
    const lines = Object.entries(ctx).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
    return {
      step: `gate.${gate}${round != null ? `.r${round}` : ""}`, kind: "gate", gate, round, valid_decisions: VALID[gate],
      reason: `GATE ${gate} has not been crossed`,
      block: [`⏸ GATE ${gate} — ${GATE_TITLES[gate] || gate}`, ...lines].join("\n"),
      command: K(`${base}${answersFlag}`),
      answer_command: K(`${base} --answer <decision>`),
      abort_close: closeCmd("aborted", withSuffix(abortCause || `${gate}: GATE ${gate} aborted`)),
      pre, warnings,
    };
  };

  // ---- 1. ORIENT --------------------------------------------------------------------------------
  const specFolder = rs.spec_folder || `shapeup/${slug}/spec/`;
  if (!rs.has_wiring_map && !rs.has_project_profile) {
    return {
      step: "need.project-profile", kind: "need", need: "project-profile",
      reason: `the shared project-profile.md is missing at ${rs.project_profile_path} — it is written at the intake gate ({schema_version:1, archetype, entry_point}); nothing below can be wired without it`,
      path: rs.project_profile_path, warnings,
    };
  }

  /**
   * One planning phase's dispatch, post-condition and envelope rules.
   * @returns {(object|null)} A step, or null when the phase stands.
   */
  const planning = ({ key, stem, have, build, at, resend = false }) => {
    const o = orderState(stem);
    if (!have) {
      if (o.has_result && !o.applied) return ingestCmd(o, at, build);
      if (o.has_result) return abort(at, `${key} produced no artifact — the worker returned and the phase's artifact is not on disk`);
      if (o.receipts >= DISPATCH_CAP) return abort(at, `${key} did not answer after ${o.receipts} dispatches`);
      return build("");
    }
    if (o.exists && o.has_receipt && !o.has_result) {
      if (resend && o.receipts < 2) {
        return build(" Your previous dispatch of this order wrote the phase's artifacts and returned NO WorkResult. " +
          "The artifacts are on disk and stand: do not redo them. Write the WorkResult the order names, then ingest it.");
      }
    }
    if (o.has_result && !o.applied) return ingestCmd(o, at, build);
    return null;
  };

  const orientNote = "Read and spike real code before any board exists. The phase is COMPLETE only when the run's " +
    "orient directory — the one this order's substrate permits — contains all four of these, named exactly: " +
    "`code-surface.md`, `discovered-seed.md`, `hill-signal.md`, and one `spike-<area>.md` (or `spike-not-needed.md` " +
    "when the risk scan came back rank 0). Any other filename leaves the phase incomplete and the run aborts, " +
    "however good the contents are.";
  const s1 = planning({
    key: "ORIENT", stem: "orient", have: rs.has_orient_artifacts, at: "ORIENT", resend: true,
    build: (note) => dispatch({
      step: "orient.dispatch", skill: "orient", operation: "orient", stem: "orient", phase: "orient",
      payload: { pitch: rs.intake_path, breadboard: rs.breadboard_path, spec_folder: specFolder, feature: slug, stack: rs.stack },
      note: orientNote + note, reason: note ? "the orient order wrote its artifacts and returned no WorkResult — sent back once" : "no orient artifacts on disk",
    }),
  });
  if (s1) return s1;

  const spikeFiles = (() => { try { return readdirSync(orientDir(cwd, slug)); } catch { return []; } })();
  const spikeArea = spikeFiles.find((f) => /^spike-.+\.md$/.test(f))?.replace(/^spike-|\.md$/g, "") ?? "~";
  if (!crossed("L1a")) {
    return gateStep("L1a", { ctx: { breadboard: rs.breadboard_source ?? "none", spiked_area: spikeArea, spike_result: "~", riskiest_unknowns: [] } });
  }

  // ---- 2. PLAN: requirements, spec + board, wire, GATE L1a.5, scopes -----------------------------
  // Planning is one activity the loop does in its own context, in four substeps. No sub-agent runs:
  // what the kernel keeps of the old dispatch is the FENCE (a `plan` order stamped with the
  // substep's write contract) and the POST-CONDITIONS (an order closed over no artifact aborts; a
  // board that covers no requirement is sent back once). Both are read off files — the order, its
  // result, the leg ledger and the artifact itself — and a plan order has no receipt to count, so
  // "sent back once" is the number of times the single writer has closed it.
  const PLAN_SECTION = { requirements: "Requirements", spec: "plan-spec.md", wire: "plan-wire.md", scopes: "plan-scopes.md" };
  const planOrder = (step) => {
    const stem = `plan-${step}`;
    const path = join(ordersDir(cwd, slug), `${stem}.json`);
    const order = existsSync(path) ? readJson(path) : null;
    if (!order || (runId && order.run_id && order.run_id !== runId)) {
      return { exists: false, path, stem, receipts: 0, has_result: false, applied: false, closes: 0, mode: null, order_id: null };
    }
    const f = planOrderFacts(cwd, slug, order);
    return { exists: true, path, stem, order_id: order.order_id, receipts: f.closes, has_result: f.result, applied: f.closed, closes: f.closes, mode: order.payload?.mode ?? null };
  };
  /** One substep as a `plan` step: open the fence, do the work in this context, check, close. */
  const planStep = ({ step, at, reason, note = "", mode = null, inputs = {}, checks = [], open = false }) => {
    const o = planOrder(step);
    const orderPath = join(ordersDir(cwd, slug), `plan-${step}.json`);
    const payload = { step, ...(mode ? { mode } : {}) };
    const guidance = planGuidancePaths().filter((g) => existsSync(join(cwd, g)));
    return {
      step: `plan.${step}`, kind: "plan", substep: step, ...(mode ? { mode } : {}), reason,
      resource: "resources/plan.md", section: PLAN_SECTION[step],
      order_path: orderPath,
      // `order_open` says the fence is already up (an earlier opening, not yet closed): do not run
      // `open` again, which would re-stamp it; write what is missing, check, and close.
      order_open: open,
      open: K(`compile --operation plan --slug ${slug} --payload ${quoted(payload)}`),
      produces: planProduces(step, slug),
      ...(Object.keys(inputs).length ? { inputs } : {}),
      guidance,
      ...(note ? { note } : {}),
      checks,
      close: K(`reduce ingest --order "${orderPath}" --close-plan`),
      pre: statusPre("plan"),
      on_fail_close: failClose(at, `plan ${step} could not open its fence or close its order`),
      warnings,
    };
  };
  /**
   * One substep's post-condition: null when it stands, else the step to take or the abort.
   * @returns {(object|null)} A step, or null when the substep is done.
   */
  const planOne = ({ step, have, at, build, warnOnMiss = false }) => {
    const o = planOrder(step);
    if (!o.exists) return have ? null : build("", false, o);
    if (!o.has_result && !o.applied) return build("", true, o);
    if (!o.applied) return ingestCmd(o, at, (note) => build(note, false, o));
    if (!have) {
      if (warnOnMiss) { warnings.push(`${at}: the plan ${step} order was closed and its artifact is not on disk — the requirements matrix will read no evidence`); return null; }
      return abort(at, `${step} produced no artifact — the order was closed and the substep's artifact is not on disk`);
    }
    return null;
  };

  const req = planOne({
    step: "requirements", have: rs.has_requirements, at: "COVERAGE", warnOnMiss: true,
    build: (note, open) => planStep({
      step: "requirements", at: "COVERAGE", open, inputs: { source: rs.intake_path },
      reason: open ? "the requirements order is open and has not been closed" : "no requirements registry on disk",
      note: "Extract the pitch's requirement clauses into the SHARED requirements registry, one atomic clause per row. " +
        "A clause carrying an R-id keeps its number as REQ-<n> and records the R-id verbatim in its source cell; ids are assigned once and never renumbered." + note,
    }),
  });
  if (req) return req;

  /** The board-covers refusal, said again to whoever re-opens the spec substep. */
  const boardRefusal = (closes) => {
    const problem = closes >= 1 ? boardCoversProblem(cwd, slug) : null;
    return problem ? ` Your previous result was refused: ${problem}. Correct that and return again.` : "";
  };
  const specBuild = (note, open, o) => {
    // A tree that is already committed is FROZEN and only the per-machine board is regenerated — unless
    // this run's own spec order is the one writing the tree (open, not yet closed), where the tree is
    // the work and the mode stays whatever the open order was stamped with.
    const mode = open ? o.mode : (rs.has_spec_tree ? "board-only" : null);
    return planStep({
      step: "spec", at: "ANALYZE", open, mode,
      inputs: { pitch: rs.intake_path, breadboard: rs.breadboard_path, lens: rs.lens, orient_dir: rs.orient_dir, spec_folder: specFolder },
      reason: note ? "the board covers no requirement — sent back once"
        : open ? "the spec order is open and has not been closed"
        : mode === "board-only" ? "a committed spec tree and no board on this machine" : "no spec tree on disk",
      note: (mode === "board-only"
        ? "The spec tree is committed and the per-machine board is not on this machine. Regenerate the board from the tree without re-deriving it."
        : "Write the spec tree and the board from the orient artifacts — do not re-scan the code.") + (note || boardRefusal(o.closes)),
      checks: [
        { command: K(`reduce board --slug ${slug} --write`), why: "derive the board's numbers; unlocks is never hand-authored" },
        { command: K(`verify spec --slug ${slug}`), why: "fix every red, then run it again" },
      ],
    });
  };
  const spec = planOne({ step: "spec", have: rs.has_spec_tree && rs.has_board, at: "ANALYZE", build: specBuild });
  if (spec) return spec;
  {
    const problem = boardCoversProblem(cwd, slug);
    if (problem) {
      const o = planOrder("spec");
      if (o.exists && o.applied && o.closes < 2) return specBuild(` Your previous result was refused: ${problem}. Correct that and return again.`, false, o);
      if (o.exists && o.applied) warnings.push(`ANALYZE plan-spec: ${problem} (after one send-back; the requirements matrix will read no evidence)`);
    }
  }

  const wiring = planOne({
    step: "wire", have: rs.has_wiring_map, at: "WIRE",
    build: (note, open) => planStep({
      step: "wire", at: "WIRE", open,
      inputs: { project_profile: rs.project_profile_path, breadboard: rs.breadboard_path, spec_folder: specFolder },
      reason: open ? "the wire order is open and has not been closed" : "no wiring map on disk",
      note: `Write the wiring map: per use case, engine → seam → entry-point call site → affordance.${note}`,
      checks: [{ command: K(`verify trace --slug ${slug} --quiet`), advisory: true, why: "the reachability oracle, advisory — there is no code to trace before the build" }],
    }),
  });
  if (wiring) return wiring;
  if (!crossed("L1a.5")) return gateStep("L1a.5", { ctx: { wiring_map: "written" } });

  const mapScopes = planOne({
    step: "scopes", have: rs.scope_files.length > 0, at: "MAP SCOPES",
    build: (note, open) => planStep({
      step: "scopes", at: "MAP SCOPES", open, inputs: { breadboard: rs.breadboard_path, spec_folder: specFolder },
      reason: open ? "the scopes order is open and has not been closed" : "no scope contracts on disk",
      note: "Write the scope contracts (substrate whitelists, verification fixtures) and report the riskiest-first sequence. " +
        "EVERY e2e_verification_fixture MUST EXIT 0 when the scope is correct — T0 scores any non-zero exit as a failure, so a " +
        "fixture written as a bare error-path invocation can never pass and its scope can never go green. Put expected non-zero " +
        "exits INSIDE a test file that itself exits 0, and name that test file as the fixture. Write `e2e_verification_fixtures` " +
        "as a FRONTMATTER key holding bare commands." + note,
      checks: [{ command: K(`verify spec --slug ${slug}`), why: "fix every red by re-slicing, never by silencing" }],
    }),
  });
  if (mapScopes) return mapScopes;

  const sched = scheduleFor(rs, dial, (m) => warnings.push(`BUILD order — ${m}`));
  if (!crossed("L1b")) {
    const lint = specLint({ cwd, slug });
    if (lint.red > 0) {
      return abort("L1b", `spec-lint reported red findings before BUILD: ${lint.findings.filter((f) => f.level === "red").slice(0, 3).map((f) => `${f.rule}${f.scope ? `(${f.scope})` : ""}: ${f.detail ?? ""}`).join(" | ")}`);
    }
    const edges = [...sched.edges.values()].reduce((a, s) => a + s.size, 0);
    if (sched.waves.length > 1 || sched.added || sched.ceiling < dial) {
      warnings.push(`BUILD order — ${sched.waves.length} dependency wave(s) · ${edges} release edge(s) · at most ${sched.ceiling} scope(s) can be open at once` +
        `${sched.ceiling < dial ? ` (the window is ${dial}; the substrate the contracts declared is what caps it, not the dial)` : ""}`);
    }
    return gateStep("L1b", {
      ctx: { scopes: sched.scopes.map((s) => s.scope_id) },
      pre: [{ command: K(`verify trace --slug ${slug} --quiet`), advisory: true }, { command: K(`reduce hill --slug ${slug}`), advisory: true }],
    });
  }

  // ---- 3. rounds: build, build gate, L2, evaluate, L3 ------------------------------------------
  const scopeIds = sched.scopes.map((s) => s.scope_id);
  const l3 = (r) => crossed("L3", r);
  let round = 1;
  let passed = null;                                   // the L3 row of the round that ended the loop well
  let outer = null;                                    // set when a breaker routes the run to GATE H
  for (; round <= maxRounds + 1; round++) {
    const row = l3(round);
    if (!row) break;
    if (row.verdict === "pass" || row.verdict === "not-evaluated") { passed = row; break; }
    if (row.decision === "stop" || round >= maxRounds) { outer = { breaker: "outer", reason: row.decision === "stop" ? "GATE L3 answered stop" : "round budget exhausted" }; break; }
  }

  /** The state of every scope in the round, from the attested channels. */
  const scopeStates = (r) => {
    const out = new Map();
    for (const s of sched.scopes) {
      const ls = legState(cwd, slug, s.scope_id, r);
      const green = greenVerdict(cwd, slug, s.scope_id, r).green && ls.orders.some((o) => o.has_result);
      const unanswered = ls.orders.filter((o) => !o.has_result && o.order_id && receiptCount(o.order_id) > 0);
      const inFlight = !green && !restart && unanswered.length > 0;
      // A scope is SETTLED when it is green or has spent its attempt budget — never merely because a worker
      // came back. A worker that returns red, or escalates, with budget left has not finished the scope: it is
      // released again at its next attempt, and a dependent waits for it. (Settling on "a result exists" built a
      // dependent over a dependency one attempt into five.)
      const att = ls.orders.length ? scopeAttempts(cwd, slug, s.scope_id, r, attemptBudget) : { spent: 0, tripped: false };
      const exhausted = !green && att.tripped;
      const settled = green || exhausted;
      out.set(s.scope_id, { green, inFlight, settled, exhausted, spent: att.spent, unapplied: ls.unapplied, orders: ls.orders });
    }
    return out;
  };
  const everGreen = (id) => greenVerdict(cwd, slug, id, null).green;
  const attempted = (id) => scopeStates(Math.max(1, round)).get(id)?.orders.length > 0 || everGreen(id);
  const proposals = () => scopeIds.filter((id) => !everGreen(id) && [...Array(Math.max(1, Math.min(round, maxRounds))).keys()].some((i) => legState(cwd, slug, id, i + 1).orders.length));
  const greenScopes = () => scopeIds.filter(everGreen);

  if (!passed && !outer) {
    const states = scopeStates(round);
    const started = [...states.values()].some((s) => s.orders.length);
    // The wall-clock breaker is read once, where a round would open — never mid-round.
    if (!started) {
      const run = findRun(cwd, slug);
      const startedAt = Date.parse(run?.receipt?.started_at || "");
      const budget = Number(run?.receipt?.config?.wall_clock_budget_s || 0) || null;
      if (!Number.isNaN(startedAt) && evaluateBudget((Date.now() - startedAt) / 1000, budget).status === "trip") {
        outer = { breaker: "deadline", reason: "the wall-clock budget is spent" };
      }
    }
    if (!outer) {
      const open = scopeIds.filter((id) => !states.get(id).settled);
      if (open.length) {
        const settled = new Set(scopeIds.filter((id) => states.get(id).settled));
        const inFlight = new Set(scopeIds.filter((id) => states.get(id).inFlight));
        const release = releasable(sched, { settled, inFlight }, dial);
        if (!release.length) {
          return { step: `build.r${round}.wait`, kind: "wait", round, in_flight: [...inFlight], reason: "every remaining scope waits on a scope still in flight", warnings };
        }
        const fixNote = round > 1
          ? "THIS MAY BE A FIX ROUND. If your compiled order carries `payload.bugs`, the evaluator returned FAIL last round and those are the defects it cited " +
            "against files you own — each with the criterion it broke and a file:line. Fix exactly those and touch nothing else. They are spec-conformance defects, " +
            "so T0 already passes and will keep passing whether or not you fix them: a green T0 is NOT evidence you are done this round, and re-running the fixtures " +
            "cannot tell you. Read the cited lines against the committed spec, change them, and keep T0 green. An entry marked `unowned` cites no file any scope owns — " +
            "fix it only if it falls inside your substrate. "
          : "";
        return {
          step: `build.r${round}`, kind: "build", round, width: dial, model: L.models.exec,
          reason: `${open.length} scope(s) not yet settled in round ${round}`,
          release: release.map((s) => {
            const spent = states.get(s.scope_id).spent;
            const first = Math.min(spent + 1, attemptBudget);
            const again = spent > 0
              ? `Attempts 1 to ${spent} of this scope are already spent in this round and it is not green: you have ${attemptBudget - spent} left. Start at attempt ${first} ` +
                `and read the trial history the compiled order carries before changing anything — a worker that returned early left the scope unfinished. `
              : "";
            return {
            scope_id: s.scope_id, path: s.path, skill: `${SKILL_NS}:task-executor`, attempt: first,
            compile: K(`compile --scope "${s.path}" --round ${round} --attempt ${first}`),
            order_path: buildOrderPath(s.scope_id, round, first),
            ingest: K(`reduce ingest --order "${buildOrderPath(s.scope_id, round, first)}"`),
            note: again + fixNote +
              `Re-compile the order for every attempt after the first, with --attempt <n>. An attempt will be REFUSED (exit 3) while the previous one is unanswered — ` +
              `dispatched with no leg row and no WorkResult — because grading a tree the previous attempt may still be writing counts an attempt nobody ran. Let it come back ` +
              `rather than opening the next one. Run the attempt ratchet for THIS scope only: up to ${attemptBudget} attempts of implement → ` +
              `\`node "${KERNEL}" verify t0 "${s.path}" --round ${round} --attempt <n>\`, each scored against the last kept trial. Stop on the first green T0, or when the ` +
              `attempt budget or the stagnation breaker trips. Write only inside this scope's substrate whitelist — the sandbox hook enforces it. Report green, attempts_used, ` +
              `which breaker (if any) tripped, and the T0 artifact path — attempts_used is what the attested channels carry, not a count of the orders you compiled.`,
            };
          }),
          in_flight: [...inFlight], waiting: open.filter((id) => !release.some((s) => s.scope_id === id) && !inFlight.has(id)),
          pre: statusPre("build"), then: [], warnings,
        };
      }
      // every scope settled
      const roundGreen = scopeIds.filter((id) => states.get(id).green);
      const roundRed = scopeIds.filter((id) => !states.get(id).green);
      if (!roundGreen.length && roundRed.length) {
        const tripped = roundRed.filter((id) => scopeAttempts(cwd, slug, id, round, attemptBudget).tripped);
        outer = { breaker: tripped.length ? "attempt_budget" : "none", stalled: "no_green", tripped_scopes: tripped };
      } else {
        // the round build gate, then L2, then the judge, then L3
        const lateIngest = roundGreen.flatMap((id) => states.get(id).unapplied.map((u) => ({ command: K(`reduce ingest --order "${u.order}"`), advisory: true })));
        const gateBody = latestRoundBuild(cwd, slug, round);
        let buildGate;
        if (gateBody) buildGate = gateBody.overall === "green" ? "green" : gateBody.overall === "red" ? "red" : "unknown";
        else if (!declaredSteps(cwd, slug).steps.length) buildGate = "undeclared";
        else {
          return {
            step: `build.r${round}.gate`, kind: "command", round,
            reason: `round ${round} is settled and its build gate has not run`,
            pre: lateIngest, command: K(`verify build --slug ${slug} --round ${round}`), ok_exits: [0, 1, 3, 4],
            then: [{ command: K(`verify trace --slug ${slug} --quiet`), advisory: true }, { command: K(`reduce hill --slug ${slug}`), advisory: true }],
            warnings,
          };
        }
        if (!crossed("L2", round)) {
          return gateStep("L2", { round, ctx: { round, green_scopes: roundGreen, hammer_proposals: roundRed, build_gate: buildGate } });
        }
        // EVAL
        let verdict;
        if (buildGate === "red") verdict = "fail";                 // a red gate outranks --no-eval and spends no judge
        else if (L.noEval) verdict = "not-evaluated";
        else {
          const o = orderState(`evaluate-r${round}`);
          const evalPayload = { dimensions: rs.eval_dimensions?.length ? rs.eval_dimensions : null, run_cmd: rs.run_cmd, round };
          const build = (note) => dispatch({
            step: `eval.r${round}`, skill: "spec-evaluator", operation: "evaluate", stem: `evaluate-r${round}`, round, phase: "eval",
            payload: evalPayload,
            note: `Evaluate the running feature against every acceptance criterion and Done-when. One feature-level pass; cite every artifact the order lists under t0_artifacts, re-hashing each yourself.${note}`,
            reason: note ? "the verdict was refused — sent back once" : `round ${round} has no verdict`,
          });
          if (o.has_result && !o.applied) return ingestCmd(o, "L3", build);
          if (!o.has_result) {
            if (o.receipts >= DISPATCH_CAP) return abort("L3", `the evaluator did not answer after ${o.receipts} dispatches`);
            return build("");
          }
          const ev = evalVerdict(cwd, slug, round);
          if (!ev.found) {
            if (ev.overall && ev.reason && o.receipts < 2) return build(` Your previous result was refused: ${ev.reason}. Correct that and return again.`);
            return abort("L3", `no verdict this round can act on — ${ev.reason || ev.status || "no result"}`);
          }
          verdict = ev.overall === "PASS" ? "pass" : "fail";
        }
        if (L.adversarialVerify && verdict === "fail") {
          warnings.push("--adversarial-verify: the refutation wave is not carried by the loop; the ledgered FAIL stands and the round goes to GATE L3 as a FAIL");
        }
        return gateStep("L3", {
          round, verdict, ctx: { round, verdict, build_gate: buildGate },
          pre: [{ command: K(`reduce graph --slug ${slug}`), advisory: true }, { command: K(`reduce hill --slug ${slug}`), advisory: true }],
        });
      }
    }
  }

  // ---- 4. QA (a PASS or a not-evaluated round only) --------------------------------------------
  const lastRound = Math.min(round, maxRounds);
  const mainPath = !outer;
  let qaState = "skipped", qaFindings = 0;
  if (mainPath) {
    const verdict = passed.verdict;
    const gateQa = crossed("QA", passed.round ?? round);
    if (!gateQa) return gateStep("QA", { round: passed.round ?? round, verdict, ctx: { round: passed.round ?? round, verdict } });
    if (!L.noQa && gateQa.decision === "run") {
      const o = orderState("hunt");
      const build = (note) => dispatch({
        step: "qa.hunt", skill: "qa-edge-hunter", operation: "hunt", stem: "hunt",
        payload: { feature: slug, spec_folder: specFolder, app_url: rs.app_url, round: passed.round ?? round },
        note: `Exploratory hunt over the shipped feature. No verdict and no score — findings only, each with a repro.${note}`,
        reason: note ? "the hunt ran no charter — sent back once" : "QA was answered run and no hunt result is on disk",
      });
      if (!o.has_result && o.receipts < DISPATCH_CAP) return build("");
      if (o.has_result) {
        if (!o.applied) {
          if (o.receipts >= 1) warnings.push(`the hunt's result was never applied: ${o.path}`);
        }
        const hv = huntOutcome(cwd, slug);
        if (!hv.ok && hv.status === "done" && hv.reason && o.receipts < 2) return build(` Your previous result was refused: ${hv.reason}. Correct that and return again.`);
        qaFindings = Number.isInteger(hv.findings) ? hv.findings : 0;
        qaState = hv.qa === "run" ? "run" : "not-hunted";
      }
    }
  }

  // ---- 5. census, GATE H, ship report, GATE L4, close --------------------------------------------
  const proposalsNow = proposals();
  const greens = greenScopes();
  const rowVerdict = (() => { for (let r = Math.min(round, maxRounds); r >= 1; r--) { const x = l3(r); if (x?.verdict) return x.verdict; } return null; })();
  const settle = outer ? { ...outer } : null;
  // THE STOP STEP IS DONE ON A FILE. The census is written by the loop itself (no sub-agent, no
  // order), so what satisfies it is the file: a valid census on disk. A census that is on disk and is
  // not one is refused — sent back once with the reason, then the run stops with it. "Once" is a count
  // of refusals the kernel recorded (`reduce ingest --close-census`), keyed by the refused file's hash,
  // never a counter this function holds: it is read-only and remembers nothing.
  const cs = readCensus(cwd, slug);
  const stopClose = K(`reduce ingest --close-census --slug ${slug}`);
  const buildStop = (note = "", why = null, pre = []) => ({
    step: "stop.census", kind: "stop",
    reason: why || (settle ? `a breaker (${settle.breaker}) routed the run to GATE H and no census exists` : "the loop ended well and no census exists"),
    resource: "resources/stop.md", section: "Census",
    inputs: { qa_findings: settle ? 0 : qaFindings, hammer_proposals: proposalsNow, green_scopes: greens, breaker: settle ? settle.breaker : null },
    probes: {
      owner: K(`probe owner --slug ${slug} --format table`),
      requirements: K(`probe requirements --slug ${slug} --format table`),
      attempts: proposalsNow.map((scope) => ({ scope, command: K(`probe attempts --slug ${slug} --scope ${scope} --round ${Math.max(1, Math.min(round, maxRounds))} --attempt-budget ${attemptBudget}`) })),
    },
    produces: {
      path: relLocal(slug, "reports", "hammer-census.json"),
      schema_version: 1,
      required: ["schema_version", "verdict", "cut_list"],
      also: ["ship_blocking", "breaker", "baseline"],
      verdicts: ["ship-now", "ship-after-fixes", "cannot-ship"],
    },
    note: "Compare against the BASELINE and never the ideal, cite a probe for every ownership, exhaustion and requirement claim, and write the census as data to `produces.path` " +
      "beside the human-readable report. GATE L4's resolver reads that file and nothing else before it lets any answer set say `ship`; " +
      "a census that lives only in your printed blocks cannot be read by a gate." + note,
    close: stopClose, pre,
    on_fail_close: failClose("H", "the census step could not close"), warnings,
  });
  const lastRefusal = () => censusRefusalRows(cwd, slug).at(-1)?.reason ?? null;
  let hv = null;
  if (cs.exists && cs.problem) {
    const rows = censusRefusalRows(cwd, slug);
    const seen = rows.some((r) => r.sha256 === cs.sha256);
    if (rows.length + (seen ? 0 : 1) >= 2) return abort("H", `the census was refused twice and is still not a valid census: ${cs.problem}`);
    return buildStop(` Your previous census was refused before it was applied: ${cs.problem}. Write it again exactly as \`produces\` says, then close.`,
      "the census on disk is not a valid census — sent back once",
      seen ? [] : [{ command: stopClose, advisory: true }]);
  }
  if (cs.exists) hv = cs.verdict;
  else hv = censusVerdict(cwd, slug);
  if (!hv) {
    const was = lastRefusal();
    return buildStop(was ? ` Your previous census was refused (${was}) and is no longer on disk; write it again.` : "");
  }
  const census = cs.census;
  const cutList = Array.isArray(census?.cut_list) ? census.cut_list : [];
  const tail = (extra = "") => withSuffix(extra);
  if (!settle && hv === "cannot-ship") return abort("H", `the census says CANNOT SHIP — ${cutList.join("; ") || "a must-have failed"}`);
  if (!crossed("H")) {
    return gateStep("H", {
      verdict: hv,
      ctx: settle
        ? { verdict: hv, cut_list: cutList, breaker: settle.breaker, green_scopes: greens, hammer_proposals: proposalsNow }
        : { verdict: hv, cut_list: cutList },
    });
  }
  const stalled = settle?.stalled ? `stalled=${settle.stalled} ` : "";
  const escalate = (extra) => ({
    step: "terminal.gate_h", kind: "terminal", status: "escalated", reason: extra.trim(),
    close_command: closeCmd("gate_h", tail(`${stalled}breaker=${settle.breaker} green_scopes=${greens.length} hammer_proposals=${proposalsNow.length}` +
      `${settle.tripped_scopes?.length ? ` tripped_scopes=${settle.tripped_scopes.length}` : ""}${extra}`)),
    warnings,
  });
  if (settle && hv === "cannot-ship") return escalate(` census=cannot-ship`);
  const shipVerdict = settle
    ? (rowVerdict === "pass" ? "PASS" : rowVerdict === "fail" ? "FAIL" : "not-evaluated")
    : (passed.verdict === "not-evaluated" ? "not-evaluated" : "PASS");
  const shipPre = {
    command: K(`reduce ship --slug ${slug} --verdict ${shipVerdict} --qa ${settle ? "skipped" : qaState}`),
    ...(settle ? { on_fail_close: closeCmd("gate_h", tail(`${stalled}breaker=${settle.breaker} green_scopes=${greens.length} hammer_proposals=${proposalsNow.length} census=${hv} ship_report=refused`)) } : { advisory: true }),
  };
  const l4 = crossed("L4");
  if (!l4) {
    return gateStep("L4", {
      verdict: shipVerdict,
      ctx: settle ? { verdict: shipVerdict, census: hv, cut_list: cutList, breaker: settle.breaker } : { verdict: shipVerdict, census: hv, cut_list: cutList },
      pre: [shipPre], abortCause: `L4: GATE L4 aborted (census ${hv}, verdict ${shipVerdict})`,
    });
  }
  if (l4.decision === "hold") {
    if (settle) return escalate(` census=${hv} l4=hold`);
    return abort("L4", `GATE L4 answered "hold" (census ${hv}, verdict ${shipVerdict})`);
  }
  const unapplied = [];
  // WHERE THE RETRO'S GATE IS CROSSED. GATE COACH-1 is resolved by the kernel, with the run's own answer
  // set, so the ledger carries a row for the decision whether or not a PO is present: exit 0 (`skip`)
  // files nothing, exit 4 (`ask`) opens the categorization conversation. Prose alone let an unattended
  // lane open that conversation with nobody to answer it and leave no row.
  const retro = { resource: "resources/retro.md", gate: K(`gate --resolve COACH-1 --slug ${slug}${answersFlag}`) };
  if (settle) {
    return {
      step: "terminal.shipped", kind: "terminal", status: "shipped", reason: "the cut list shipped after a breaker",
      close_command: closeCmd("shipped", tail(`verdict=${shipVerdict} rounds=${lastRound} qa_findings=0 qa=skipped after=gate_h breaker=${settle.breaker} census=${hv} cut_list=${cutList.length}`)),
      verdict: shipVerdict, rounds_used: lastRound, report: `shapeup/${slug}/REPORT.md`, retro, warnings, unapplied_results: unapplied,
    };
  }
  const graded = evalVerdict(cwd, slug, lastRound);
  return {
    step: "terminal.shipped", kind: "terminal", status: "shipped", reason: "the loop ended well, GATE H and GATE L4 were crossed",
    close_command: closeCmd("shipped", tail(`verdict=${shipVerdict} rounds=${lastRound} qa_findings=${qaFindings} qa=${qaState}`)),
    verdict: shipVerdict, rounds_used: lastRound, qa: qaState, qa_findings: qaFindings,
    dims_evaluated: graded?.found ? (readJson(join(resultsDir(cwd, slug), `evaluate-r${lastRound}.json`))?.verdict?.dimensions ?? []) : [],
    report: `shapeup/${slug}/REPORT.md`, retro, warnings, unapplied_results: unapplied,
  };
}

export const ARGV_SPEC = {
  usage: "harness.mjs probe next --slug <slug> [--cwd <dir>] [--restart]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
  restart: { type: "flag" },
};

/**
 * Print the run's next step.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 with the step on stdout; 3 when no run is open at the slug.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  if (!existsSync(receiptPath(cwd, args.slug))) {
    process.stderr.write(JSON.stringify({ error: "no_open_run", slug: args.slug, expected: "open the run first (init run)" }) + "\n");
    process.exit(3);
  }
  console.log(JSON.stringify(deriveNext(cwd, args.slug, { restart: Boolean(args.restart) })));
  process.exit(0);
}

if (isMain(import.meta.url)) cli(process.argv.slice(2));
