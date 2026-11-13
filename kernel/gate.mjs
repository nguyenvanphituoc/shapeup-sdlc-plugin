#!/usr/bin/env node
// THE GATE RESOLVER — records one gate's answer, narrowed to the evidence.
//
// A run is unattended: the gate agent answers each gate in the PO's place, and this tool writes
// the answer to the ledger with its SOURCE (`--by agent:gate-agent`, else `PO (live)`) and its
// reason (`--note`). It is not "gates off": every answer is still checked against the evidence a
// file on disk can supply. An answer chooses among the answers a gate allows; it never supplies
// the evidence that makes one allowed — `proceed` over an empty board and `ship` over a census
// that did not clear (or a QA hunt that never ran, or a worker below the model floor) are refused.
//
// USAGE
//   node `harness gate` --resolve <gate-id> --answer <decision> [--by <who>] [--note "<reason>"]
//                       [--slug <slug>] [--round <n>] [--verdict <pass|fail|…>]
//
// EXIT CODES
//   0  answer recorded; JSON on stdout with { gate, decision, source, note }
//   4  the answer was refused on the evidence; JSON on stdout says why (`refused`, `reason`)
//   5  the answer was `abort`
//   2  usage error
//
// Retired in the release that made every run unattended, and accepted and ignored with one line:
// `--init`, `--list`, `--verify`, `--preset`, `--file`, `--out`, `--auto-level`, `--tiny`, `--no-qa`.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runArgs } from "./lib/argv.mjs";
import { gates as gatesPath, LOCAL, resultsDir, ordersDir, qaDir, tasksDir, hammerCensus, readRunId, harnessRun, insideRunTrace, runArgsPath, dispatchReceipts } from "./lib/paths.mjs";
import { belowFloor } from "./lib/floor.mjs";
import { appendLedger } from "./core/ledger.mjs";

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

/**
 * Narrow a resolved gate answer to what the run's own evidence supports.
 *
 * THE RULE, and it is about answers rather than callers. An answer set chooses among the answers a
 * gate ALLOWS; it can never supply the evidence that makes one allowed. `ship` at L4 asserts the
 * census cleared the run, so `ship` is only on the menu when a census exists and did clear it.
 *
 * Measured on a consumer: a run whose dispatch receipts carried `orient` and `task-executor` and
 * nothing else — no census was ever written — recorded `H → accept-cut-list` and `L4 → ship`
 * from the `ci` preset, while its own ledger read `status: escalated`, `final_verdict: ~`, every
 * requirement at `no evidence`. The run script did guard this, but only after the census
 * step, so a run that returns `gate_h` from a breaker reaches L4 by a route the guard does not
 * cover. A check on one call site is not a property.
 *
 * Absence of a census disqualifies `ship` on its own: "no one looked" and "someone looked and it
 * was fine" are different facts, and only the second warrants a ship.
 *
 * @param {object} r - A resolved gate result from {@link resolve}.
 * @param {string} cwd - Project root.
 * @param {(string|null)} slug - Feature slug, when the gate is being resolved inside a run.
 * @returns {object} The result, or an `ask` carrying why `ship` was not available.
 */
export function narrowToEvidence(r, cwd, slug) {
  // GATE L2's question is "is the board done", and a preset used to answer it over a board with
  // zero tasks — 100% of nothing. Measured on a consumer: a committed spec fast-forwarded ANALYZE,
  // the per-machine board was never regenerated, L2 crossed `proceed` from the `ci` preset and the
  // frozen report printed `Board 0/0 tasks done`. Same rule as L4 below: an answer set chooses
  // among allowed answers and cannot supply the evidence that makes one allowed.
  if (r?.gate === "L2" && r?.status === "ok" && r?.decision === "proceed" && slug) {
    let tasks = 0;
    try { tasks = readdirSync(tasksDir(cwd, slug)).filter((f) => /^TASK-[\w.-]+\.md$/i.test(f)).length; } catch { tasks = 0; }
    if (tasks === 0) {
      return {
        gate: r.gate, status: "ask", source: r.source, decision: "ask", note: r.note,
        refused: "proceed", board_tasks: 0,
        reason: `GATE L2 cannot be answered "proceed": the board has no tasks, so "board 100%" is a ` +
                `hundred percent of nothing. A committed spec with no per-machine board needs the board ` +
                `regenerated (operation \`board\`) before this gate means anything. Put the block to ` +
                `the PO, or regenerate the board first.`,
      };
    }
    return r;
  }
  if (r?.gate !== "L4" || r?.status !== "ok" || r?.decision !== "ship") return r;
  const verdict = censusVerdict(cwd, slug);
  if (verdict === "ship-now" || verdict === "ship-after-fixes") {
    const qa = qaProblem(cwd, slug);
    if (!qa) {
      // The floor, applied to what ran. Opening the run checked the launch record; the receipts say
      // which model each worker actually ran on, and `ship` over a build or a verdict produced below
      // the floor is the same refusal one step later. A model that merely differs from the record is
      // carried on the result and into the row, not refused: the PO may well have meant it.
      const models = modelEvidence(cwd, slug);
      if (models.below_floor.length) {
        return {
          gate: r.gate, status: "ask", source: r.source, decision: "ask", note: r.note,
          refused: "ship", census: verdict, models,
          reason: `GATE L4 cannot be answered "ship": ${models.below_floor.join("; ")}. The floor was checked on ` +
                  `the launch record when the run opened; the dispatch receipts say what ran. Re-run the role on a ` +
                  `model at or above the floor, or put the block to the PO.`,
        };
      }
      return { ...r, models };
    }
    return {
      gate: r.gate, status: "ask", source: r.source, decision: "ask", note: r.note,
      refused: "ship", census: verdict, qa,
      reason: `GATE L4 cannot be answered "ship": ${qa}. Dispatch the hunt, or answer GATE QA \`skip\` ` +
              `(a recorded decision) and resolve L4 again. An answer chooses among the answers a gate ` +
              `allows; it cannot supply the evidence that makes one allowed.`,
    };
  }
  const why = verdict === "cannot-ship"
    ? "the census returned CANNOT SHIP"
    : "the census has not been written, so none exists";
  return {
    gate: r.gate, status: "ask", source: r.source, decision: "ask", note: r.note,
    refused: "ship", census: verdict,
    reason: `GATE L4 cannot be answered "ship": ${why}. An answer set chooses among the answers a ` +
            `gate allows; it cannot supply the evidence that makes one allowed. Put the block to the ` +
            `PO, or run the census first.`,
  };
}

/**
 * One gate's answer as a result. Returns { gate, decision, source, note, status } where status ∈ ok | abort | error.
 * Pure: the CLI turns `status` into the exit code, nothing here exits.
 */
export function resolve(gate, decision, source, note) {
  if (!GATE_IDS.includes(gate)) {
    return { gate, status: "error", reason: `unknown gate "${gate}" — known: ${GATE_IDS.join(", ")}` };
  }
  if (!VALID_BY_GATE[gate].includes(decision)) {
    return { gate, status: "error", reason: `"${decision}" is not a decision GATE ${gate} takes — valid: ${VALID_BY_GATE[gate].join(", ")}` };
  }
  if (decision === "abort") return { gate, status: "abort", source, decision, note, reason: `GATE ${gate} is answered "abort".` };
  return { gate, status: "ok", decision, source, note };
}

/**
 * Append one row to the per-slug gate-crossing ledger — `.shapeup/<slug>/gates.jsonl` ({@link
 * gatesPath}, from `lib/paths.mjs`).
 *
 * WRITER RULE, same shape as {@link appendTrial} in `verify/t0.mjs` and the dispatch-receipt hook's
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

// ---- CLI -------------------------------------------------------------------

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs gate --resolve <gate-id> --answer <decision> [--by <who>] [--note <text>] " +
         "[--slug <slug>] [--cwd <dir>] [--round <n>] [--verdict <pass|fail|…>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  resolve: { type: "str" },
  slug: { type: "str" },
  by: { type: "str" },
  note: { type: "str" },
  // The current BUILD round, when the caller has one — L2/L3 are crossed once per round, so the
  // ledger row needs it to key a `GateDecision` node uniquely per crossing. Round-independent gates
  // (L0, L1a, …) simply omit it and the row carries `round: null`.
  round: { type: "int", min: 1 },
  // The verdict the round being crossed actually reached, when there is one. An answer of `loop`
  // is given for a FAIL; recorded without the verdict, a PASS round's row read "FAIL → fix round",
  // the opposite of what happened.
  verdict: { type: "str" },
  // The decision. The source is `--by` (an agent standing in for the PO writes `agent:<name>`), else
  // `PO (live)`; the evidence narrowing still applies.
  answer: { type: "str" },
  // Retired, accepted and ignored with one line (see the header): a launch that still types one must open.
  init: { type: "flag" }, list: { type: "flag" }, verify: { type: "flag" },
  preset: { type: "str" }, file: { type: "str" }, out: { type: "str" },
  "auto-level": { type: "str" }, tiny: { type: "flag" }, "no-qa": { type: "flag" },
};

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

function out(obj, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}
function die(msg, code = 2) {
  console.error(msg);
  process.exit(code);
}

/**
 * Record one gate's answer.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Every path calls `process.exit()` with the subcommand's documented code.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();
  if (args.resolve && insideRunTrace(cwd)) {
    console.error(`✋ gate: ${cwd} is inside a run trace (${LOCAL}/); run it from the project root, or its row lands in a nested ledger.`);
    process.exit(2);
  }
  const retired = ["init", "list", "verify", "preset", "file", "out", "autoLevel", "tiny", "noQa"].filter((k) => args[k] !== undefined && args[k] !== false);
  if (retired.length) console.error(`gate: ${retired.map((k) => "--" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())).join(", ")} retired and ignored: a gate is answered with --answer, by the gate agent.`);

  const gate = args.resolve ?? null;
  if (!gate) die("nothing to do — pass --resolve <gate-id> --answer <decision>");
  if (args.answer === undefined) die(`gate ${gate} needs --answer <decision>${VALID_BY_GATE[gate] ? ` — valid: ${VALID_BY_GATE[gate].join(", ")}` : ""}`);
  const found = { source: args.by ?? "PO (live)" };


  if (gate === "L4" && args.slug) {
    const prior = priorSignOff(cwd, args.slug, readRunId(cwd, args.slug));
    if (prior) out({ ok: true, gate: "L4", status: prior.status, decision: prior.decision, source: prior.source, already_resolved_at: prior.at }, 0);
  }
  const r = narrowToEvidence(resolve(gate, args.answer, found.source, args.note ?? (args.by ? `answered by ${args.by}` : "answered live by the PO")), cwd, args.slug ?? null);
  if (r.status === "error") die(r.reason);
  // A gate with no `--slug` (e.g. `--file` used ad hoc, outside any run) has nowhere to file a
  // per-run ledger row — the same reasoning `resolveRunId` uses for "no run is active": absence is
  // the correct answer, not an error, so the write is skipped rather than guessing a location.
  if (args.slug) {
    // THE ROW CARRIES THE RUN KEY. It did not, and the export stamped the current run's key onto
    // every row it found — a prior run's sign-off became this run's in the one table that answers
    // "was this ship signed off". Driven on a two-run fixture before it was fixed.
    const verdict = args.verdict ? String(args.verdict).toLowerCase() : null;
    appendGateLedger(cwd, args.slug, {
      at: new Date().toISOString(), run_id: readRunId(cwd, args.slug),
      gate: r.gate, status: r.status, decision: r.decision ?? null,
      source: r.source ?? found.source, note: gateNote(r, verdict),
      round: args.round ?? null,
      ...(verdict ? { verdict } : {}),
      // What ran, per role, beside what was asked — the machine-readable half of the note above.
      ...(r.models ? { models: { asked: r.models.asked, ran: r.models.ran, unreported: r.models.unreported, unattested: r.models.unattested, mismatch: r.models.mismatch } } : {}),
    });
  }
  if (r.status === "ask") out({ ...r, ok: false }, 4);
  if (r.status === "abort") out({ ...r, ok: false }, 5);
  out({ ...r, ok: true }, 0);
}

