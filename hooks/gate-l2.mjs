#!/usr/bin/env node
// GATE L2 — board-green check on the once-per-round EVAL. PreToolUse hook (audit Stage E1).
//
// ADVISORY SINCE ADR-0001, and the downgrade was a deliberate product decision rather than a
// retreat. This hook used to hard-DENY the EVAL delegation (tech-lead → spec-evaluator) while the
// task board was not green. It now permits the dispatch and says what it found.
//
// WHY. The board is LOCAL and per-machine (`.shapeup/<slug>/tasks/`), and the harness runs only on
// the machine that invoked it — a teammate reads the committed design, they never resume someone
// else's run. So this gate never protected a team boundary; it protected the operator from their
// own agent, at the cost of denying a call the operator had asked for. The project chose the
// signal over the denial.
//
// WHAT IS LOST, stated plainly: nothing now mechanically prevents an EVAL on a half-green board.
// That is a defect this project has measured before (a run reached EVAL with 16/20 task files
// still `status: ready`). The warning names the offending tasks; it cannot stop the call.
//
// WHAT IS RETAINED: the detection is unchanged. Both independent reads still run — per-task
// frontmatter AND the board table — and the verdict is recorded as `warn`, which is its own row
// in `decisions.jsonl` precisely so "permitted because green" and "permitted despite not green"
// never collapse into the same fact (see hooks/lib/decision.mjs).
//
// Design (deliberate, conservative):
//   • Scope — only ever looks at `Skill` → `spec-evaluator` in ROUND mode (`--single-pass`/
//     `--feature`, no `--task`). A per-task eval (`--task TASK-NNN`) grades one task and is not
//     in scope: the board-green rule is about the round. Anything else defers instantly.
//   • Fail-OPEN whenever there is nothing to verify (no --spec, no board file, unparseable input,
//     zero discoverable tasks) — it only speaks when it can prove the board is partial.
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{skill_name, skill_args}, cwd, ... }.
// Advises via { systemMessage } — never { permissionDecision: "deny" }.

//
// RECEIPTS (v1.5). Every `defer()` below now names WHICH of its fail-open conditions was met, and
// records it (hooks/lib/decision.mjs). The fail-open direction is unchanged and defended above;
// what changes is that "read the board and deferred" is no longer byte-identical to "did not run".

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, basename, dirname } from "node:path";
import { runHook, readStdin, settle } from "./lib/decision.mjs";
// Aliased: the body binds a local `tasksDir` to whichever candidate actually holds a board.
import { tasksDir as localTasksDir } from "../skills/tech-lead/scripts/lib/paths.mjs";

await runHook("gate-l2", async () => {
/** Allow normal permission flow — with the reason on the record. */
const defer = (reason, rule) => settle({ verdict: "allow", event: "PreToolUse", tool: p?.tool_name ?? null, reason, rule });

// 1. Read & parse the PreToolUse payload.
const raw = await readStdin();
let p;
try { p = JSON.parse(raw || "{}"); }
catch (e) { settle({ verdict: "error", event: "PreToolUse", reason: `unparseable payload: ${e.message}` }); }

// 2. Only Skill → spec-evaluator is in scope.
if (p.tool_name !== "Skill") defer(`not a Skill call (${p.tool_name ?? "no tool_name"}) — out of scope`);
const skill = p.tool_input?.skill_name || "";
const args = p.tool_input?.skill_args || "";
if (skill !== "spec-evaluator") defer(`Skill(${skill || "?"}) is not the judge — out of scope`);

// 3. Round mode only. Two shapes qualify:
//    (a) legacy flags: --single-pass / --feature, without --task (per-task eval is not gated);
//    (b) pure-skill envelope (v1.0): --order <WorkOrder> whose operation is "evaluate" — the
//        round dispatch tech-lead compiles. Slug/spec come from the order itself.
let orderSlug = null, orderSpec = null;
const om = args.match(/--order(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/);
if (om) {
  try {
    const order = JSON.parse(readFileSync(resolve(p.cwd || process.cwd(), om[1] || om[2] || om[3]), "utf8"));
    if (order.worker === "spec-evaluator" && (order.operation || "evaluate") === "evaluate") {
      orderSlug = String(order.order_id || "").split("/")[0] || order.payload?.feature || null;
      orderSpec = order.payload?.spec_folder || null;
    } else defer("order is for another job — not the round EVAL", "--order"); // not the round EVAL
  } catch (e) {
    if (e?.name === "HookDecision") throw e;
    /* unreadable order → validate-envelope denies it; nothing to gate here */
    defer(`order unreadable (${e.message}) — validate-envelope owns that denial`, "--order");
  }
}
const hasTask = /--task(?:\s|=)/.test(args);
const roundMode = orderSlug !== null || (!hasTask && (/--single-pass\b/.test(args) || /--feature(?:\s|=)/.test(args)));
if (!roundMode) defer(hasTask ? "per-task eval — the board-green rule is about the round" : "not a round dispatch", "round-mode");

// 4. Locate the board. Since v0.4.0 (Local Tasks Architecture) it lives under the LOCAL
//    gitignored root `.shapeup/<slug>/tasks/`, NOT the committed spec dir — resolving only
//    `<spec>/tasks/` made this hook silently fail-open on every v0.4.0+ run (the island-escape
//    hole: EVAL proceeded with 16/20 task files still `status: ready`).
//    <slug> comes from --feature (the round invocation always carries it: tech-lead's eval plan
//    is `--spec <path> --feature <slug> --single-pass`), falling back to the spec-path
//    convention shapeup/<slug>/spec → parent dir name. `<spec>/tasks/` is kept as the
//    legacy fallback so pre-v0.4.0 boards stay gated. A missing board on every candidate is a
//    legitimate state — spec-evaluator v0.9 grades from the committed spec on machines that
//    never generated a local board — so it stays fail-open.
const m = args.match(/--spec(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/);
const specPath = orderSpec || (m ? (m[1] || m[2] || m[3]) : null);
if (!specPath && !orderSlug) defer("no --spec and no order slug — nothing to locate a board from", "no-spec");
const cwd = p.cwd || process.cwd();
const specDir = specPath ? resolve(cwd, specPath) : null;
const fm = args.match(/--feature(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/);
const slug = orderSlug || (fm && (fm[1] || fm[2] || fm[3])) ||
  (basename(specDir) === "spec" ? basename(dirname(specDir)) : basename(specDir));
const tasksDir = [localTasksDir(cwd, slug), ...(specDir ? [join(specDir, "tasks")] : [])]
  .find((d) => existsSync(join(d, "_index.md")));
// no board on this machine → nothing to verify, don't break the run
if (!tasksDir) defer(`no board for "${slug}" on this machine — nothing to verify`, "no-board");
const board = join(tasksDir, "_index.md");

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
if (!sawTaskFile && !sawBoardRow) defer("board directory holds zero tasks — nothing to assert", "empty-board");

// 7. Verdict.
// Board fully green → allow the EVAL. THIS is the row that used to be indistinguishable from the
// gate never having run: same exit code, same empty stdout, opposite meaning.
if (unfinished.size === 0) defer(`board green — ${sawTaskFile ? "task files" : "board rows"} all done, EVAL permitted`, "board-green");

// Board is partial. Advise, and record it as its own verdict — a `warn` row is what keeps
// "evaluated a non-green board" countable after the denial was removed (ADR-0001).
const list = [...unfinished].sort().join(", ");
return {
  verdict: "warn", event: "PreToolUse", tool: "Skill", subject: slug, rule: "board-not-green",
  reason: `${unfinished.size} unfinished task(s): ${list}`,
  payload: {
    systemMessage:
      `⚠ GATE L2 — the board is NOT green and the EVAL is proceeding anyway.\n` +
      `Unfinished (${unfinished.size}): ${list}\n` +
      `EVAL is designed to run once per round, after every task is done. A verdict taken now grades ` +
      `a partial board, so a PASS does not mean the feature is complete — it means the finished part ` +
      `passed. Route back to BUILD (task-executor) to close these, or use --task for a deliberate ` +
      `single-task check.`,
  },
};
});
