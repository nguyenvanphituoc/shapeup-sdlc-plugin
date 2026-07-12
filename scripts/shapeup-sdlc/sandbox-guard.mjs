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
//   • Every denial is also appended to the metrics pathology log (telemetry, not just defense).
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{file_path | edits[].file_path}, cwd }.
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, join, relative, dirname } from "node:path";

const defer = () => process.exit(0);

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
  const raw = await new Promise((res) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    process.stdin.on("error", () => res(""));
  });
  let p;
  try { p = JSON.parse(raw || "{}"); } catch { defer(); return; }

  if (!["Edit", "Write", "MultiEdit"].includes(p.tool_name)) defer();

  const cwd = p.cwd || process.cwd();
  const activeScopePath = join(cwd, ".shapeup-sdlc", "active-scope");
  if (!existsSync(activeScopePath)) defer(); // no harness round in progress → don't enforce

  const active = readJSON(activeScopePath);
  if (!active?.slug || !active?.scope_id) defer();

  const contractPath = join(cwd, "docs", "shapeup-sdlc", active.slug, "scopes", `${active.scope_id}.json`);
  if (!existsSync(contractPath)) defer(); // pointer stale / contract not committed yet → don't break the run

  const contract = readJSON(contractPath);
  if (!contract) defer();

  const allowed = [...(contract.allowed_file_substrate || []), ...(contract.shared_substrate || [])];
  if (allowed.length === 0) defer(); // no whitelist declared → nothing to enforce

  const targetPaths = extractPaths(p.tool_input);
  if (targetPaths.length === 0) defer();

  const metricsPath = join(cwd, "docs", "shapeup-sdlc", "metrics", `${process.env.HOSTNAME || "local"}.jsonl`);
  const violations = [];
  for (const raw of targetPaths) {
    const abs = resolve(cwd, raw);
    const rel = relative(cwd, abs);
    if (!matchesAny(rel, allowed)) violations.push(rel);
  }

  if (violations.length === 0) defer();

  logPathology(metricsPath, {
    schema_version: 1,
    at: new Date().toISOString(),
    kind: "pathology",
    pathology: "PA3",
    scope_id: active.scope_id,
    slug: active.slug,
    blocked_paths: violations,
  });

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        `Sandbox guard (PA3) — scope "${active.scope_id}" may only write ${JSON.stringify(allowed)}. ` +
        `Blocked: ${violations.join(", ")}. If this write legitimately crosses scopes, add the path to ` +
        `the contract's shared_substrate (via ba --remap) rather than editing outside the substrate.`,
    },
  }));
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
