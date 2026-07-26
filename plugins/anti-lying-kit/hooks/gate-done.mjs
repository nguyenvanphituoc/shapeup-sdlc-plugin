#!/usr/bin/env node
// GATE DONE — PreToolUse hook. The anti-lying kit's headline mechanism.
//
// Denies the "grade / review / ship the work" tool call while the project's own task board
// still has unfinished items, naming them. The agent cannot talk past it, because it is not a
// prompt: the tool call never runs.
//
//   Prevents: the agent running its review/eval pass on half-finished work and reporting
//             success — the single most-cited failure of spec-driven agent workflows.
//
// Workflow-agnostic by construction: everything workflow-specific lives in lib/board.mjs, and
// this file only ever asks "which tasks are not done?".
//
// FAIL OPEN, always, unless the board provably has unfinished work:
//   • no `.antilying.json`            → defer (project has not opted in)
//   • no board files / zero tasks     → defer (nothing to assert)
//   • unparseable hook payload        → defer
//   • a per-item call (`--task X`)    → defer (grading one item is legitimate mid-flight)
// A gate that blocks legitimate work gets uninstalled, and then it protects nobody.
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input, cwd }.
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

import { readBoard, gateMatchers } from "../lib/board.mjs";

const defer = () => process.exit(0);

const raw = await new Promise((res) => {
  let d = "";
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => res(d));
  process.stdin.on("error", () => res(""));
});

let p;
try { p = JSON.parse(raw || "{}"); } catch { defer(); }

const cwd = p.cwd || process.cwd();
const { names, perItem } = gateMatchers(cwd);

// 1. Is this a call that means "grade / finish the work"?
//    Look at the tool's own name plus the usual name-carrying fields, so this works for Skill,
//    Agent/Task, and bespoke slash-command dispatches alike.
const ti = p.tool_input || {};
const subject = [
  ti.skill, ti.skill_name, ti.name, ti.subagent_type, ti.command, ti.prompt,
].filter((v) => typeof v === "string").join(" ");
const toolName = String(p.tool_name || "");

if (!names.test(subject) && !names.test(toolName)) defer();

// 2. Per-item grading is never gated — the board-green rule is about the whole round.
const args = [ti.skill_args, ti.args, ti.command, ti.prompt].filter(Boolean).join(" ");
if (perItem.test(args)) defer();

// 3. Ask the board. null → nothing provable → defer.
const board = readBoard(cwd);
if (!board) defer();
if (board.unfinished.length === 0) defer(); // green → allow

// 4. Deny, naming the offenders so the model can act on it rather than retry blindly.
const shown = board.unfinished.slice(0, 12);
const more = board.unfinished.length - shown.length;
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason:
      `GATE DONE — the task board is not green, so this cannot be graded as finished yet. ` +
      `${board.unfinished.length} of ${board.total} tasks are unfinished: ` +
      `${shown.join(", ")}${more > 0 ? `, +${more} more` : ""}. ` +
      `Finish them, then re-attempt. ` +
      `(Board read from ${board.files.slice(0, 3).join(", ")}. ` +
      `To grade a single item deliberately, scope the call to it — per-item checks are not gated.)`,
  },
}));
process.exit(0);
