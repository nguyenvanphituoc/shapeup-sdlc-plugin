#!/usr/bin/env node
// GATE ANSWER SET — cross a gate with a pre-recorded decision instead of a live human.
//
// WHY THIS EXISTS (observed, not theorized).
//
// This harness pauses at every ⏸ gate for PO sign-off by default. That is the point of it. But
// unattended it produces two distinct failures, both of which look like the harness being slow or
// broken rather than the harness being safe:
//
//   1. STALL → TIMEOUT. The run is killed at its time cap having produced nothing scoreable,
//      on a feature that takes minutes to build by hand. A run with no human at the keyboard
//      sitting at a gate does not fail — it waits, and a wait is indistinguishable from work
//      until the budget runs out.
//   2. CONSENT-BY-PROSE. The workaround was a paragraph of English in the prompt ("treat this
//      message as advance sign-off for every gate"). Some models act on it. Others read the
//      paragraph, read the gate list, and narrate the pipeline instead of running it. Consent
//      carried in prose is consent that can be re-summarized instead of acted on.
//
// The organising rule of this project is that every invariant that matters lives in the runtime,
// not in a prompt. Gate sign-off was the last big one still living in a prompt. So it becomes a
// file and a script: the orchestrator RESOLVES each gate through this tool, and the tool's stdout
// — not the model's reading of a paragraph — is what crosses the gate.
//
// WHAT THIS IS NOT. It is not "gates off". Every gate still emits its ⏸ block, still records a
// decision, and still writes that decision to the ledger with its SOURCE ("gate-answers:ci,
// authorized_by: …") instead of "PO (live)". An audited bypass and a rubber stamp differ by
// exactly that record, which is why `note` and `authorized_by` are in the schema and why
// `--resolve` refuses to invent an answer that the set does not contain.
//
// The `on_missing: "abort"` default for headless presets is the direct fix for failure (1): a
// gate with no answer in a lane with no human is a fast, attributable abort ("GATE L4 has no
// pre-recorded answer") rather than a silent wait that gets reported as a slow harness.
//
// USAGE
//   node `harness gate` --init [--preset ci|guarded|interactive] [--out <path>] [--by "<name>"]
//   node `harness gate` --resolve <gate-id> [--file <path>|--preset <name>] [--slug <slug>]
//   node `harness gate` --list [--file <path>|--preset <name>]
//   node `harness gate` --verify [--file <path>|--preset <name>] [--auto-level unattended]
//
// RESOLUTION ORDER for --resolve / --list / --verify, first hit wins:
//   1. --file <path>
//   2. --preset <name>            (built-in, below)
//   3. .shapeup/<slug>/gate-answers.json
//   4. .shapeup/gate-answers.json
//   5. shapeup/gate-answers.json   (committed, team-shared)
//
// EXIT CODES (they are the contract — the orchestrator branches on them, not on the prose):
//   0  answer resolved; JSON on stdout with { gate, decision, source, note }
//   4  gate is answered "ask" → the orchestrator must stop and put the block to the human
//   5  no answer and on_missing=abort → the run aborts here, attributably
//   2  usage / validation error

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { runArgs } from "./lib/argv.mjs";
import { gateAnswerCandidates, LOCAL } from "./lib/paths.mjs";

export const GATE_IDS = ["L0", "L1a", "L1a.5", "L1b", "L2", "L3", "QA", "H", "L4", "COACH-1"];

// Which decisions are meaningful at which gate. A set that says `L4: "proceed"` is a set whose
// author did not know what L4 asks, so it is rejected rather than coerced.
export const VALID_BY_GATE = {
  "L0": ["proceed", "ask", "abort"],
  "L1a": ["proceed", "ask", "abort"],
  "L1a.5": ["proceed", "ask", "abort"],
  "L1b": ["proceed", "ask", "abort"],
  "L2": ["proceed", "ask", "abort"],
  "L3": ["loop", "stop", "ask"],
  "QA": ["run", "skip", "ask"],
  "H": ["accept-cut-list", "ship-all", "ask"],
  "L4": ["ship", "hold", "ask"],
  "COACH-1": ["skip", "ask"],
};

// ---- built-in presets ------------------------------------------------------

const CI_NOTE = "Pre-approved for a headless lane. No human is present; the decision is recorded here so the ledger still names a source.";

export const PRESETS = {
  // Everything pre-approved. The lane a CI step runs in.
  ci: {
    version: 1,
    preset: "ci",
    authorized_by: "unattended lane (--unattended)",
    on_missing: "abort",
    escalation: { default: "assume-and-record", budget_per_scope_per_round: 2 },
    answers: {
      "L0": { decision: "proceed", note: CI_NOTE },
      "L1a": { decision: "proceed", note: CI_NOTE },
      "L1a.5": { decision: "proceed", note: CI_NOTE },
      "L1b": { decision: "proceed", note: CI_NOTE },
      "L2": { decision: "proceed", note: CI_NOTE },
      "L3": { decision: "loop", max_rounds: 3, note: "FAIL → fix round r+1, up to the run's max_rounds. The circuit breaker, not this file, ends the loop." },
      "QA": { decision: "run", note: "QA is a level-up, not a gate — it discovers, it cannot block." },
      "H": { decision: "accept-cut-list", note: "Scope-hammer's cut list is accepted as proposed; baseline comparison still runs and is still recorded." },
      "L4": { decision: "ship", note: "Ship sign-off pre-approved. THIS is the one a reviewer should look at first when auditing a headless run." },
      "COACH-1": { decision: "skip", note: "No live PO to categorize feedback; retro rules are not filed from an unattended run." },
    },
  },

  // Low-risk gates pre-approved; the two that need judgment still stop. Matches `--auto`.
  guarded: {
    version: 1,
    preset: "guarded",
    authorized_by: "auto lane (--auto)",
    on_missing: "ask",
    escalation: { default: "ask", budget_per_scope_per_round: 2 },
    answers: {
      "L0": { decision: "proceed", note: "Config gate — mechanical." },
      "L1a": { decision: "proceed", note: "Orient review — advisory read." },
      "L1a.5": { decision: "proceed", note: "Wiring review — checked by trace-lint." },
      "L1b": { decision: "ask", note: "Board review is where scope is actually decided. Not pre-approvable." },
      "L2": { decision: "proceed", note: "Board-green is verified by hook, not by opinion." },
      "L3": { decision: "loop", max_rounds: 3, note: "Loop on FAIL; the breaker ends it." },
      "QA": { decision: "run" },
      "H": { decision: "ask", note: "The cut list changes what ships." },
      "L4": { decision: "ask", note: "Ship sign-off always stops in the auto lane." },
      "COACH-1": { decision: "ask" },
    },
  },

  // The default lane. Present so `--preset interactive` is a valid, explicit choice rather than
  // an absent file, and so `--verify` can report "nothing is pre-approved" as a positive fact.
  interactive: {
    version: 1,
    preset: "interactive",
    authorized_by: "none — every gate is put to the PO live",
    on_missing: "ask",
    escalation: { default: "ask", budget_per_scope_per_round: 2 },
    answers: Object.fromEntries(GATE_IDS.map((g) => [g, { decision: "ask" }])),
  },
};

// ---- validation ------------------------------------------------------------

/** Structural + semantic validation. Returns a list of human-readable problems (empty = valid). */
export function validate(set) {
  const errs = [];
  if (!set || typeof set !== "object") return ["not an object"];
  if (set.version !== 1) errs.push(`version must be 1 (got ${JSON.stringify(set.version)})`);
  if (!["ci", "guarded", "interactive", "custom"].includes(set.preset)) {
    errs.push(`preset must be ci|guarded|interactive|custom (got ${JSON.stringify(set.preset)})`);
  }
  if (set.on_missing && !["ask", "proceed", "abort"].includes(set.on_missing)) {
    errs.push(`on_missing must be ask|proceed|abort (got ${JSON.stringify(set.on_missing)})`);
  }
  if (!set.answers || typeof set.answers !== "object") {
    errs.push("answers is required");
    return errs;
  }
  for (const [gate, a] of Object.entries(set.answers)) {
    if (!GATE_IDS.includes(gate)) { errs.push(`unknown gate id "${gate}"`); continue; }
    if (!a || typeof a !== "object" || typeof a.decision !== "string") {
      errs.push(`${gate}: answer must be an object with a "decision" string`); continue;
    }
    if (!VALID_BY_GATE[gate].includes(a.decision)) {
      errs.push(`${gate}: decision "${a.decision}" is not valid here — expected one of ${VALID_BY_GATE[gate].join("|")}`);
    }
    if (a.max_rounds !== undefined && gate !== "L3") {
      errs.push(`${gate}: max_rounds is only meaningful on L3`);
    }
  }
  return errs;
}

/**
 * Resolve one gate against a set.
 * Returns { gate, decision, source, note, status } where status ∈ ok | ask | abort.
 * Pure: the CLI turns `status` into the exit code, nothing here exits.
 */
export function resolve(set, gate, source) {
  if (!GATE_IDS.includes(gate)) {
    return { gate, status: "error", reason: `unknown gate "${gate}" — known: ${GATE_IDS.join(", ")}` };
  }
  const a = set.answers?.[gate];
  if (!a) {
    const onMissing = set.on_missing || "ask";
    if (onMissing === "abort") {
      return {
        gate, status: "abort", source,
        reason: `GATE ${gate} has no pre-recorded answer and this answer set aborts on a missing gate. ` +
                `A headless lane must not wait at a gate no one will answer — that spends the wall-clock ` +
                `budget and reports as a slow harness. Add an answer for ${gate} or run in a lane with a human.`,
      };
    }
    if (onMissing === "proceed") {
      return { gate, status: "ok", decision: "proceed", source: `${source} (on_missing:proceed)`, note: "no explicit answer; set proceeds by default" };
    }
    return { gate, status: "ask", source, reason: `GATE ${gate} has no pre-recorded answer — put the block to the PO.` };
  }
  if (a.decision === "ask") {
    return { gate, status: "ask", source, decision: "ask", note: a.note, reason: `GATE ${gate} is answered "ask" — stop and put the block to the PO.` };
  }
  if (a.decision === "abort") {
    return { gate, status: "abort", source, decision: "abort", note: a.note, reason: `GATE ${gate} is answered "abort".` };
  }
  return {
    gate, status: "ok", decision: a.decision, source, note: a.note,
    ...(a.max_rounds ? { max_rounds: a.max_rounds } : {}),
    // The ledger line the orchestrator must write. Provided here so the record is generated by
    // the tool that made the decision, not re-typed by the model that read it.
    ledger_row: `| ${gate} | ${a.decision} | ${source} | ${(a.note || "").replace(/\|/g, "\\|")} |`,
  };
}

/** Gates this lane will actually hit — used by --verify to catch a set that stalls halfway. */
export function requiredGates({ autoLevel = "unattended", tiny = false, qa = true } = {}) {
  if (tiny) return ["L0", "L4"];
  const base = ["L0", "L1a", "L1a.5", "L1b", "L2", "L3", "H", "L4"];
  if (qa) base.splice(base.indexOf("H"), 0, "QA");
  if (autoLevel === "unattended") base.push("COACH-1");
  return base;
}

// ---- file discovery --------------------------------------------------------

export function discover({ cwd = process.cwd(), file = null, preset = null, slug = null } = {}) {
  if (file) {
    const p = file.startsWith("/") ? file : join(cwd, file);
    if (!existsSync(p)) return { set: null, source: null, error: `answer set not found: ${p}` };
    try { return { set: JSON.parse(readFileSync(p, "utf8")), source: `file:${file}` }; }
    catch (e) { return { set: null, source: null, error: `answer set is not valid JSON: ${p} (${e.message})` }; }
  }
  if (preset) {
    if (!PRESETS[preset]) return { set: null, source: null, error: `unknown preset "${preset}" — known: ${Object.keys(PRESETS).join(", ")}` };
    return { set: PRESETS[preset], source: `preset:${preset}` };
  }
  const candidates = gateAnswerCandidates(cwd, slug);
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try { return { set: JSON.parse(readFileSync(p, "utf8")), source: `file:${p.replace(cwd + "/", "")}` }; }
    catch (e) { return { set: null, source: null, error: `answer set is not valid JSON: ${p} (${e.message})` }; }
  }
  return { set: null, source: null, error: `no gate answer set found (looked for --file, --preset, ${gateAnswerCandidates(cwd, slug).map((p) => p.replace(cwd + "/", "")).join(", ")})` };
}

// ---- CLI -------------------------------------------------------------------

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs gate (--init | --list | --verify | --resolve <gate-id>) [--preset <name>] " +
         "[--file <path>] [--slug <slug>] [--cwd <dir>] [--out <path>] [--by <who>] " +
         "[--auto-level <level>] [--tiny] [--no-qa]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  init: { type: "flag" },
  list: { type: "flag" },
  verify: { type: "flag" },
  resolve: { type: "str" },
  preset: { type: "str" },
  file: { type: "path" },
  slug: { type: "str" },
  out: { type: "path" },
  by: { type: "str" },
  "auto-level": { type: "str" },
  tiny: { type: "flag" },
  "no-qa": { type: "flag" },
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
 * Resolve, verify, list or initialise the gate answer set.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();

  if (args.init) {
    const presetName = args.preset ?? "ci";
    const base = PRESETS[presetName];
    if (!base) die(`unknown preset "${presetName}" — known: ${Object.keys(PRESETS).join(", ")}`);
    const set = JSON.parse(JSON.stringify(base));
    set.preset = presetName === "interactive" ? "interactive" : presetName;
    const by = args.by ?? null;
    if (by) set.authorized_by = by;
    const dest = args.out ?? `${LOCAL}/gate-answers.json`;
    const p = dest.startsWith("/") ? dest : join(cwd, dest);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(set, null, 2) + "\n", "utf8");
    out({ ok: true, wrote: dest, preset: presetName, authorized_by: set.authorized_by, gates: Object.keys(set.answers).length });
  }

  const found = discover({ cwd, file: args.file ?? null, preset: args.preset ?? null, slug: args.slug ?? null });
  if (found.error) die(found.error);
  const errs = validate(found.set);
  if (errs.length) die(`invalid gate answer set (${found.source}):\n  - ${errs.join("\n  - ")}`);

  if (args.list) {
    out({
      ok: true, source: found.source, preset: found.set.preset,
      authorized_by: found.set.authorized_by ?? null,
      on_missing: found.set.on_missing || "ask",
      escalation: found.set.escalation || { default: "ask" },
      answers: found.set.answers,
    });
  }

  if (args.verify) {
    const autoLevel = args.autoLevel ?? "unattended";
    const need = requiredGates({ autoLevel, tiny: !!args.tiny, qa: !args.noQa });
    const missing = need.filter((g) => !found.set.answers?.[g]);
    const willAsk = need.filter((g) => found.set.answers?.[g]?.decision === "ask");
    const headless = autoLevel === "unattended";
    // In a headless lane an "ask" is a stall, and a stall is the failure mode this whole file
    // exists to remove. Report it as a hard problem there and as information elsewhere.
    const ok = missing.length === 0 && (!headless || willAsk.length === 0);
    out({
      ok, source: found.source, preset: found.set.preset,
      required_gates: need, missing, will_ask: willAsk,
      ...(ok ? {} : {
        reason: headless && willAsk.length
          ? `answer set stops at ${willAsk.join(", ")} — in an unattended lane that is a stall, not a safeguard. ` +
            `Use --preset ci, or run this lane with a human.`
          : `answer set has no answer for ${missing.join(", ")}.`,
      }),
    }, ok ? 0 : 2);
  }

  const gate = args.resolve ?? null;
  if (!gate) die("nothing to do — pass --init, --list, --verify, or --resolve <gate-id>");

  const r = resolve(found.set, gate, found.source);
  if (r.status === "error") die(r.reason);
  if (r.status === "ask") out({ ...r, ok: false }, 4);
  if (r.status === "abort") out({ ...r, ok: false }, 5);
  out({ ...r, ok: true }, 0);
}

