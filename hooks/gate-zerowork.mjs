#!/usr/bin/env node
// GATE Z — ZERO-WORK. Blocking Stop hook. The detector for "the harness described itself".
//
// WHY THIS EXISTS (measured, not theorized).
//
// SDD harness benchmark, F2, Haiku 4.5, n=5, zero variance. The orchestrator was dispatched
// with a valid spec and returned this, in full:
//
//     TOOL   Skill(tech-lead, "--unattended --rounds 3\n\n# F2 — category budgets…")
//     TEXT   "The tech-lead skill is orchestrating the full Shape Up harness. It will: 1. …"
//     FINAL  (same text — session ends)
//
// No code. No board. No gate artifacts. Prose that reads exactly like a successful run.
// That is the "agent claims done" pathology this project exists to prevent, reproduced by the
// project, at its own front door.
//
// THE TWO STRUCTURAL MISSES IT EXPOSED. `anti-rationalization.mjs` is the guard for exactly
// this class of failure, and it could not see this one for two independent reasons:
//
//   1. SCOPE. It defers unless a run is active (`activeSlug()` → `.shapeup/<slug>/`).
//      A run that never started produces none of the files it reads. It catches "claimed done
//      on a half-green board" and misses "claimed done with no board at all". The emptier the
//      failure, the less of it there is to detect.
//   2. CLAIM SHAPE. Its detector matches PAST-tense completion — done, finished, shipped, all
//      tests pass. Narration is FUTURE-tense: "it will". Fix the scope and this transcript
//      still slips through, because narration never claims completion. It promises it.
//
// So this hook does not look at what the message says. It looks at whether anything happened.
// The predicate is mechanical and model-independent:
//
//     the session dispatched the orchestrator   AND   the run left no receipt
//
// `init-run.mjs` writes that receipt as the orchestrator's first tool call. Its absence is the
// fact. Nothing here parses intent, so nothing here can be talked past.
//
// WHY THIS ONE BLOCKS, WHEN anti-rationalization DOES NOT. The invariant is "QA is a level-up,
// not a gate" — no second judge behind `spec-evaluator`. That governs quality JUDGMENTS. This
// hook makes no judgment: it reports that no work exists to judge. Blocking is also uniquely
// safe here, because a session with no artifacts has nothing to lose by continuing, and a
// blocking Stop is the only mechanism that turns narration back into execution — an advisory
// note at the end of a narrated run just gets narrated too.
//
// Loop safety: `stop_hook_active` defers unconditionally, so this fires at most once per stop
// chain. Everything ambiguous fails open — a hook that blocks legitimate sessions gets disabled,
// and a disabled hook enforces nothing.
//
// Contract: Stop stdin JSON { cwd, stop_hook_active, last_assistant_message, transcript_path }.
// Blocks via { decision: "block", reason }. Always exits 0.

// SECOND CONDITION (v1.5). Since `hooks/lib/decision.mjs` gives every hook a receipt, this gate
// gains a second, independent fact it can assert at `Stop`: the orchestrator was dispatched, and
// `decisions.jsonl` holds ZERO rows for this pid — meaning the enforcement layer itself never ran.
// That is F-16's class, not its instance: under a symlinked install every gate was inert while
// every gate reported success. The detector for "the gates didn't run" now stops depending on the
// gates running.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";
import { localDir, globLocal } from "../skills/tech-lead/scripts/lib/paths.mjs";
import { runHook, readStdin, settle, decisionsPath } from "./lib/decision.mjs";

const MAX_TRANSCRIPT_BYTES = 20 * 1024 * 1024;

/**
 * Tool names that constitute doing something to the project, as opposed to looking at it.
 *
 * The census these produce is now DESCRIPTIVE ONLY — it sharpens the block message and nothing
 * decides on it. Until v1.7.1 a count above two was a fail-open ("the session did work by other
 * means"), and HD-008 is the measurement that retired it: see the `work-done` note at the decision
 * site below. `Workflow` stays absent because a launch is not work — it is the work this hook is
 * asking about — and it is a DISPATCH signal instead (`dispatchedOrchestrator`).
 */
const WORK_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash", "Task", "Agent"]);

/**
 * Is this block a launch of the orchestrator's own workflow script, by either surface?
 *
 * TWO SURFACES, ONE INVARIANT. `Workflow({scriptPath})` is the tool form. Since HD-007 the shipped
 * front door is a Bash call — `node "…/scripts/run-workflow.mjs" "…/workflows/shapeup-run.js"` —
 * because the tool form cannot be granted and is denied in every headless session. A gate that
 * knew only the tool form would go blind on the lane users actually run, which is the same
 * "the emptier the failure, the less of it there is to detect" hole the banner above describes.
 *
 * Matched on the BASENAME, anchored. `CLAUDE_PLUGIN_ROOT` itself ends in `shapeup-sdlc-plugin/` on
 * a normal install — so a substring match on the whole path would count EVERY workflow script that
 * happens to live under the plugin root, including one a user wrote for something else. The
 * basename is the part the skill controls and the part `SKILL.md` names.
 *
 * @param {object} block - A `tool_use` content block.
 * @returns {boolean} True when the block launches a `shapeup-*` workflow.
 */
function launchedShapeupWorkflow(block) {
  if (block.name === "Bash") {
    const cmd = String(block.input?.command ?? "");
    // Both halves required: the launcher AND an orchestrator script. `run-workflow.mjs` carrying
    // somebody else's workflow is not a harness dispatch, and neither is a bare mention of the
    // script in an unrelated command (`ls`, `cat`).
    return /\brun-workflow\.mjs\b/.test(cmd) && /[\\/]shapeup-[\w.-]*\.[cm]?js\b/.test(cmd);
  }
  if (block.name !== "Workflow") return false;
  const scriptPath = String(block.input?.scriptPath ?? "");
  const base = scriptPath.split(/[\\/]/).pop().replace(/\.[cm]?js$/, "");
  const named = String(block.input?.name ?? "");
  return /^shapeup-/.test(base) || /^shapeup-/.test(named);
}

/**
 * Did this session dispatch the orchestrator? Three surface spellings, all equivalent:
 * `Skill(tech-lead)`, a leading `/ship` slash command, and — since the workflow cutover (v1.7) —
 * a `Workflow` tool_use launching one of the orchestrator's own `shapeup-*` scripts.
 *
 * The third arm is a correctness repair, not a new detector. `SKILL.md`'s Step 2 makes the
 * Workflow launch the scoped lane's front door, so a session can now reach the orchestrator
 * without ever emitting `Skill(tech-lead)` — and before this arm existed such a session was
 * invisible to the gate, exactly the "the emptier the failure, the less of it there is to detect"
 * hole the banner above describes. It is a TRIGGER, never an escape: a launch that left no
 * receipt is still a blocked stop, because a `Workflow` call that returned without starting a run
 * is precisely the narration case wearing a tool call.
 */
export function dispatchedOrchestrator(events) {
  for (const ev of events) {
    for (const block of toolUses(ev)) {
      if (launchedShapeupWorkflow(block)) return true;
      if (block.name !== "Skill") continue;
      const skill = String(block.input?.skill ?? block.input?.skill_name ?? "");
      if (skill.split(":").pop() === "tech-lead") return true;
    }
    // The slash command is the other front door: `/shapeup-sdlc-plugin:ship …` arrives as user
    // text, and reaches tech-lead through commands/ship.md.
    //
    // ANCHORED TO THE START OF THE MESSAGE, deliberately. A slash command IS the message — the CLI
    // only dispatches one when it leads. Matching `/ship` anywhere in the text meant "how does
    // /ship decide the lane?" counted as a dispatch, and in a repo with no run that answer is a
    // Stop block: the session refuses to end and the model is told to bootstrap a feature nobody
    // asked for. A gate that fires on a session merely TALKING about the harness is a gate users
    // turn off, and it takes the real zero-work block down with it.
    if (ev?.type === "user") {
      const c = ev?.message?.content ?? ev?.content;
      const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => b?.text || "").join("\n") : "";
      if (/^\s*\/(?:[\w-]+:)?ship\b/.test(text)) return true;
    }
  }
  return false;
}

function toolUses(ev) {
  const c = ev?.message?.content ?? ev?.content;
  return Array.isArray(c) ? c.filter((b) => b?.type === "tool_use") : [];
}

/** How much actual work the session did, by tool class. */
export function workCensus(events) {
  const census = { tool_calls: 0, work_calls: 0, writes: 0, by_tool: {} };
  for (const ev of events) {
    for (const block of toolUses(ev)) {
      census.tool_calls++;
      census.by_tool[block.name] = (census.by_tool[block.name] || 0) + 1;
      if (WORK_TOOLS.has(block.name)) census.work_calls++;
      if (block.name === "Write" || block.name === "Edit" || block.name === "MultiEdit") census.writes++;
    }
  }
  return census;
}

/** Any run receipt on disk, from any run. Written by init-run.mjs as the run's first act. */
export function findReceipts(cwd) {
  const root = localDir(cwd);
  if (!existsSync(root)) return [];
  const out = [];
  let entries;
  try { entries = readdirSync(root); } catch { return []; }
  for (const entry of entries) {
    const p = join(root, entry, "receipt.json");
    if (!existsSync(p)) continue;
    try {
      const r = JSON.parse(readFileSync(p, "utf8"));
      if (r?.started) out.push({ slug: entry, receipt: r, mtime: statSync(p).mtimeMs });
    } catch { /* unreadable receipt is not a receipt */ }
  }
  return out;
}

/**
 * Future-tense narration: the signature of describing a pipeline instead of running it.
 * Advisory only — it sharpens the message, it never decides the block. The block is decided
 * by the absence of a receipt, which no phrasing can change.
 */
export function detectNarration(text) {
  if (!text || typeof text !== "string") return null;
  const m = /\b(will (?:now )?(?:run|orchestrate|execute|proceed|begin|start)|is orchestrating|I'?ll (?:now )?(?:run|start|begin|orchestrate)|going to (?:run|orchestrate|execute)|here'?s (?:what|how) (?:it|the harness) will)\b/i.exec(text);
  return m ? m[0] : null;
}

function readEvents(transcriptPath) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return null;
    if (statSync(transcriptPath).size > MAX_TRANSCRIPT_BYTES) return null;
    return readFileSync(transcriptPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return null; }
}

/**
 * Did the enforcement layer leave any evidence of itself in this checkout?
 *
 * A hook that never runs and a hook that inspected-and-permitted used to produce identical
 * evidence (exit 0, empty stdout). With `hooks/lib/decision.mjs` every evaluation appends a row,
 * so ZERO rows across the whole file is now a positive fact about the layer rather than an absence
 * of information about it.
 *
 * @param {string} cwd - Project root.
 * @returns {{rows:number, readable:boolean}} How many decision rows exist and whether the ledger
 *   could be read at all (an unreadable ledger proves nothing and must not sharpen the message).
 */
export function enforcementCensus(cwd) {
  const p = decisionsPath(cwd);
  if (!existsSync(p)) return { rows: 0, readable: false };
  try {
    return { rows: readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).length, readable: true };
  } catch { return { rows: 0, readable: false }; }
}

export function buildReason({ narration, census, enforcement }) {
  return [
    "✋ GATE Z — ZERO WORK. This session dispatched the tech-lead orchestrator and produced no run receipt.",
    "",
    `Mechanical facts: ${census.tool_calls} tool call(s), ${census.work_calls} of them work calls, ` +
    `${census.writes} file write(s), and no \`${globLocal("<slug>", "receipt.json")}\`.`,
    narration ? `The final message reads as a plan, not a result (matched: "${narration}").` : null,
    census.work_calls > 2
      ? `Those ${census.work_calls} work calls are why this block exists, not a reason to waive it: a busy ` +
        "session used to switch this gate off. Work done AROUND the harness has no board, no T0 verdict and " +
        "no receipt — measured, a hand-built feature scored 14/14 while the pipeline never ran (HD-008)."
      : null,
    enforcement && enforcement.readable && enforcement.rows === 0
      ? "AND the enforcement layer left zero decision rows — the gates did not merely permit this run, they never ran. " +
        "Check the plugin install (a symlinked or spaced path was the measured cause; see lib/is-main.mjs)."
      : null,
    "",
    "A run that describes its own pipeline and stops is the exact failure this harness exists to",
    "prevent — measured at 29% acceptance with 10 escaped defects while looking like a clean run.",
    "Loading the instructions is not running them.",
    "",
    "Do the work now, starting with the first step of the runbook:",
    "",
    "  # write the requirement to a file first — inlining multi-line text into a shell",
    "  # argument is where this step goes wrong",
    "  node \"${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/init-run.mjs\" \\",
    "       --slug <slug> --intake-file <path/to/requirement.md> \\",
    "       --auto-level <interactive|auto|unattended> [--gate-answers <preset|path>]",
    "",
    "Then launch the lane itself — a BACKGROUND Bash call, never the `Workflow` tool, which cannot be",
    "granted and is denied outright in a headless session (HD-007):",
    "",
    "  node \"${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/run-workflow.mjs\" \\",
    "       \"${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js\" \\",
    "       --args-file <.shapeup/<slug>/run-args.json> --run-dir <.shapeup/<slug>/workflow-run>",
    "",
    "Resolve each gate the run pauses at with:",
    "",
    "  node \"${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/gate-answers.mjs\" --resolve <gate-id> …",
    "",
    "If the command comes back \"requires approval\", say so and stop — the harness's scripts ship with",
    "the plugin and need a one-time permission grant (`npx shapeup-sdlc init` writes it). Do NOT route",
    "around it with wrapper scripts, and do NOT hand-build the feature instead: a feature built outside",
    "the harness has no board, no T0 and no verdict, which is the un-evidenced \"done\" this exists to stop.",
    "",
    "If the requirement genuinely cannot be built, say why in one sentence — an explicit refusal is",
    "a real answer. A future-tense summary of what the harness would have done is not.",
  ].filter((l) => l !== null).join("\n");
}

async function main() {
  await runHook("gate-zerowork", async () => {
  const raw = await readStdin();

  let p;
  /** Fail-open, with the reason on the record (hooks/lib/decision.mjs). */
  const defer = (reason, rule) => settle({ verdict: "allow", event: "Stop", cwd: p?.cwd, reason, rule });
  try { p = JSON.parse(raw || "{}"); }
  catch (e) { settle({ verdict: "error", event: "Stop", reason: `unparseable payload: ${e.message}` }); }

  // At most one block per stop chain. Without this a session that cannot run the script at all
  // (read-only cwd, missing node) would be held open forever.
  if (p.stop_hook_active) defer("stop_hook_active — at most one block per stop chain", "loop-guard");

  const cwd = p.cwd || process.cwd();
  const events = readEvents(p.transcript_path);
  // no transcript → no facts → fail open
  if (!events || events.length === 0) defer("no readable transcript — no facts to assert", "no-transcript");

  // not a harness session → not our business
  if (!dispatchedOrchestrator(events)) defer("session never dispatched the orchestrator — not a harness run", "no-dispatch");

  // A receipt means the run started. What happens after that is anti-rationalization's job and
  // the evaluator's; this hook only asks whether anything started at all.
  const receipts = findReceipts(cwd);
  if (receipts.length > 0) defer(`${receipts.length} run receipt(s) on disk — the run started`, "receipt-present");

  const census = workCensus(events);

  // ── HD-008 — the `work-done` fail-open is GONE, and its removal is the measurement's whole point.
  //
  // WHAT IT USED TO DO: `if (census.work_calls > 2) defer("the session did work by other means")`.
  // The stated rationale was that a user may have run the harness steps by hand, or be on a
  // pre-receipt version of the plugin.
  //
  // WHAT IT ACTUALLY DID, measured (A7 candidate rep 1, docs/migration/stage3-evidence.md §7.5).
  // `Skill(tech-lead)` was dispatched, the lane could not start (HD-007), the agent hand-built the
  // whole feature, and the hook ALLOWED the Stop on `"37 work calls — the session did work by
  // other means"`. The rep scored 14/14 by the oracle and read like a clean run, with no board, no
  // T0, no verdict and no receipt. A busy session was the one thing that could switch this gate
  // off — so the harder the agent worked around the harness, the safer it was from the gate
  // watching for exactly that.
  //
  // BOTH HALVES OF THE RATIONALE FAIL ON INSPECTION. Running the harness steps by hand starts with
  // `init-run.mjs`, which writes the receipt — such a session already deferred at `receipt-present`
  // two lines up and never reached here. And a pre-receipt plugin cannot be the one executing this
  // hook: `init-run.mjs` ships in the same install, beside the `lib/` this file imports from.
  // Neither case needs an escape, so no replacement escape is added — an escape that cannot fire
  // is the "row that cannot fail" this project keeps catching.
  //
  // WHAT KEEPS THIS SAFE is not a threshold, it is the loop guard: `stop_hook_active` defers
  // unconditionally, so a session that genuinely did the work outside the harness costs one extra
  // turn and then stops. One nudge, never a hang. That is the trade this gate is worth.
  const message = typeof p.last_assistant_message === "string" ? p.last_assistant_message : "";
  const narration = detectNarration(message);
  const enforcement = enforcementCensus(cwd);

  return {
    verdict: "block", event: "Stop", cwd, rule: "no-receipt",
    reason: `orchestrator dispatched, ${census.work_calls} work call(s), no run receipt` +
      (enforcement.readable && enforcement.rows === 0 ? "; enforcement layer left zero decision rows" : ""),
    payload: {
      decision: "block",
      reason: buildReason({ narration, census, enforcement }),
    },
  };
  });
}

if (isMain(import.meta.url)) {
  main();
}
