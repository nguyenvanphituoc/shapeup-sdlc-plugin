#!/usr/bin/env node
// Safety spine — PreToolUse hook (v1.2, absorb-audit P1).
//
// The three older hooks guard the PIPELINE (gate order, envelopes, substrates); this one
// guards the MACHINE and the git remote — the substrate everything else sits on. It denies
// the small set of provably destructive operations no harness round (and no standalone
// session) ever legitimately needs:
//   • destructive-fs   — rm -rf on /, ~, $HOME, .., bare * / ., 1-segment absolute paths;
//                        git clean -f with -d/-x and no pathspec
//   • git-destructive  — push --force (--force-with-lease stays allowed), explicit push to
//                        main/master, git reset --hard (the harness's own rule: stash, never
//                        hard-discard — see task-executor round protocol)
//   • sql-destructive  — DROP TABLE/DATABASE/SCHEMA, TRUNCATE
//   • secret-read      — reader commands (and the Read tool) on .env/*.pem/*.key/ssh keys/
//                        cloud credentials
//   • self-protect     — any write/move/delete touching .shapeup/safety-overrides.json:
//                        the model must never widen its own safety envelope (same principle
//                        as sandbox-guard's active-scope pointer rule)
//
// Deliberately conservative, mirrors gate-l2/sandbox-guard: fail-OPEN on unparseable input
// or an unmatched command (precision over reach — a spine that broke `rm -rf ./build` would
// just get disabled), fail-CLOSED the moment a rule provably matches.
//
// Escape hatch: .shapeup/safety-overrides.json (schema: domain.schema.json#/$defs/
// SafetyOverrides) — human-authored, per-project, auditable. A malformed overrides file is
// treated as ABSENT: the override channel fails closed so a parse error can never disable
// the spine. Every exercised override is logged as a SAFETY-OVERRIDE pathology row —
// overrides stay visible, propose-never-dispose.
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{ command | file_path | edits[] }, cwd }.
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { globToRegExp, logPathology } from "./sandbox-guard.mjs";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";
import { LOCAL, safetyOverrides, metricsShard } from "../skills/tech-lead/scripts/lib/paths.mjs";

import { runHook, readStdin, settle } from "./lib/decision.mjs";

// --- overrides ---------------------------------------------------------------

export function loadOverrides(cwd) {
  const p = safetyOverrides(cwd);
  if (!existsSync(p)) return null;
  try {
    const o = JSON.parse(readFileSync(p, "utf8"));
    // Fail closed: anything that isn't a well-formed v1 overrides object is ignored.
    if (o?.schema_version !== 1) return null;
    return {
      allow_commands: Array.isArray(o.allow_commands) ? o.allow_commands : [],
      allow_secret_paths: Array.isArray(o.allow_secret_paths) ? o.allow_secret_paths : [],
      note: typeof o.note === "string" ? o.note : "",
    };
  } catch {
    return null;
  }
}

function commandOverridden(cmd, overrides) {
  return (overrides?.allow_commands || []).some((src) => {
    try { return new RegExp(src).test(cmd); } catch { return false; }
  });
}

// --- secret paths --------------------------------------------------------------

const SECRET_PATTERNS = [
  /(^|[\\/])\.env(\.[^\\/]+)?$/i, // .env, .env.local, … (example/sample excluded below)
  /\.pem$/i,
  /\.key$/i,
  /(^|[\\/])id_(rsa|ed25519|ecdsa|dsa)$/i, // private keys only — id_rsa.pub is public
  /(^|[\\/])\.ssh[\\/]/,
  /(^|[\\/])\.aws[\\/]credentials$/,
  /(^|[\\/])credentials\.(json|ya?ml)$/i,
];
const SECRET_EXEMPT = /\.(example|sample|template|dist)$/i;

export function isSecretPath(path, overrides) {
  if (!path || typeof path !== "string") return false;
  const clean = path.replace(/^['"]|['"]$/g, "");
  if (SECRET_EXEMPT.test(clean)) return false;
  if (!SECRET_PATTERNS.some((re) => re.test(clean))) return false;
  if ((overrides?.allow_secret_paths || []).some((g) => globToRegExp(g).test(clean.replace(/^\.\//, "")))) return false;
  return true;
}

// --- Bash command classification ------------------------------------------------

const READER_CMDS = new Set([
  "cat", "head", "tail", "less", "more", "strings", "grep", "rg", "awk", "sed", "cut", "base64", "xxd", "od",
]);

function tokens(segment) {
  return segment.trim().split(/\s+/).filter(Boolean)
    .map((t) => t.replace(/^['"]|['"]$/g, ""));
}

/** Strip leading env assignments and privilege/no-op wrappers to find the real command. */
function commandTokens(segment) {
  const ts = tokens(segment);
  let i = 0;
  while (i < ts.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(ts[i]) || ["sudo", "command", "env", "nohup", "time"].includes(ts[i]))) i++;
  return ts.slice(i);
}

function isDangerousRmTarget(t) {
  if (["/", "/*", "~", "~/", "$HOME", "${HOME}", "..", "../", "*", "."].includes(t)) return true;
  // 1-segment absolute path: /usr, /etc, /Volumes … (multi-segment absolutes stay allowed)
  if (t.startsWith("/") && t.replace(/\/+$/, "").split("/").filter(Boolean).length === 1) return true;
  return false;
}

function classifySegment(segment, overrides) {
  const ts = commandTokens(segment);
  if (ts.length === 0) return null;
  const cmd = basename(ts[0]);

  // destructive-fs: rm with recursive+force on a provably dangerous target
  if (cmd === "rm") {
    const flags = ts.slice(1).filter((t) => t.startsWith("-"));
    const recursive = flags.some((f) => f === "--recursive" || /^-[a-zA-Z]*[rR]/.test(f));
    const force = flags.some((f) => f === "--force" || (/^-[a-zA-Z]*f/.test(f) && !f.startsWith("--")));
    if (recursive && force) {
      const target = ts.slice(1).filter((t) => !t.startsWith("-")).find(isDangerousRmTarget);
      if (target) {
        return { category: "destructive-fs", reason: `\`rm -rf ${target}\` targets a path whose loss is unrecoverable (${target}). Delete a specific project sub-path instead (relative, multi-segment targets like ./build are allowed).` };
      }
    }
  }

  // destructive-fs: git clean -f with -d/-x and no pathspec (wipes the whole untracked tree)
  if (cmd === "git" && ts[1] === "clean") {
    const rest = ts.slice(2);
    const flags = rest.filter((t) => t.startsWith("-"));
    const paths = rest.filter((t) => !t.startsWith("-"));
    const force = flags.some((f) => /^-[a-zA-Z]*f/.test(f) || f === "--force");
    const wide = flags.some((f) => /^-[a-zA-Z]*[dxX]/.test(f));
    if (force && wide && paths.length === 0) {
      return { category: "destructive-fs", reason: "`git clean -f` with -d/-x and no pathspec wipes every untracked file in the tree — including gitignored run-state. Name an explicit pathspec." };
    }
  }

  if (cmd === "git") {
    // git-destructive: force push / push to main
    if (ts[1] === "push") {
      const rest = ts.slice(2);
      if (rest.some((t) => (t === "--force" || t === "-f") )) {
        return { category: "git-destructive", reason: "`git push --force` rewrites remote history. Use --force-with-lease if a forced update is genuinely intended (it is allowed)." };
      }
      const nonFlags = rest.filter((t) => !t.startsWith("-"));
      const ref = nonFlags[1] || "";
      if (nonFlags.length >= 2 && (/^(main|master)$/.test(ref) || /:(main|master)$/.test(ref))) {
        return { category: "git-destructive", reason: `\`git push ${nonFlags[0]} ${ref}\` pushes directly to the default branch. Push the working branch and open a PR (plain \`git push\` of the current branch is allowed).` };
      }
    }
    // git-destructive: hard reset
    if (ts[1] === "reset" && ts.includes("--hard")) {
      return { category: "git-destructive", reason: "`git reset --hard` discards uncommitted work irrecoverably. The harness's own round protocol is `git stash push -u` — stash, never hard-discard (`git reset --soft` is allowed)." };
    }
  }

  // sql-destructive
  if (/\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE(\s+TABLE)?)\b/i.test(segment)) {
    return { category: "sql-destructive", reason: "The command contains a destructive SQL statement (DROP/TRUNCATE). Run schema-destroying SQL yourself, outside the session." };
  }

  // secret-read: a reader command whose argument is a secret path
  if (READER_CMDS.has(cmd)) {
    const secret = ts.slice(1).filter((t) => !t.startsWith("-")).find((t) => isSecretPath(t, overrides));
    if (secret) {
      return { category: "secret-read", reason: `\`${cmd} ${secret}\` reads a secret file. Secrets must not enter the conversation; if this is a false positive, add the path to ${LOCAL}/safety-overrides.json (allow_secret_paths).` };
    }
  }

  // self-protect: any write/move/delete naming the overrides file
  if (segment.includes("safety-overrides.json")) {
    const writer =
      /(^|[^>])>>?(?!&)/.test(segment) || // redirection (>, >>) — but not >&2
      /\btee\b/.test(segment) ||
      /\bsed\s+-[a-zA-Z]*i/.test(segment) ||
      ["rm", "mv", "cp", "truncate"].includes(cmd);
    if (writer) {
      return { category: "self-protect", reason: `The safety-overrides file is human-authored only — the session must never widen (or remove) its own safety envelope. Ask the PO to edit ${LOCAL}/safety-overrides.json.` };
    }
  }

  return null;
}

/** Classify a full Bash command (raw string + each &&/;/|/newline segment).
 *  Returns { deny, category, reason } — deny:false means the spine has nothing to say. */
export function classifyCommand(command, overrides) {
  if (!command || typeof command !== "string") return { deny: false };
  for (const segment of command.split(/\s*(?:\|\||&&|;|\||\n)\s*/).filter(Boolean)) {
    const hit = classifySegment(segment, overrides);
    if (hit) return { deny: true, ...hit };
  }
  return { deny: false };
}

// --- hook entry ------------------------------------------------------------------

const HOOK_TOOLS = new Set(["Bash", "Read", "Write", "Edit", "MultiEdit"]);

function extractPaths(toolInput) {
  const paths = [];
  if (toolInput?.file_path) paths.push(toolInput.file_path);
  if (Array.isArray(toolInput?.edits)) {
    for (const e of toolInput.edits) if (e?.file_path) paths.push(e.file_path);
  }
  return paths;
}

async function main() {
  await runHook("safety-spine", async () => {
  const raw = await readStdin();
  let p;
  /** Fail-open, with the reason on the record (hooks/lib/decision.mjs). */
  const defer = (reason, rule) => settle({
    verdict: "allow", event: "PreToolUse", tool: p?.tool_name ?? null, cwd: p?.cwd, reason, rule,
  });
  try { p = JSON.parse(raw || "{}"); }
  catch (e) { settle({ verdict: "error", event: "PreToolUse", reason: `unparseable payload: ${e.message}` }); }

  if (!HOOK_TOOLS.has(p.tool_name)) defer(`${p.tool_name ?? "no tool_name"} is not a guarded tool — out of scope`);

  const cwd = p.cwd || process.cwd();
  const overrides = loadOverrides(cwd);
  const metricsPath = metricsShard(cwd);

  const deny = (category, reason, detail) => {
    logPathology(metricsPath, {
      schema_version: 1,
      at: new Date().toISOString(),
      kind: "pathology",
      pathology: "SAFETY",
      category,
      tool: p.tool_name,
      ...detail,
    });
    settle({
      verdict: "deny", event: "PreToolUse", tool: p.tool_name, cwd, rule: category,
      subject: detail?.path ?? detail?.command ?? null, reason,
      payload: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Safety spine (${category}) — ${reason}`,
        },
      },
    });
  };

  if (p.tool_name === "Bash") {
    const command = p.tool_input?.command || "";
    const verdict = classifyCommand(command, overrides);
    if (!verdict.deny) defer("command matched no destructive rule — inspected and permitted", "bash-clean");
    if (commandOverridden(command, overrides)) {
      // Exercised override: allowed, but never invisible.
      logPathology(metricsPath, {
        schema_version: 1,
        at: new Date().toISOString(),
        kind: "pathology",
        pathology: "SAFETY-OVERRIDE",
        category: verdict.category,
        tool: "Bash",
        command: command.slice(0, 200),
        note: overrides?.note || "",
      });
      defer(`${verdict.category} allowed by a human-authored override — permitted, never invisible`, "override");
    }
    deny(verdict.category, verdict.reason, { command: command.slice(0, 200) });
  }

  if (p.tool_name === "Read") {
    const path = p.tool_input?.file_path || "";
    if (isSecretPath(path, overrides)) {
      deny("secret-read", `Read(${path}) targets a secret file. Secrets must not enter the conversation; if this is a false positive, add the path to ${LOCAL}/safety-overrides.json (allow_secret_paths).`, { path });
    }
    defer("read target is not a secret path — inspected and permitted", "read-clean");
  }

  // Write | Edit | MultiEdit — only the self-protect rule; substrates stay sandbox-guard's job.
  const overridesAbs = resolve(safetyOverrides(cwd));
  const hit = extractPaths(p.tool_input).find((raw) => resolve(cwd, raw) === overridesAbs);
  if (hit) {
    deny("self-protect", `The safety-overrides file is human-authored only — the session must never widen (or remove) its own safety envelope. Ask the PO to edit ${LOCAL}/safety-overrides.json.`, { path: hit });
  }
  defer("write does not touch the safety envelope — inspected and permitted", "write-clean");
  });
}

if (isMain(import.meta.url)) {
  main();
}
