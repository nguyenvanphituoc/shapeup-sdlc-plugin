#!/usr/bin/env node
// Sandbox guard — PreToolUse hook (design spec v1.1 §4.5/Blueprint E, PA3 countermeasure).
//
// Blocks Edit/Write/MultiEdit calls that touch a file outside the active scope's
// `allowed_file_substrate` (+ declared `shared_substrate`). Turns "generator only edits its
// own scope" from prose into a precondition the model cannot talk past — the same pattern as
// hooks/gate-l2.mjs for GATE L2.
//
// Design (deliberately conservative, mirrors gate-l2.mjs):
//   • Fail-OPEN whenever there is nothing to enforce: no active-scope pointer (not running
//     inside a scoped harness round), pointer names a scope contract that doesn't exist or is
//     unparsable, or the tool call carries no resolvable file path. A guard that breaks
//     legitimate non-harness edits would just get disabled.
//   • Fail-CLOSED the moment an active scope IS declared and the target path matches none of
//     its globs — deny, naming the substrate so the model can self-correct.
//   • Run-trace carve-out — writes under the ACTIVE feature's LOCAL gitignored root
//     (`.shapeup/<slug>/`) are always allowed: that root is harness bookkeeping the doer
//     is REQUIRED to write (task-executor P3 status/AC ticks + tasks/_index.md, run-state,
//     execution logs, the P3.7 discovery ledger). Substrate globs whitelist product code and
//     never list the run-trace, so without the carve-out every scoped round strands its own
//     board (island-escape shipped 16/20 task files stale this way). Deliberately narrow:
//     only the active slug's root — `.shapeup/active-scope` (this guard's own pointer)
//     and other features' roots remain subject to the substrate whitelist.
//   • Every denial is also appended to the metrics pathology log (telemetry, not just defense).
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{file_path | edits[].file_path}, cwd }.
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, join, relative, dirname, sep } from "node:path";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";
import { LOCAL, activeScope, scopeContract, metricsShard } from "../skills/tech-lead/scripts/lib/paths.mjs";
import { readContract, SCOPE_CONTRACT } from "../skills/tech-lead/scripts/lib/contract-md.mjs";
import { runHook, readStdin, settle } from "./lib/decision.mjs";

// --- tiny glob matcher: supports *, **, ? — enough for substrate globs, zero dependencies ---
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(relPath, globs) {
  return (globs || []).some((g) => globToRegExp(g).test(relPath));
}

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function extractPaths(toolInput) {
  const paths = [];
  if (toolInput?.file_path) paths.push(toolInput.file_path);
  if (Array.isArray(toolInput?.edits)) {
    for (const e of toolInput.edits) if (e?.file_path) paths.push(e.file_path);
  }
  return paths;
}

export function logPathology(metricsPath, event) {
  try {
    mkdirSync(dirname(metricsPath), { recursive: true });
    appendFileSync(metricsPath, JSON.stringify(event) + "\n");
  } catch { /* telemetry is best-effort; never block on a logging failure */ }
}

async function main() {
  await runHook("sandbox-guard", async () => {
  const raw = await readStdin();
  let p;
  /** Fail-open, with the reason on the record (hooks/lib/decision.mjs). */
  const defer = (reason, rule) => settle({
    verdict: "allow", event: "PreToolUse", tool: p?.tool_name ?? null, cwd: p?.cwd, reason, rule,
  });
  try { p = JSON.parse(raw || "{}"); }
  catch (e) { settle({ verdict: "error", event: "PreToolUse", reason: `unparseable payload: ${e.message}` }); }

  if (!["Edit", "Write", "MultiEdit"].includes(p.tool_name)) {
    defer(`${p.tool_name ?? "no tool_name"} is not a write tool — out of scope`);
  }

  const cwd = p.cwd || process.cwd();
  const activeScopePath = activeScope(cwd);
  // no harness round in progress → don't enforce
  if (!existsSync(activeScopePath)) defer("no active-scope pointer — no harness round in progress", "no-round");

  const active = readJSON(activeScopePath);
  if (!active?.slug || !active?.scope_id) defer("active-scope pointer is unreadable or incomplete", "bad-pointer");

  // Markdown first, legacy JSON second (ADR-0001) — a project mid-migration must stay sandboxed.
  let found = null;
  try { found = readContract(scopeContract(cwd, active.slug, active.scope_id), SCOPE_CONTRACT); }
  catch (e) { defer(`scope contract is unparseable (${e.message})`, "bad-contract"); }
  // pointer stale / contract not committed yet → don't break the run
  if (!found) defer(`no contract for ${active.scope_id} — pointer stale or not committed yet`, "no-contract");
  const contract = found.contract;
  if (!contract) defer("scope contract is unparseable", "bad-contract");

  const allowed = [...(contract.allowed_file_substrate || []), ...(contract.shared_substrate || [])];
  // no whitelist declared → nothing to enforce
  if (allowed.length === 0) defer(`scope ${active.scope_id} declares no write whitelist`, "no-whitelist");

  const targetPaths = extractPaths(p.tool_input);
  if (targetPaths.length === 0) defer("no writable path in the tool input", "no-target");

  const metricsPath = metricsShard(cwd);
  // Run-trace carve-out (see header): the active feature's LOCAL root only. The prefix ends
  // with a separator so a sibling `<local>/<slug>-other/` can't ride along, and the active-scope
  // pointer sits outside it by construction.
  const runTracePrefix = join(LOCAL, active.slug) + sep;
  const violations = [];
  for (const raw of targetPaths) {
    const abs = resolve(cwd, raw);
    const rel = relative(cwd, abs);
    if (rel.startsWith(runTracePrefix)) continue;
    if (!matchesAny(rel, allowed)) violations.push(rel);
  }

  // Inside the substrate — the "inspected and permitted" row. Previously byte-identical to
  // "this hook never ran", which is how 26 enforcement points sat inert behind 610 green checks.
  if (violations.length === 0) {
    defer(`${targetPaths.length} path(s) inside scope ${active.scope_id} substrate — permitted`, "in-substrate");
  }

  logPathology(metricsPath, {
    schema_version: 1,
    at: new Date().toISOString(),
    kind: "pathology",
    pathology: "PA3",
    scope_id: active.scope_id,
    slug: active.slug,
    blocked_paths: violations,
  });

  return {
    verdict: "deny", event: "PreToolUse", tool: p.tool_name, subject: active.scope_id, cwd,
    rule: "outside-substrate",
    reason: `${violations.length} write(s) outside the scope substrate: ${violations.join(", ")}`,
    payload: {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `Sandbox guard (PA3) — scope "${active.scope_id}" may only write ${JSON.stringify(allowed)}. ` +
          `Blocked: ${violations.join(", ")}. If this write legitimately crosses scopes, add the path to ` +
          `the contract's shared_substrate (via ba --remap) rather than editing outside the substrate.`,
      },
    },
  };
  });
}

if (isMain(import.meta.url)) {
  main();
}
