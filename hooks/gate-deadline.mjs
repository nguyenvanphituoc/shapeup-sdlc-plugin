#!/usr/bin/env node
// GATE D — DEADLINE. PreToolUse hook. The wall-clock breaker, enforced rather than requested.
//
// WHY THIS EXISTS (measured, and it corrects an earlier diagnosis).
//
// SDD harness benchmark, F3 (Sonnet 5): this harness was killed at the declared 1800 s cap and
// published as a DNF — no acceptance, no cost, no turns, a dash in every column. The natural
// reading was "it stalled at a gate". Re-reading the retained transcript says the opposite:
//
//     327 assistant turns · 262 tool calls · 130 work calls · 37 file writes
//     19 gate markers, last gate L3 · narration_ratio 0.047 · stall_signals 0
//
// It was working — the least talkative shapeup run in the matrix — and it was still working when
// the clock ran out. Both existing breakers count EVENTS (`round_budget` per round,
// `attempt_budget` per T0 attempt), so neither can observe that a single round has been running
// for twenty-nine minutes. The run burned its whole budget with both breakers untouched.
//
// The cost of that is not the DNF row. It is that an externally killed run ships NOTHING, not
// even the scopes that were already green. A breaker that trips from the inside routes to GATE H
// instead: census, baseline comparison, ship the part that works. Same clock, different ending.
//
// WHAT IT DENIES, AND WHAT IT DELIBERATELY DOES NOT. Past the deadline this denies dispatches
// that START NEW WORK — `task-executor`. It never denies `spec-evaluator`, `scope-hammer`,
// `qa-edge-hunter` or `advisor-protocol`, because a run past its deadline must still be able to
// judge, hammer and close. A breaker that also blocked the exit would strand the run with green
// scopes it could not ship, which is the failure it exists to prevent.
//
// Non-regression: with no `wall_clock_budget_s` in the receipt (the default) this defers
// instantly. Everything ambiguous — no receipt, unparseable payload, missing timestamp — fails
// open, because a gate that blocks legitimate runs gets disabled, and a disabled gate enforces
// nothing.
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{skill_name|skill, skill_args|args}, cwd }.
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateBudget } from "../skills/tech-lead/scripts/budget-check.mjs";
import { runHook, readStdin, settle } from "./lib/decision.mjs";
import { localDir, localRoot } from "../skills/tech-lead/scripts/lib/paths.mjs";

await runHook("gate-deadline", async () => {
/** Fail-open, with the reason on the record (hooks/lib/decision.mjs). */
const defer = (reason, rule) => settle({ verdict: "allow", event: "PreToolUse", tool: p?.tool_name ?? null, reason, rule });

// Only these start new build work. Everything else in the harness is how a run ENDS, and must
// stay reachable after the deadline.
const STARTS_NEW_WORK = new Set(["task-executor"]);

const raw = await readStdin();

let p;
try { p = JSON.parse(raw || "{}"); }
catch (e) { settle({ verdict: "error", event: "PreToolUse", reason: `unparseable payload: ${e.message}` }); }

if (p.tool_name !== "Skill") defer(`not a Skill call (${p.tool_name ?? "no tool_name"}) — out of scope`);

const skillRaw = p.tool_input?.skill_name ?? p.tool_input?.skill ?? "";
const skill = String(skillRaw).split(":").pop();
if (!STARTS_NEW_WORK.has(skill)) defer(`Skill(${skill || "?"}) does not start new build work — a run past its deadline must still be able to close`, "not-new-work");

const cwd = p.cwd || process.cwd();

/** The active run's receipt, or null. Mirrors budget-check.mjs's discovery. */
function findRun() {
  const root = localDir(cwd);
  if (!existsSync(root)) return null;
  let slug = null;
  try { slug = JSON.parse(readFileSync(join(root, "active-scope"), "utf8"))?.slug || null; } catch { /* scan instead */ }
  const candidates = slug ? [slug] : (() => { try { return readdirSync(root); } catch { return []; } })();
  for (const entry of candidates) {
    const f = join(root, entry, "receipt.json");
    if (!existsSync(f)) continue;
    try { return { slug: entry, receipt: JSON.parse(readFileSync(f, "utf8")) }; } catch { /* not a run */ }
  }
  return null;
}

const run = findRun();
if (!run) defer("no run receipt — nothing to time", "no-run");

const budget = Number(run.receipt.config?.wall_clock_budget_s || 0) || null;
if (!budget) defer("no wall_clock_budget_s in the receipt — breaker off (the default)", "breaker-off");

const startedAt = Date.parse(run.receipt.started_at || "");
if (Number.isNaN(startedAt)) defer("receipt has no parseable started_at — no clock, no claim", "no-clock");

const state = evaluateBudget((Date.now() - startedAt) / 1000, budget);
if (state.status !== "trip") defer(`within budget (${state.status}) — inspected and permitted`, "within-budget");

// STICKY TRIP. The first version of this hook denied and said what to do instead; the orchestrator
// then re-dispatched task-executor and was denied again, THIRTEEN times in one measured run. Each
// denial costs a turn out of the budget the breaker exists to protect, so a re-triable denial
// actively makes the failure it is preventing worse.
//
// The fix is to make the trip a FACT rather than an event: record it once, count the retries, and
// escalate the language so the second denial cannot read like the first. A model that ignored
// "route to GATE H" phrased gently is not helped by receiving the identical text again.
const tripPath = join(localRoot(cwd, run.slug), "deadline-tripped.json");
let denials = 0;
try { denials = JSON.parse(readFileSync(tripPath, "utf8"))?.denials || 0; } catch { /* first trip */ }
denials += 1;
try {
  writeFileSync(tripPath, JSON.stringify({
    type: "deadline-trip", slug: run.slug, denials,
    first_tripped_at: denials === 1 ? new Date().toISOString() : undefined,
    elapsed_s: state.elapsed_s, budget_s: budget,
  }, null, 2) + "\n");
} catch { /* recording is best-effort; the denial still stands */ }

const repeat = denials > 1
  ? [
      "",
      `⛔ THIS IS DENIAL #${denials}. Re-dispatching task-executor will be denied every time, and each`,
      "attempt spends wall-clock the run does not have. STOP TRYING TO BUILD. The only forward move is",
      "GATE H, below. If you have already dispatched scope-hammer, wait for it and close the run.",
    ]
  : [];

const reason = [
  `✋ GATE D — DEADLINE BREAKER. Run "${run.slug}" has used ${state.elapsed_s}s of its ${budget}s wall-clock budget.`,
  "",
  "Dispatching task-executor would start work this run cannot finish. Denied — not because the work",
  "is wrong, but because a run that is killed from outside ships nothing, including the scopes that",
  "are already green.",
  "",
  "Go to GATE H instead:",
  "",
  "  Skill(scope-hammer, \"--breaker deadline --feature " + run.slug + "\")",
  "",
  "Scope-hammer runs the must-have census, compares the shippable subset against the BASELINE (never",
  "against the ideal), and produces a cut list. Ship what is green; the rest becomes a raw idea for",
  "the next Betting Table.",
  "",
  "spec-evaluator, scope-hammer, qa-edge-hunter and advisor-protocol are all still permitted — a run",
  "past its deadline must still be able to judge, hammer, and close.",
  ...repeat,
].join("\n");

return {
  verdict: "deny", event: "PreToolUse", tool: "Skill", subject: skill, rule: "deadline-tripped",
  reason: `wall-clock budget of ${budget}s exhausted — routing to GATE H`,
  payload: {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  },
};
});
