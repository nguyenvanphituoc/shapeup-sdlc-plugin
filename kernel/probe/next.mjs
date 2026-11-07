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
//   command   run one kernel command; `on_fail_close` (when present) is what to run if it fails.
//   gate      show `block`, run `command`; exit 4 = ask the PO and rerun `answer_command`; exit 5 =
//             run `abort_close`. `pre` commands run first, each with its own `on_fail_close`.
//   build     dispatch every scope in `release` at once; `in_flight` and `waiting` say why not more.
//   wait      nothing is releasable until an in-flight scope returns.
//   need      the run cannot go on until something outside the kernel exists (named in `need`).
//   terminal  the run is over: run `close_command` and report `status`.
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
  runArgsPath, receipt as receiptPath, hammerCensus, report as reportPath, orientDir, gateAnswerCandidates,
} from "../lib/paths.mjs";
import { launchProblems } from "../lib/floor.mjs";
import { scheduleFor, releasable } from "../lib/schedule.mjs";
import { deriveResumeState } from "./resume.mjs";
import { readLegs, legState } from "./leg.mjs";
import { readReceipts, scopeAttempts } from "./attempts.mjs";
import { greenVerdict } from "./t0.mjs";
import { evalVerdict } from "./eval.mjs";
import { huntOutcome } from "./hunt.mjs";
import { boardCoversProblem } from "./requirements.mjs";
import { lint as specLint } from "../verify/spec.mjs";
import { latestRoundBuild, declaredSteps } from "../verify/build.mjs";
import { evaluateBudget, findRun } from "../verify/budget.mjs";
import { censusVerdict } from "../gate.mjs";

const KERNEL = resolve(dirname(fileURLToPath(import.meta.url)), "../harness.mjs");
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
  const rs = deriveResumeState(cwd, slug);
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
    return abort("preflight", "the run's launch record does not exist (run-args.json) — open the run with the launch record before driving it");
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
  const ingestCmd = (os, at) => ({
    step: `ingest.${os.stem}`, kind: "command", reason: `${os.stem} has a result on disk that the single writer never applied`,
    command: K(`reduce ingest --order "${os.path}"`),
    on_fail_close: failClose(at, `the single writer did not run for ${os.stem} — its result is on disk and was never applied`), warnings,
  });

  // ---- gates ------------------------------------------------------------------------------------
  const crossed = (gate, round = null) => {
    let hit = null;
    for (const r of gateRows) if (r.gate === gate && r.status === "ok" && (round == null || Number(r.round) === round)) hit = r;
    return hit;
  };
  // The answer set a gate resolves through. A launch that named none and left no answer file anywhere
  // the resolver looks would exit 2 at its first gate; the interactive preset is what "nobody
  // pre-answered anything" means, so that is what such a run resolves through.
  const answersFlag = L.answers
    ? (["ci", "guarded", "interactive"].includes(L.answers) ? ` --preset ${L.answers}` : ` --file "${L.answers}"`)
    : (gateAnswerCandidates(cwd, slug).some((p) => existsSync(p)) ? "" : " --preset interactive");
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
      if (o.has_result && !o.applied) return ingestCmd(o, at);
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
    if (o.has_result && !o.applied) return ingestCmd(o, at);
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

  // ---- 2. PLAN: coverage, analyze, wire, map-scopes ---------------------------------------------
  if (!rs.has_requirements) {
    const o = orderState("coverage");
    if (o.has_result && !o.applied) return ingestCmd(o, "COVERAGE");
    if (!(o.has_result && o.applied)) {
      return dispatch({
        step: "coverage.dispatch", skill: "ba-pitch-analyzer", operation: "coverage", stem: "coverage", phase: "plan",
        payload: { requirements: rs.intake_path, feature: slug },
        note: "Extract the pitch's requirement clauses into the SHARED requirements registry, one atomic clause per row. " +
          "A clause carrying an R-id keeps its number as REQ-<n> and records the R-id verbatim in its source cell; ids are assigned once and never renumbered.",
        reason: "no requirements registry on disk",
      });
    }
    warnings.push("COVERAGE: the registry worker returned and no requirements.md is on disk — the requirements matrix will read no evidence");
  }

  /** The board-covers send-back, shared by the full analyze and the board-only regeneration. */
  const boardCheck = (stem, build) => {
    const problem = boardCoversProblem(cwd, slug);
    if (!problem) return null;
    const o = orderState(stem);
    if (o.exists && o.has_result && o.receipts < 2) return build(` Your previous result was refused: ${problem}. Correct that and return again.`);
    if (o.exists && o.has_result) warnings.push(`ANALYZE ${stem}: ${problem} (after one send-back; the requirements matrix will read no evidence)`);
    return null;
  };
  const buildAnalyze = (note = "") => dispatch({
    step: "analyze.dispatch", skill: "ba-pitch-analyzer", operation: "analyze", stem: "analyze", phase: "plan",
    payload: { pitch: rs.intake_path, breadboard: rs.breadboard_path, spec_folder: specFolder, feature: slug, lens: rs.lens, orient_dir: rs.orient_dir },
    note: `Write the spec tree and the board from the orient artifacts — do not re-scan the code.${note}`,
    reason: note ? "the board covers no requirement — sent back once" : "no spec tree on disk",
  });
  const buildBoard = (note = "") => dispatch({
    step: "analyze.board", skill: "ba-pitch-analyzer", operation: "board", stem: "board", phase: "plan",
    payload: { spec_folder: specFolder, feature: slug, lens: rs.lens },
    note: `The spec tree is committed and the per-machine board is not on this machine. Regenerate the board from the tree without re-deriving it.${note}`,
    reason: note ? "the board covers no requirement — sent back once" : "a committed spec tree and no board on this machine",
    then: [{ command: K(`reduce board --slug ${slug} --write`) }],
  });
  if (!rs.has_spec_tree) {
    const o = orderState("analyze");
    if (o.has_result && !o.applied) return ingestCmd(o, "ANALYZE");
    if (o.has_result) return abort("ANALYZE", "ANALYZE produced no artifact — the worker returned and the phase's artifact is not on disk");
    if (o.receipts >= DISPATCH_CAP) return abort("ANALYZE", `ANALYZE did not answer after ${o.receipts} dispatches`);
    return buildAnalyze("");
  }
  if (!rs.has_board) {
    const o = orderState("board");
    if (o.has_result && !o.applied) return ingestCmd(o, "ANALYZE");
    if (o.has_result) return abort("ANALYZE", "ANALYZE produced no artifact — the board is not on disk after the board-only dispatch");
    if (o.receipts >= DISPATCH_CAP) return abort("ANALYZE", `ANALYZE did not answer after ${o.receipts} dispatches`);
    return buildBoard("");
  }
  const sent = boardCheck("analyze", buildAnalyze) || boardCheck("board", buildBoard);
  if (sent) return sent;

  const wiring = planning({
    key: "WIRE", stem: "wire", have: rs.has_wiring_map, at: "WIRE", resend: true,
    build: (note) => dispatch({
      step: "wire.dispatch", skill: "solution-architect", operation: "wire", stem: "wire", phase: "plan",
      payload: { feature: slug, spec_folder: specFolder, project_profile: rs.project_profile_path, breadboard: rs.breadboard_path },
      note: `Write the wiring map: per use case, engine → seam → entry-point call site → affordance.${note}`,
      reason: note ? "the wire order wrote its artifacts and returned no WorkResult — sent back once" : "no wiring map on disk",
    }),
  });
  if (wiring) return wiring;
  if (!crossed("L1a.5")) return gateStep("L1a.5", { ctx: { wiring_map: "written" } });

  const mapScopes = planning({
    key: "MAP SCOPES", stem: "map-scopes", have: rs.scope_files.length > 0, at: "MAP SCOPES",
    build: () => dispatch({
      step: "map-scopes.dispatch", skill: "scope-architect", operation: "map-scopes", stem: "map-scopes", phase: "plan",
      payload: { feature: slug, breadboard: rs.breadboard_path },
      note: "Write the scope contracts (substrate whitelists, verification fixtures) and report the riskiest-first sequence. " +
        "EVERY e2e_verification_fixture MUST EXIT 0 when the scope is correct — T0 scores any non-zero exit as a failure, so a " +
        "fixture written as a bare error-path invocation can never pass and its scope can never go green. Put expected non-zero " +
        "exits INSIDE a test file that itself exits 0, and name that test file as the fixture. Write `e2e_verification_fixtures` " +
        "as a FRONTMATTER key holding bare commands.",
      reason: "no scope contracts on disk",
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
      const settled = green || (!inFlight && ls.orders.some((o) => o.has_result));
      out.set(s.scope_id, { green, inFlight, settled, unapplied: ls.unapplied, orders: ls.orders });
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
          release: release.map((s) => ({
            scope_id: s.scope_id, path: s.path, skill: `${SKILL_NS}:task-executor`,
            compile: K(`compile --scope "${s.path}" --round ${round} --attempt 1`),
            order_path: join(ordersDir(cwd, slug), `${s.scope_id.toLowerCase().replace(/[^a-z0-9.-]/g, "-").replace(/^[^a-z0-9]+/, "")}-r${round}-a1.json`),
            note: fixNote +
              `Re-compile the order for every attempt after the first, with --attempt <n>. An attempt will be REFUSED (exit 3) while the previous one is unanswered — ` +
              `dispatched with no leg row and no WorkResult — because grading a tree the previous attempt may still be writing counts an attempt nobody ran. Let it come back ` +
              `rather than opening the next one. Run the attempt ratchet for THIS scope only: up to ${attemptBudget} attempts of implement → ` +
              `\`node "${KERNEL}" verify t0 "${s.path}" --round ${round} --attempt <n>\`, each scored against the last kept trial. Stop on the first green T0, or when the ` +
              `attempt budget or the stagnation breaker trips. Write only inside this scope's substrate whitelist — the sandbox hook enforces it. Report green, attempts_used, ` +
              `which breaker (if any) tripped, and the T0 artifact path — attempts_used is what the attested channels carry, not a count of the orders you compiled.`,
          })),
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
          if (o.has_result && !o.applied) return ingestCmd(o, "L3");
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
  const o = orderState("hammer");
  const censusFile = hammerCensus(cwd, slug);
  const census = existsSync(censusFile) ? readJson(censusFile) : null;
  const hv = censusVerdict(cwd, slug);
  if (!hv) {
    if (o.has_result && !o.applied) return ingestCmd(o, "H");
    if (o.has_result && o.receipts >= 2) return abort("H", "scope-hammer returned and left no readable census");
    return dispatch({
      step: "stop.census", skill: "scope-hammer", operation: "hammer", stem: "hammer", phase: null,
      payload: { feature: slug, qa_findings: settle ? 0 : qaFindings, hammer_proposals: proposalsNow, breaker: settle ? settle.breaker : null },
      note: "Run the census, compare against the BASELINE and never the ideal, and produce the cut list. Write the census as data to `reports/hammer-census.json` under the run's local root — " +
        "the `reports/**` entry in your order's substrate names the directory — with schema_version 1, order_id, verdict (ship-now | ship-after-fixes | cannot-ship), cut_list, " +
        "ship_blocking, breaker, baseline — beside the human-readable report. GATE L4's resolver reads that file and nothing else before it lets any answer set say `ship`; " +
        "a census that lives only in your printed blocks cannot be read by a gate.",
      reason: settle ? `a breaker (${settle.breaker}) routed the run to GATE H and no census exists` : "the loop ended well and no census exists",
    });
  }
  const cutList = Array.isArray(census?.cut_list) ? census.cut_list : [];
  const tail = (extra = "") => withSuffix(extra);
  if (!settle && hv === "cannot-ship") return abort("H", `scope-hammer: CANNOT SHIP — ${cutList.join("; ") || "a must-have failed"}`);
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
  if (settle) {
    return {
      step: "terminal.shipped", kind: "terminal", status: "shipped", reason: "the cut list shipped after a breaker",
      close_command: closeCmd("shipped", tail(`verdict=${shipVerdict} rounds=${lastRound} qa_findings=0 qa=skipped after=gate_h breaker=${settle.breaker} census=${hv} cut_list=${cutList.length}`)),
      verdict: shipVerdict, rounds_used: lastRound, report: `shapeup/${slug}/REPORT.md`, warnings, unapplied_results: unapplied,
    };
  }
  const graded = evalVerdict(cwd, slug, lastRound);
  return {
    step: "terminal.shipped", kind: "terminal", status: "shipped", reason: "the loop ended well, GATE H and GATE L4 were crossed",
    close_command: closeCmd("shipped", tail(`verdict=${shipVerdict} rounds=${lastRound} qa_findings=${qaFindings} qa=${qaState}`)),
    verdict: shipVerdict, rounds_used: lastRound, qa: qaState, qa_findings: qaFindings,
    dims_evaluated: graded?.found ? (readJson(join(resultsDir(cwd, slug), `evaluate-r${lastRound}.json`))?.verdict?.dimensions ?? []) : [],
    report: `shapeup/${slug}/REPORT.md`, warnings, unapplied_results: unapplied,
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
