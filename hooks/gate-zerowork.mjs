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
//   1. SCOPE. It defers unless a run is active (`activeSlug()` → `.shapeup-sdlc/<slug>/`).
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

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";

const defer = () => process.exit(0);

const MAX_TRANSCRIPT_BYTES = 20 * 1024 * 1024;

/** Tool names that constitute doing something to the project, as opposed to looking at it. */
const WORK_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash", "Task", "Agent"]);

/** Did this session dispatch the orchestrator? Skill(tech-lead) in any of its surface spellings. */
export function dispatchedOrchestrator(events) {
  for (const ev of events) {
    for (const block of toolUses(ev)) {
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
  const root = join(cwd, ".shapeup-sdlc");
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

export function buildReason({ narration, census }) {
  return [
    "✋ GATE Z — ZERO WORK. This session dispatched the tech-lead orchestrator and produced no run receipt.",
    "",
    `Mechanical facts: ${census.tool_calls} tool call(s), ${census.work_calls} of them work calls, ` +
    `${census.writes} file write(s), and no \`.shapeup-sdlc/<slug>/receipt.json\`.`,
    narration ? `The final message reads as a plan, not a result (matched: "${narration}").` : null,
    "",
    "A run that describes its own pipeline and stops is the exact failure this harness exists to",
    "prevent — measured at 29% acceptance with 10 escaped defects while looking like a clean run.",
    "Loading the instructions is not running them.",
    "",
    "Do the work now, starting with the first step of the runbook:",
    "",
    "  # write the requirement to a file first — inlining multi-line text into a shell",
    "  # argument is where this step goes wrong",
    "  node ${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/init-run.mjs \\",
    "       --slug <slug> --intake-file <path/to/requirement.md> \\",
    "       --auto-level <interactive|auto|unattended> [--gate-answers <preset|path>]",
    "",
    "Then proceed through the gates, resolving each one with:",
    "",
    "  node ${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/gate-answers.mjs --resolve <gate-id> …",
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
  const raw = await new Promise((res) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    process.stdin.on("error", () => res(""));
  });

  let p;
  try { p = JSON.parse(raw || "{}"); } catch { defer(); return; }

  // At most one block per stop chain. Without this a session that cannot run the script at all
  // (read-only cwd, missing node) would be held open forever.
  if (p.stop_hook_active) defer();

  const cwd = p.cwd || process.cwd();
  const events = readEvents(p.transcript_path);
  if (!events || events.length === 0) defer(); // no transcript → no facts → fail open

  if (!dispatchedOrchestrator(events)) defer(); // not a harness session → not our business

  // A receipt means the run started. What happens after that is anti-rationalization's job and
  // the evaluator's; this hook only asks whether anything started at all.
  if (findReceipts(cwd).length > 0) defer();

  const census = workCensus(events);

  // Fail open when the session clearly did work by other means. A user may have run the harness
  // steps by hand, or be on a pre-receipt version of the plugin. Real narration has ~zero work
  // calls; this threshold keeps the hook off everything else.
  if (census.work_calls > 2) defer();

  const message = typeof p.last_assistant_message === "string" ? p.last_assistant_message : "";
  const narration = detectNarration(message);

  console.log(JSON.stringify({
    decision: "block",
    reason: buildReason({ narration, census }),
  }));
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main();
}
