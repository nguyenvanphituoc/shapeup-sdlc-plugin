#!/usr/bin/env node
// GATE L2 enforcement — PreToolUse hook (audit Stage E1).
//
// Turns the harness's most important gate from an honor-system pause into a HARD precondition:
// the once-per-round EVAL delegation (tech-lead → spec-evaluator) is BLOCKED unless the task board
// is provably green. This is the "one real gate beats ten honor-system ones" the audit (F2) asks
// for — every other ⏸ GATE is still a prompt-level instruction; this one the runtime enforces.
//
// Design (deliberate, conservative):
//   • Scope — only ever gates `Skill` → `spec-evaluator` in ROUND mode (`--single-pass`/`--feature`,
//     no `--task`). A per-task eval (`--task TASK-NNN`) grades one task and is NOT gated: the
//     board-green rule is about the round, not about grading a single task. Anything else defers
//     instantly.
//   • Fail-CLOSED on a non-green board (deny, naming the offending tasks → actionable for the model).
//   • Fail-OPEN whenever there is nothing to verify (no --spec, no board file, unparseable input,
//     zero discoverable tasks). A gate that breaks legitimate or standalone runs would just get
//     disabled — so it only fires when it can prove the board is partial.
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{skill_name, skill_args}, cwd, ... }.
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const defer = () => process.exit(0); // allow normal permission flow

// 1. Read & parse the PreToolUse payload.
const raw = await new Promise((res) => {
  let d = "";
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => res(d));
  process.stdin.on("error", () => res(""));
});
let p;
try { p = JSON.parse(raw || "{}"); } catch { defer(); }

// 2. Only Skill → spec-evaluator is in scope.
if (p.tool_name !== "Skill") defer();
const skill = p.tool_input?.skill_name || "";
const args = p.tool_input?.skill_args || "";
if (skill !== "spec-evaluator") defer();

// 3. Round mode only. Per-task eval (--task) is explicitly not gated.
const hasTask = /--task(?:\s|=)/.test(args);
const roundMode = !hasTask && (/--single-pass\b/.test(args) || /--feature(?:\s|=)/.test(args));
if (!roundMode) defer();

// 4. Locate the board from --spec <path> → <spec>/tasks/_index.md.
const m = args.match(/--spec(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/);
const specPath = m ? (m[1] || m[2] || m[3]) : null;
if (!specPath) defer();
const cwd = p.cwd || process.cwd();
const specDir = resolve(cwd, specPath);
const tasksDir = join(specDir, "tasks");
const board = join(tasksDir, "_index.md");
if (!existsSync(board)) defer(); // nothing to verify → don't break the run

// 5. Assert the board is green, from two independent reads; fail-closed if EITHER shows unfinished
//    work. (a) per-task frontmatter `status:` (the authoritative field); (b) the board table's
//    status cell (what GATE L2 literally reads). Done = `status: done` / a ✅ in the row.
const DONE_FRONTMATTER = /^status:\s*done\s*$/im;
const NOT_DONE_MARK = /⬜|🔄|🚫|\b(ready|in-progress|blocked)\b/i;
const unfinished = new Set();

// (a) task files
let sawTaskFile = false;
try {
  for (const f of readdirSync(tasksDir)) {
    if (!/^TASK-[\w.-]+\.md$/i.test(f)) continue; // skip _index.md and non-task files
    sawTaskFile = true;
    const body = readFileSync(join(tasksDir, f), "utf8");
    const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const id = (body.match(/^id:\s*(TASK-[\w.-]+)/im) || [])[1] || f.replace(/\.md$/, "");
    if (!fm || !DONE_FRONTMATTER.test(fm[1])) unfinished.add(id);
  }
} catch { /* unreadable tasks dir → fall back to board table below */ }

// (b) board table rows — any row naming a task whose status cell is not ✅/done.
let sawBoardRow = false;
for (const line of readFileSync(board, "utf8").split(/\r?\n/)) {
  const idm = line.match(/\bTASK-[\w.-]+/);
  if (!idm || !line.includes("|")) continue;
  sawBoardRow = true;
  const done = line.includes("✅") || /\bdone\b/i.test(line);
  if (!done || NOT_DONE_MARK.test(line)) unfinished.add(idm[0]);
}

// 6. If neither source yielded a single task, there's nothing to assert → defer.
if (!sawTaskFile && !sawBoardRow) defer();

// 7. Verdict.
if (unfinished.size === 0) defer(); // board fully green → allow the EVAL

const list = [...unfinished].sort().join(", ");
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason:
      `GATE L2 — board is not green. EVAL runs exactly once per round, only after every task is done. ` +
      `Unfinished: ${list}. Route back to BUILD (task-executor) to finish these, then re-attempt EVAL. ` +
      `(To override deliberately, the PO can invoke spec-evaluator with --task for a single-task check.)`,
  },
}));
process.exit(0);
