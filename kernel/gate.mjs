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

import { runArgs } from "./core/argv.mjs";
import { LOCAL, readRunId, insideRunTrace } from "./shapeup/paths.mjs";
import * as gates from "./shapeup/gates.mjs";

// The gate table and the evidence helpers, under the path the router and the tests import them from.
export const { GATE_IDS, VALID_BY_GATE, HAMMER_VERDICTS, censusVerdict, chartersRun, qaProblem, WORKER_ROLE, sameModel,
  modelEvidence, narrowToEvidence, resolve, appendGateLedger, priorSignOff, gateNote } = gates;

// ---- CLI -------------------------------------------------------------------

/** The typed argv contract (see `core/argv.mjs`). */
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

