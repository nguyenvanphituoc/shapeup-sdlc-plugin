#!/usr/bin/env node
// npx shapeup-sdlc init — cross-platform scaffolding installer (P1-1).
//
// A faithful Node port of scripts/install-harness.sh + lib-harness.sh, with the two
// differences that were the point of porting it:
//   • no bash, no jq, no python3 — Node parses JSON natively, so the settings.json merge
//     that needed a jq→python3→give-up fallback chain is just JSON.parse. Works on Windows.
//   • no Playwright prerequisite — the browser is a lazy dependency, checked by the eval
//     skill at the moment a [ui] criterion is actually probed (see
//     skills/spec-evaluator/references/probing.md), never at install time.
//
// The bash installers remain the stable curl-able entrypoints for existing bookmarks;
// this is the `npx` front door. Both produce the same layout, and drift between them is
// a bug (the structural suite keeps the shared bits honest).
//
// Usage:
//   npx shapeup-sdlc init [-d <dir>] [-y] [-o] [--dry-run] [--check]
//
// What it configures (identical to install-harness.sh):
//   AGENTS.md harness block · Claude Code plugin (CLI or settings.json merge) ·
//   CLAUDE.md @AGENTS.md import · .gitignore rules · shapeup/metrics/ · Tier C templates

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { apply } from "./lib/steps/fsx.mjs";
import { agentsMdStep } from "./lib/steps/agents-md.mjs";
import { gitignoreStep } from "./lib/steps/gitignore.mjs";
import { scaffoldStep } from "./lib/steps/scaffold.mjs";
import { TARGETS, TARGET_NAMES } from "./lib/targets/index.mjs";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const usage = `Usage: npx shapeup-sdlc init [options]
Options:
  -d, --directory <path>   Target project directory (default: current directory)
  -o, --override           Overwrite existing files in target
  -y, --yes                Run unattended (answer yes to all prompts)
      --target <name>      Where the plugin runs: ${TARGET_NAMES.join(" | ")} (default: claude; "both" runs the two)
      --home <path>        Where per-user Codex files go (default: your home directory)
      --dry-run            Print what would change and write nothing
      --check              Report whether this directory is installed, write nothing
      --no-native-workflow Accepted and ignored (kept so existing scripts that pass it still run)
  -h, --help               Print this help

The grant this writes is two Bash rules for the harness kernel, and nothing else.
The plugin no longer asks for the unscoped "Workflow" permission and no longer
needs it; a "Workflow" token already in your settings is yours and is left alone.`;

let targetDir = ".", yes = false, dryRun = false, check = false, targetName = "claude", homeDir;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-d" || a === "--directory") targetDir = argv[++i];
  else if (a === "-y" || a === "--yes") yes = true;
  else if (a === "-o" || a === "--override") { /* accepted: init has always merged, never clobbered */ }
  else if (a === "--target") targetName = argv[++i];
  else if (a === "--home") homeDir = resolve(argv[++i]);
  else if (a === "--dry-run") dryRun = true;
  else if (a === "--check") check = true;
  else if (a === "--no-native-workflow") { /* accepted, ignored: the installer never writes the token */ }
  else if (a === "-h" || a === "--help") { console.log(usage); process.exit(0); }
  else if (a.startsWith("-")) { console.error(`Unknown option: ${a}\n${usage}`); process.exit(1); }
  else positional.push(a);
}
if (positional.length && positional[0] !== "init") {
  console.error(`Unknown command: ${positional[0]} (only "init" is supported)\n${usage}`);
  process.exit(1);
}
const chosen = targetName === "both" ? { next: [...TARGETS.claude.next, ...TARGETS.codex.next] } : TARGETS[targetName];
if (!chosen) { console.error(`Unknown target: ${targetName} (one of: ${TARGET_NAMES.join(", ")}, both)\n${usage}`); process.exit(1); }

const target = resolve(targetDir);
if (!existsSync(target)) { console.error(`Target directory does not exist: ${target}`); process.exit(1); }
const rel = (p) => (p.startsWith(target) ? p.slice(target.length + 1) || "." : p);
const ctx = { pkgRoot: PKG_ROOT, target, rel, home: homeDir };

// The order is the order the installer has always worked in: the harness block, the target's own
// steps, then the ignore rules and the scaffold.
const wanted = targetName === "both" ? [TARGETS.claude, TARGETS.codex] : [chosen];
const steps = [agentsMdStep, ...wanted.flatMap((t) => t.steps()), gitignoreStep, scaffoldStep];

if (check) {
  let bad = 0;
  for (const s of steps) {
    const r = s.check(ctx);
    if (r.ok) console.log(`ok   ${s.id}`);
    else { bad++; for (const p of r.problems) console.log(`MISSING ${s.id}: ${p}`); }
  }
  process.exit(bad ? 1 : 0);
}

console.log(`${dryRun ? "Planning" : "Installing"} Shape Up SDLC Harness ${dryRun ? "for" : "into"}: ${target}`);

// ---- confirmation -----------------------------------------------------------
if (!yes && !dryRun) {
  if (!process.stdin.isTTY) {
    console.error("Non-interactive environment and no --yes given. Re-run with -y.");
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question(`Proceed with installation in ${target}? [y/N] `, res));
  rl.close();
  if (!/^y$/i.test(answer.trim())) { console.log("Installation cancelled."); process.exit(1); }
}

apply(steps.flatMap((s) => s.plan(ctx)), { dryRun });

if (!dryRun) {
  console.log("\n✅ Harness installation and scaffolding completed.");
  for (const l of chosen.next) console.log(l);
  console.log("   Optional: /retro --scan first seeds the team knowledge base from this project's");
  console.log("   build files, or /retro --research \"<stack>\" seeds it from the platform's official");
  console.log("   docs when there is nothing on disk yet (every drafted rule is confirmed by you).");
  console.log("   ([ui] evaluation needs a browser — `npx playwright install chromium` — but only");
  console.log("   when a run actually reaches a [ui] criterion; nothing else requires it.)");
}
