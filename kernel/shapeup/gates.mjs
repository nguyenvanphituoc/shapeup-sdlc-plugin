// gates — Shape Up's ten gates, the answers each allows, and the evidence rules that narrow an answer.
//
// This is the data and the file reads the core resolver (`../core/gate.mjs`) is handed: the gate table, the
// census, the QA record and the models on the dispatch receipts. THE GATE RESOLVER records one answer,
// narrowed to the evidence; a run is unattended and the gate agent answers each gate in the PO's place.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { appendLedger } from "../core/ledger.mjs";
import { narrow, resolveGate } from "../core/gate.mjs";
import { gates as gatesPath, resultsDir, ordersDir, qaDir, tasksDir, hammerCensus, readRunId, harnessRun, runArgsPath, dispatchReceipts } from "./paths.mjs";
import { belowFloor } from "./floor.mjs";

export const GATE_IDS = ["L0", "L1a", "L1a.5", "L1b", "L2", "L3", "QA", "H", "L4", "COACH-1"];

// Which decisions are meaningful at which gate. A set that says `L4: "proceed"` is a set whose
// author did not know what L4 asks, so it is rejected rather than coerced.
export const VALID_BY_GATE = {
  "L0": ["proceed", "abort"],
  "L1a": ["proceed", "abort"],
  "L1a.5": ["proceed", "abort"],
  "L1b": ["proceed", "abort"],
  "L2": ["proceed", "abort"],
  "L3": ["loop", "stop"],
  "QA": ["run", "skip"],
  "H": ["accept-cut-list", "ship-all"],
  "L4": ["ship", "hold"],
  "COACH-1": ["skip"],
};

/** The three verdicts the stop census may carry (`HammerCensus.verdict` in the domain registry). */
export const HAMMER_VERDICTS = ["ship-now", "ship-after-fixes", "cannot-ship"];

/**
 * The census verdict on disk for one run, or null when no census has run.
 *
 * Derived from the census file the stop step wrote rather than taken from a caller: the verdict is the
 * product of a step, and a gate that accepts it as an argument accepts whatever the caller
 * believes. `null` is a real answer here — "the census has not run" — and is the state a run that
 * routed to GATE H from a circuit breaker is in, until the stop step has written one.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {(string|null)} The verdict, or null when there is no readable census.
 */
export function censusVerdict(cwd, slug) {
  if (!slug) return null;
  // The census artifact — written by the stop step. The WorkResult fallback below is kept for a lane
  // that wrote one the old way; a WorkResult may not carry a verdict under the schema, so in practice
  // the artifact is the only source.
  try {
    const c = hammerCensus(cwd, slug);
    if (existsSync(c)) {
      const r = JSON.parse(readFileSync(c, "utf8"));
      const v = r?.verdict ?? null;
      if (HAMMER_VERDICTS.includes(v)) return v;
    }
  } catch { /* unreadable census proves nothing — fall through */ }
  try {
    const p = join(resultsDir(cwd, slug), "hammer.json");
    if (!existsSync(p)) return null;
    const r = JSON.parse(readFileSync(p, "utf8"));
    const v = r?.payload?.verdict ?? r?.verdict ?? null;
    return HAMMER_VERDICTS.includes(v) ? v : null;
  } catch { return null; }
}

/**
 * The number of charters a hunt report says it ran.
 *
 * @param {(string|null)} text - The hunt report's text.
 * @returns {(number|null)} The run count from its `charters: <run>/<approved>` line, or null.
 */
export function chartersRun(text) {
  const m = String(text ?? "").match(/^charters:\s*(\d+)/m);
  return m ? Number(m[1]) : null;
}

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

/**
 * Why a run that owes a QA hunt cannot ship, or null when it owes none or paid it.
 *
 * Derived from files, never from the census (the loop writes that itself). A hunt is owed when the
 * evaluator passed a round (or the round was not evaluated) and the run was not launched with
 * `noQa` and no QA row of this run says `skip`. It is paid when `results/hunt.json` exists and, for
 * a `done` result over an app its order could reach, the hunt report ran at least one charter. A
 * `failed` hunt says it could not hunt, which is honest and accepted. A run that never reached a
 * passing round owes nothing: a build that has not passed is not worth edge-hunting.
 *
 * The case this exists for is the one nothing else sees: QA answered `run` and the hunter never
 * dispatched, so no result exists to be wrong. An explicit `skip` answer is the recorded way out.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {(string|null)} A reason phrased for the PO, or null.
 */
export function qaProblem(cwd, slug) {
  if (!slug) return null;
  if (readJson(runArgsPath(cwd, slug))?.noQa) return null;
  const runId = readRunId(cwd, slug);
  let rows = [];
  try {
    rows = readFileSync(gatesPath(cwd, slug), "utf8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((r) => r && r.run_id === runId && r.status === "ok");
  } catch { return null; }
  const qa = rows.filter((r) => r.gate === "QA").at(-1);
  if (qa?.decision === "skip") return null;
  const owed = rows.some((r) => r.gate === "L3" && ["pass", "not-evaluated"].includes(r.verdict));
  if (!qa) return owed ? "the round passed but GATE QA was never crossed" : null;
  if (qa.decision !== "run") return null;
  const hunt = join(resultsDir(cwd, slug), "hunt.json");
  if (!existsSync(hunt)) return "GATE QA was answered run and no hunt was dispatched (no results/hunt.json)";
  const result = readJson(hunt);
  if (!result) return "the hunt result cannot be read";
  if (result.status !== "done") return null;
  const payload = readJson(join(ordersDir(cwd, slug), "hunt.json"))?.payload || {};
  if (!payload.launch_cmd && !payload.app_url) return null;
  let report = null;
  try { report = readFileSync(join(qaDir(cwd, slug), "hunt-report.md"), "utf8"); } catch { /* no report */ }
  const n = chartersRun(report);
  if (n === null) return "the hunt returned done with no hunt report carrying a `charters:` line";
  return n > 0 ? null : "the hunt returned done over an app its order could reach, having run 0 charters";
}

/** The launch-record role each worker runs under; `qa` is never held to the floor. */
export const WORKER_ROLE = { orient: "exec", "task-executor": "exec", "spec-evaluator": "eval", "qa-edge-hunter": "qa" };

/**
 * Whether a launch record's model names the model a receipt says ran.
 *
 * The record carries what the launcher typed — an alias (`sonnet`) or an id — and the receipt the id the
 * host resolved (`claude-sonnet-5-5`), so equality is too strict and the alias is looked for inside the
 * id. Nothing to compare on either side is not a mismatch: a mismatch is a claim, and it needs both names.
 *
 * @param {*} asked - The launch record's model for the role.
 * @param {*} ran - The receipt's `usage.model`.
 * @returns {boolean} True when they name the same model, or when one side is missing.
 */
export function sameModel(asked, ran) {
  const a = String(asked ?? "").trim().toLowerCase();
  const r = String(ran ?? "").trim().toLowerCase();
  if (!a || !r) return true;
  return a === r || r.includes(a) || a.includes(r);
}

/**
 * The model each role ran on, read off this run's dispatch receipts, against the launch record.
 *
 * WHY THE GATE READS THIS. The floor is checked when the run opens, on the launch record — a request.
 * The agents are defined `model: inherit`, so the model that ran is the launching session's unless the
 * dispatch passed one, and the receipts are the only record of it. Across every archived run the record
 * asked for `sonnet` and two runs that were compared against each other had run their workers on two
 * different models, which no reader of the record could see. So the ship gate reads the receipts: an
 * `exec` or `eval` worker that ran below the floor is the floor's own refusal, applied to what ran rather
 * than to what was asked; any other difference is written down, because a cost or a verdict read against
 * the wrong model is a figure about a different run.
 *
 * A receipt with no model is counted as `unreported` and claims nothing. A dispatched order with no
 * receipt at all is listed in `unattested`: advisory, written into the gate's row, never a refusal.
 * Rows of another run are ignored.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{asked: object, ran: object, unreported: number, mismatch: string[], below_floor: string[]}}
 *   `ran` maps role → model id → receipt count; `mismatch` and `below_floor` are sentences for the PO.
 */
export function modelEvidence(cwd, slug) {
  const asked = readJson(runArgsPath(cwd, slug))?.models ?? {};
  const runId = readRunId(cwd, slug);
  let rows = [];
  try {
    rows = readFileSync(dispatchReceipts(cwd, slug), "utf8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((r) => r && (!runId || r.run_id === runId));
  } catch { rows = []; }
  const ran = { exec: {}, eval: {}, qa: {} };
  let unreported = 0;
  // Orders the loop dispatched to a worker (mode orchestrated) that no receipt of this run names. A
  // missing receipt is the one failure a count over the receipts cannot see: with none at all the
  // evidence reads as empty rather than as absent.
  const attested = new Set(rows.map((r) => r.order_id));
  const unattested = [];
  try {
    for (const f of readdirSync(ordersDir(cwd, slug)).filter((x) => x.endsWith(".json")).sort()) {
      const o = readJson(join(ordersDir(cwd, slug), f));
      if (o?.mode === "orchestrated" && WORKER_ROLE[o.worker] && o.order_id && (!runId || o.run_id === runId)
        && !attested.has(o.order_id)) unattested.push(o.order_id);
    }
  } catch { /* no orders directory: nothing was dispatched */ }
  for (const r of rows) {
    const role = WORKER_ROLE[r.skill_invoked] ?? null;
    if (!role) continue;
    const m = typeof r.usage?.model === "string" && r.usage.model ? r.usage.model : null;
    if (!m) { unreported++; continue; }
    ran[role][m] = (ran[role][m] ?? 0) + 1;
  }
  const n = (k) => `${k} receipt${k === 1 ? "" : "s"}`;
  const mismatch = [], below = [];
  for (const role of ["exec", "eval", "qa"]) {
    for (const [m, k] of Object.entries(ran[role])) {
      if (!sameModel(asked[role], m)) mismatch.push(`${role}: the launch record asked for ${asked[role] ?? "no model"}, ${n(k)} name${k === 1 ? "s" : ""} ${m}`);
      if (role !== "qa" && belowFloor(m)) below.push(`${role} ran on ${m} in ${n(k)}, below the model floor (sonnet or above)`);
    }
  }
  return { asked, ran, unreported, unattested, mismatch, below_floor: below };
}


// ---- the evidence rules ------------------------------------------------------------------------
// Each is `(result, {cwd, slug}) => (refusal|result|undefined)`, in the order they apply.

const ask = (r, extra) => ({ gate: r.gate, status: "ask", source: r.source, decision: "ask", note: r.note, ...extra });

/**
 * Round Close will not proceed over a board with no tasks.
 *
 * The question is "is the board done", and a preset used to answer it over a board with zero tasks —
 * 100% of nothing. Measured on a consumer: a committed spec fast-forwarded ANALYZE, the per-machine board
 * was never regenerated, the gate crossed `proceed` and the frozen report printed `Board 0/0 tasks done`.
 */
export function emptyBoard(r, { cwd, slug }) {
  if (r?.gate !== "L2" || r?.status !== "ok" || r?.decision !== "proceed" || !slug) return undefined;
  let tasks = 0;
  try { tasks = readdirSync(tasksDir(cwd, slug)).filter((f) => /^TASK-[\w.-]+\.md$/i.test(f)).length; } catch { tasks = 0; }
  if (tasks > 0) return r;
  return ask(r, {
    refused: "proceed", board_tasks: 0,
    reason: `GATE L2 cannot be answered "proceed": the board has no tasks, so "board 100%" is a ` +
            `hundred percent of nothing. A committed spec with no per-machine board needs the board ` +
            `regenerated (operation \`board\`) before this gate means anything. Put the block to ` +
            `the PO, or regenerate the board first.`,
  });
}

const shipping = (r) => r?.gate === "L4" && r?.status === "ok" && r?.decision === "ship";

/**
 * Ship Sign-off needs a census that cleared the run. Absence disqualifies `ship` on its own: "no one
 * looked" and "someone looked and it was fine" are different facts, and only the second warrants a ship.
 */
export function censusRule(r, { cwd, slug }) {
  if (!shipping(r)) return undefined;
  const verdict = censusVerdict(cwd, slug);
  if (verdict === "ship-now" || verdict === "ship-after-fixes") return undefined;
  const why = verdict === "cannot-ship" ? "the census returned CANNOT SHIP" : "the census has not been written, so none exists";
  return ask(r, {
    refused: "ship", census: verdict,
    reason: `GATE L4 cannot be answered "ship": ${why}. An answer set chooses among the answers a ` +
            `gate allows; it cannot supply the evidence that makes one allowed. Put the block to the ` +
            `PO, or run the census first.`,
  });
}

/** Ship Sign-off refuses a `ship` over a QA hunt the run owed and never paid. */
export function qaRule(r, { cwd, slug }) {
  if (!shipping(r)) return undefined;
  const qa = qaProblem(cwd, slug);
  if (!qa) return undefined;
  return ask(r, {
    refused: "ship", census: censusVerdict(cwd, slug), qa,
    reason: `GATE L4 cannot be answered "ship": ${qa}. Dispatch the hunt, or answer GATE QA \`skip\` ` +
            `(a recorded decision) and resolve L4 again. An answer chooses among the answers a gate ` +
            `allows; it cannot supply the evidence that makes one allowed.`,
  });
}

/**
 * The floor, applied to what ran. Opening the run checked the launch record; the receipts say which
 * model each worker actually ran on, and `ship` over a build or a verdict produced below the floor is
 * the same refusal one step later. A model that merely differs from the record is carried on the result
 * and into the row, not refused: the PO may well have meant it. This is the last rule a `ship` reaches,
 * so an answer it lets through is returned with the model evidence attached.
 */
export function modelRule(r, { cwd, slug }) {
  if (!shipping(r)) return undefined;
  const models = modelEvidence(cwd, slug);
  if (models.below_floor.length) {
    return ask(r, {
      refused: "ship", census: censusVerdict(cwd, slug), models,
      reason: `GATE L4 cannot be answered "ship": ${models.below_floor.join("; ")}. The floor was checked on ` +
              `the launch record when the run opened; the dispatch receipts say what ran. Re-run the role on a ` +
              `model at or above the floor, or put the block to the PO.`,
    });
  }
  return { ...r, models };
}

export const RULES = [emptyBoard, censusRule, qaRule, modelRule];

/** Narrow a resolved gate answer to what the run's own evidence supports. */
export const narrowToEvidence = (r, cwd, slug) => narrow(r, RULES, { cwd, slug });

/** One gate's answer as a result, checked against the ten gates. */
export const resolve = (gate, decision, source, note) => resolveGate({ ids: GATE_IDS, valid: VALID_BY_GATE }, gate, decision, source, note);

/**
 * Append one row to the per-slug gate-crossing ledger — `.shapeup/<slug>/gates.jsonl` ({@link
 * gatesPath}, from `lib/paths.mjs`).
 *
 * WRITER RULE, same shape as `appendTrial` in `verify/t0.mjs` and the dispatch-receipt hook's
 * ownership of `decisions.jsonl`: one small file, one writer, append-only JSONL so concurrent
 * scopes crossing gates in the same round cannot clobber each other's row.
 *
 * Records every resolution that reached a real status — a crossing (`ok`), a recorded pause
 * (`ask`), or an abort (`abort`) — because "the run stopped here" is exactly the kind of fact this
 * ledger exists to hold. Best-effort: a ledger write that could fail a gate crossing would cost more
 * than the row is worth, matching {@link appendTrial}'s own trade-off.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {object} row - The ledger row (gate, decision, source, note, round, status).
 * @returns {boolean} True when the row was written.
 */
export function appendGateLedger(cwd, slug, row) {
  try { return appendLedger(gatesPath(cwd, slug), row); } catch { return false; }
}

/**
 * This run's earlier ship sign-off, if it already has one.
 *
 * A launched run crosses L4 itself and then closes, and the orchestrator's own closing step resolved
 * it again afterwards — a second `ship` row, after the close, for a decision already taken. Once the
 * run is closed, its decided L4 row is returned instead of resolving again. An open run still
 * re-resolves (the census it reads may have changed), a reopened run has no close, and a paused or
 * aborted row is not a sign-off.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string|null} runId - The run the resolve belongs to.
 * @returns {(object|null)} The earlier L4 row, or null.
 */
export function priorSignOff(cwd, slug, runId) {
  if (!runId) return null;
  let ledger = "";
  try { ledger = readFileSync(harnessRun(cwd, slug), "utf8"); } catch { return null; }
  if (!/^closed_status:[ \t]*[^\s~]/m.test(ledger)) return null;
  let text = "";
  try { text = readFileSync(gatesPath(cwd, slug), "utf8"); } catch { return null; }
  for (const line of text.split("\n")) {
    let row; try { row = JSON.parse(line); } catch { continue; }
    if (row?.gate === "L4" && row.run_id === runId && row.status === "ok") return row;
  }
  return null;
}


/**
 * The note a gate row carries — the answer's own, unless the verdict it was crossed over makes that
 * note false.
 *
 * L3's answers are written for a verdict that has not happened yet: `loop` means "on a FAIL, run
 * the next round". Crossed over a PASS, nothing loops, and the preset's "FAIL → fix round" note
 * would put a failed round on the record for a round that passed.
 *
 * @param {{gate:string, decision?:string, note?:string, reason?:string}} r - The resolved answer.
 * @param {(string|null)} verdict - The round's verdict, lower-cased, or null when none was given.
 * @returns {(string|null)} The note to record.
 */
export function gateNote(r, verdict) {
  const own = r.note ?? r.reason ?? null;
  if (r.gate === "L3" && verdict === "pass") {
    return `verdict PASS — the "${r.decision}" answer applies only to a failed round; the run goes on to QA and GATE H`;
  }
  // A ship over workers that ran on a model other than the launch record's says so in the row itself,
  // where whoever reads the ledger for a cost or a verdict will see it.
  const notes = [];
  if (r.gate === "L4" && r.decision === "ship" && r.models?.mismatch?.length) {
    notes.push(`model differs from the launch record: ${r.models.mismatch.join("; ")}`);
  }
  if (r.gate === "L4" && r.decision === "ship" && r.models?.unattested?.length) {
    notes.push(`no dispatch receipt for ${r.models.unattested.length} dispatched order(s): ${r.models.unattested.join(", ")} — ` +
      `the shipped worker is unattested and the model that ran is unknown`);
  }
  return notes.length ? `${own ?? ""}${own ? " — " : ""}${notes.join(" — ")}` : own;
}

