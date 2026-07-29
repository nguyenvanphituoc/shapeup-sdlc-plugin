#!/usr/bin/env node
// GATE L0.0 — intake precondition. PreToolUse hook.
//
// Denies a `tech-lead` dispatch that carries no pitch, no spec folder, and no requirement text.
//
// WHY THIS EXISTS (measured, not theorized). On the SDD harness benchmark
// (`sdd-harness-bench`, feature F2, Haiku 4.5, n=3, zero variance) the orchestrator was reached as
//
//     Skill(tech-lead, args: "--unattended")
//
// — the flag survived the hand-off, the requirement text did not. With nothing to orchestrate,
// the run printed eleven gate names, a confident plan, and wrote no code, scoring 29% against a
// hidden acceptance suite while *looking* like a successful run. The same harness invoked with
// --pitch/--spec scored 100%, n=3. A stronger model happened to inline the text and recover; a
// cheaper one did not, three times out of three.
//
// That is the "agent claims done" failure this project exists to prevent, happening at the
// project's own front door. Every other invariant that matters here lives in the runtime; this one
// was living in a prompt, and a prompt is exactly what gets dropped on a hand-off. So it becomes a
// hook, like GATE L2.
//
// Design mirrors gate-l2.mjs deliberately:
//   • Scope — only `Skill` → tech-lead. Anything else defers instantly.
//   • Fail-CLOSED only on a provably empty intake, with an actionable re-invocation in the reason.
//   • Fail-OPEN on anything ambiguous (unparseable payload, unknown arg shape, an envelope
//     --order). A gate that blocks legitimate runs gets disabled, and a disabled gate enforces
//     nothing.
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{skill_name|skill, skill_args|args}, ... }
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

const defer = () => process.exit(0);

const raw = await new Promise((res) => {
  let d = "";
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => res(d));
  process.stdin.on("error", () => res(""));
});

let p;
try { p = JSON.parse(raw || "{}"); } catch { defer(); }

if (p.tool_name !== "Skill") defer();

// The Skill tool's field names differ by surface: `skill_name`/`skill_args` in the hook payload,
// `skill`/`args` in the model-facing stream. Accept both — assuming one was already wrong once.
const skillRaw = p.tool_input?.skill_name ?? p.tool_input?.skill ?? "";
const args = String(p.tool_input?.skill_args ?? p.tool_input?.args ?? "");

// Plugin skills arrive namespaced, e.g. "shapeup-sdlc-plugin:tech-lead".
const skill = String(skillRaw).split(":").pop();
if (skill !== "tech-lead") defer();

// The envelope port supplies its own intake; validate-envelope.mjs owns that path.
if (/--order\b/.test(args)) defer();

// Intake is satisfied by ANY of: a pitch path, a spec folder, or free requirement text.
const hasPitch = /--pitch\s+\S/.test(args);
const hasSpec = /--spec\s+\S/.test(args);
const hasResume = /--from\s+\S/.test(args); // resuming an existing run has its state on disk

// Free text = anything left once flags and their values are removed.
// Every flag that TAKES A VALUE must be listed here. A flag whose value is not stripped reads as
// free requirement text, and the gate then defers on an empty intake — the exact dispatch it
// exists to deny. This is a live failure mode, not a hypothetical: adding `--gate-answers ci` and
// `--wall-clock-budget 2400` silently blinded the gate, and the very next benchmark run reached
// tech-lead as `args:"--unattended --gate-answers ci --wall-clock-budget 2400"` — no requirement
// text at all — and was waved straight through, because "ci" and "2400" counted as the spec.
// Adding a valued flag anywhere in the harness means adding it here, and structural test §39
// enforces exactly that against commands/ship.md.
const VALUED_FLAGS = /--(pitch|spec|from|lens|rounds|attempts|orch-model|exec-model|eval-model|qa-model|feature|task|gate-answers|wall-clock-budget|slug|auto-level|max-rounds|intake-file|intake-text|spec-folder|cwd|out|by|preset|file|order)\s+\S+/g;
const BARE_FLAGS = /--[a-z0-9-]+/g;
const freeText = args.replace(VALUED_FLAGS, " ").replace(BARE_FLAGS, " ").trim();

if (hasPitch || hasSpec || hasResume || freeText.length > 0) defer();

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

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
}));
process.exit(0);
