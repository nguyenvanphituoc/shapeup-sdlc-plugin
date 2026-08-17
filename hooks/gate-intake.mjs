#!/usr/bin/env node
// GATE L0.0 — intake precondition. PreToolUse hook.
//
// Denies a `tech-lead` dispatch that carries no pitch, no spec folder, and no requirement text.
//
// WHY THIS EXISTS (reproduced, not theorized). The orchestrator was reached as
//
//     Skill(tech-lead, args: "--unattended")
//
// — the flag survived the hand-off, the requirement text did not. With nothing to orchestrate,
// the run printed the gate names, a confident plan, and wrote no code, while *looking* like a
// successful run. The same harness invoked with --pitch/--spec built the feature. Whether a model
// happens to inline the text and recover is a property of the model, not of the harness.
//
// That is the "agent claims done" failure this project exists to prevent, happening at the
// project's own front door. Every other invariant that matters here lives in the runtime; this one
// was living in a prompt, and a prompt is exactly what gets dropped on a hand-off. So it becomes a
// hook, like GATE L2.
//
// Design mirrors the GATE L2 block deliberately:
//   • Scope — only `Skill` → tech-lead. Anything else defers instantly.
//   • Fail-CLOSED only on a provably empty intake, with an actionable re-invocation in the reason.
//   • Fail-OPEN on anything ambiguous (unparseable payload, unknown arg shape, an envelope
//     --order). A gate that blocks legitimate runs gets disabled, and a disabled gate enforces
//     nothing.
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{skill_name|skill, skill_args|args}, ... }
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

// RECEIPTS (v1.5). This gate has been scored `No effect` on a re-run where the acceptance rate did
// not move — because the hook CORRECTLY never fired and the cause was elsewhere. That distinction
// is unprovable from a hook that answers "inspected and permitted" and "never ran" with the same
// silence. Every decision below is now recorded (hooks/lib/decision.mjs).

import { runHook, readStdin, settle } from "./lib/decision.mjs";

await runHook("gate-intake", async () => {
/** Fail-open, with the reason on the record. */
const defer = (reason, rule) => settle({ verdict: "allow", event: "PreToolUse", tool: p?.tool_name ?? null, reason, rule });

const raw = await readStdin();

let p;
try { p = JSON.parse(raw || "{}"); }
catch (e) { settle({ verdict: "error", event: "PreToolUse", reason: `unparseable payload: ${e.message}` }); }

if (p.tool_name !== "Skill") defer(`not a Skill call (${p.tool_name ?? "no tool_name"}) — out of scope`);

// The Skill tool's field names differ by surface: `skill_name`/`skill_args` in the hook payload,
// `skill`/`args` in the model-facing stream. Accept both — assuming one was already wrong once.
const skillRaw = p.tool_input?.skill_name ?? p.tool_input?.skill ?? "";
const args = String(p.tool_input?.skill_args ?? p.tool_input?.args ?? "");

// Plugin skills arrive namespaced, e.g. "shapeup-sdlc-plugin:tech-lead".
const skill = String(skillRaw).split(":").pop();
if (skill !== "tech-lead") defer(`Skill(${skill}) is not the orchestrator — out of scope`);

// The envelope port supplies its own intake; `harness verify envelope` owns that path.
if (/--order\b/.test(args)) defer("envelope dispatch — validate-envelope owns this path", "--order");

// Intake is satisfied by ANY of: a pitch path, a spec folder, or free requirement text.
const hasPitch = /--pitch\s+\S/.test(args);
const hasSpec = /--spec\s+\S/.test(args);
const hasResume = /--from\s+\S/.test(args); // resuming an existing run has its state on disk

// Free text = anything left once flags and their values are removed.
// Every flag that TAKES A VALUE must be listed here. A flag whose value is not stripped reads as
// free requirement text, and the gate then defers on an empty intake — the exact dispatch it
// exists to deny. This is a live failure mode, not a hypothetical: adding `--gate-answers` and
// `--wall-clock-budget` without listing them here silently blinded the gate, and the very next run
// reached tech-lead as `args:"--unattended --gate-answers ci --wall-clock-budget 2400"` — no
// requirement text at all — and was waved straight through, because "ci" and "2400" counted as
// the spec.
// Adding a valued flag anywhere in the harness means adding it here, and structural test §39
// enforces exactly that against commands/ship.md.
const VALUED_FLAGS = /--(pitch|spec|from|lens|rounds|attempts|parallel-scopes|orch-model|exec-model|eval-model|qa-model|feature|task|gate-answers|wall-clock-budget|slug|auto-level|max-rounds|intake-file|intake-text|spec-folder|cwd|out|by|preset|file|order)\s+\S+/g;
const BARE_FLAGS = /--[a-z0-9-]+/g;
const freeText = args.replace(VALUED_FLAGS, " ").replace(BARE_FLAGS, " ").trim();

if (hasPitch || hasSpec || hasResume || freeText.length > 0) {
  const via = hasPitch ? "--pitch" : hasSpec ? "--spec" : hasResume ? "--from" : "free requirement text";
  defer(`intake resolvable via ${via} — inspected and permitted`, via);
}

// Provably empty intake → deny, and say exactly how to fix it.
const reason = [
  "✋ GATE L0.0 — NO INTAKE. tech-lead was dispatched with no pitch, no spec folder, and no",
  "requirement text; only flags survived the hand-off (args: " + JSON.stringify(args.slice(0, 80)) + ").",
  "",
  "An orchestrator with no spec has nothing to orchestrate. Proceeding would print the gate list",
  "and build nothing — output that reads like a successful run and contains no work.",
  "",
  "Re-dispatch with the requirement text or an on-disk spec:",
  "  Skill(tech-lead, \"<the full requirement text>\")",
  "  Skill(tech-lead, \"--pitch <shaping.md> --spec <spec/>\")",
].join("\n");

return {
  verdict: "deny", event: "PreToolUse", tool: "Skill", subject: "tech-lead", rule: "empty-intake",
  reason: "no pitch, no spec folder, and no requirement text survived the hand-off",
  payload: {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  },
};
});
