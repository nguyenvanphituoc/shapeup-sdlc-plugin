#!/usr/bin/env node
// Cross-directory release-candidate check — the cheap half of what CLAUDE.md asks a release
// candidate to clear.
//
// Every other check in this repo runs the hook from ITS OWN LOCATION IN THE WORKING TREE, against
// paths inside the SAME checkout (`npm test`, `npm run demo`). That proves the hook's logic is
// right; it cannot prove the hook's own relative imports resolve correctly when the plugin lives
// somewhere else entirely, because self-hosting puts the plugin root inside the working directory
// for every single check this repo runs on itself (AGENTS.md calls this out by name — two whole
// classes of defect are invisible here). A marketplace install is exactly that "somewhere else":
// `CLAUDE_PLUGIN_ROOT` points at an install path, never at a consumer project's own tree.
//
// This script closes that one gap, cheaply: `git archive HEAD` to a scratch copy at a DIFFERENT
// absolute path, a scratch "consumer" directory that is not nested under it at all, and the real
// `hooks/sandbox-guard.mjs` invoked FROM THE COPY — the same way Claude Code's hooks.json spawns it
// (`node "${CLAUDE_PLUGIN_ROOT}/hooks/sandbox-guard.mjs"`, stdin JSON, `cwd` set to the project).
// It is not the full soak CLAUDE.md also describes (two consecutive features through a live nested
// session on a marketplace install) — that one needs a real consumer, a real feature, and real
// wall-clock time, and stays a manual exercise. This one needs neither and takes under a second.
//
// Usage: npm run verify:cross-dir

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const box = mkdtempSync(join(tmpdir(), "shapeup-crossdir-"));
const pluginCopy = join(box, "plugin-copy");
const consumer = join(box, "consumer-project");
const decisionsPath = join(box, "decisions.jsonl");

const bail = (msg) => {
  rmSync(box, { recursive: true, force: true });
  console.error(`❌ verify:cross-dir — ${msg}`);
  process.exit(1);
};

// ─── 1. A copy of the plugin at a path that shares nothing with this checkout ──────────────────

mkdirSync(pluginCopy, { recursive: true });
try {
  execSync(`git archive HEAD | tar -x -C "${pluginCopy}"`, { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
} catch (e) {
  bail(`git archive failed — is this running inside a git checkout? (${e.message})`);
}
const hookCopy = join(pluginCopy, "hooks", "sandbox-guard.mjs");
if (!existsSync(hookCopy)) bail(`git archive did not produce hooks/sandbox-guard.mjs at ${hookCopy}`);
if (resolve(hookCopy) === resolve(ROOT, "hooks", "sandbox-guard.mjs")) {
  bail("the copy resolved to the same path as the dev checkout — this check proves nothing unless the paths differ");
}

// ─── 2. A consumer project this hook has never seen, with one live order ───────────────────────

const SLUG = "verify-cross-dir";
mkdirSync(join(consumer, ".shapeup", SLUG, "orders"), { recursive: true });
mkdirSync(join(consumer, ".shapeup", SLUG, "results"), { recursive: true });
mkdirSync(join(consumer, "src"), { recursive: true });
execSync("git init -q .", { cwd: consumer });
writeFileSync(join(consumer, ".shapeup", "active-order"),
  JSON.stringify({ slug: SLUG, order_path: `.shapeup/${SLUG}/orders/build-1.json` }));
writeFileSync(join(consumer, ".shapeup", SLUG, "orders", "build-1.json"), JSON.stringify({
  order_id: "build-1", operation: "execute", compiled_at: new Date().toISOString(),
  substrate: { allowed: ["src/**"] },
}));

/**
 * Ask the COPY's hook to judge one write, exactly as Claude Code's hooks.json would spawn it.
 * @param {string} rel - Path (relative to the consumer project) the worker wants to edit.
 * @returns {string} The hook's verbatim stdout, trimmed.
 */
function runHook(rel) {
  const payload = JSON.stringify({ tool_name: "Write", tool_input: { file_path: join(consumer, rel) }, cwd: consumer });
  return execFileSync("node", [hookCopy], {
    input: payload, encoding: "utf8", env: { ...process.env, SHAPEUP_DECISIONS_PATH: decisionsPath },
  }).trim();
}

// ─── 3. Drive it — deny outside the substrate, permit inside it ───────────────────────────────

const denyRaw = runHook("outside.txt");
if (!denyRaw) bail("sandbox-guard said nothing about an out-of-substrate write, run from a copy at a different path — a cross-directory import is failing silently (fail-open with no evidence)");
let deny;
try { deny = JSON.parse(denyRaw); } catch { bail(`sandbox-guard's stdout did not parse as JSON: ${denyRaw}`); }
const decision = deny?.hookSpecificOutput?.permissionDecision;
const reason = deny?.hookSpecificOutput?.permissionDecisionReason;
if (decision !== "deny") bail(`expected a deny from the copy, got ${JSON.stringify(deny)}`);
if (typeof reason !== "string" || !reason.includes("outside.txt")) {
  bail(`sandbox-guard denied but never named outside.txt — the denial does not identify the offender`);
}

const allowRaw = runHook("src/index.js");
if (allowRaw.includes('"permissionDecision":"deny"')) {
  bail(`sandbox-guard denied a write inside its own substrate, run from a copy at a different path: ${allowRaw}`);
}

// ─── 4. The ledger — both decisions actually landed, at the redirected path ────────────────────

if (!existsSync(decisionsPath)) bail(`neither decision reached ${decisionsPath} — the redirect itself is not working`);
const rows = readFileSync(decisionsPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
if (rows.length !== 2) bail(`expected exactly 2 decision rows, found ${rows.length}: ${JSON.stringify(rows)}`);
if (rows[0].verdict !== "deny" || rows[1].verdict !== "allow") {
  bail(`expected [deny, allow] in order, got [${rows[0].verdict}, ${rows[1].verdict}]`);
}

rmSync(box, { recursive: true, force: true });
console.log("✅ verify:cross-dir — hooks/sandbox-guard.mjs, run from a copy at a different absolute path,");
console.log("   against a consumer project it has never seen, still denies outside its substrate and");
console.log("   permits inside it. Both decisions reached the redirected ledger.");
