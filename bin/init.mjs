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
//   npx shapeup-sdlc init [-d <dir>] [-y] [-o]
//
// What it configures (identical to install-harness.sh):
//   AGENTS.md harness block · Claude Code plugin (CLI or settings.json merge) ·
//   CLAUDE.md @AGENTS.md import · .gitignore rules · shapeup/metrics/ · Tier C templates

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, appendFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { LOCAL, LEGACY, metricsDir } from "../skills/tech-lead/scripts/lib/paths.mjs";

/** The root a project migrating off the pre-ADR-0001 layout may still be carrying. */
const LEGACY_LOCAL = LEGACY.local;

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "nguyenvanphituoc/shapeup-sdlc-plugin";
const MARKETPLACE_KEY = "nvptuoc-marketplace";
const PLUGIN_KEY = "shapeup-sdlc-plugin@nvptuoc-marketplace";

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const usage = `Usage: npx shapeup-sdlc init [options]
Options:
  -d, --directory <path>   Target project directory (default: current directory)
  -o, --override           Overwrite existing files in target
  -y, --yes                Run unattended (answer yes to all prompts)
  -h, --help               Print this help`;

let targetDir = ".", yes = false, override = false;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-d" || a === "--directory") targetDir = argv[++i];
  else if (a === "-y" || a === "--yes") yes = true;
  else if (a === "-o" || a === "--override") override = true;
  else if (a === "-h" || a === "--help") { console.log(usage); process.exit(0); }
  else if (a.startsWith("-")) { console.error(`Unknown option: ${a}\n${usage}`); process.exit(1); }
  else positional.push(a);
}
if (positional.length && positional[0] !== "init") {
  console.error(`Unknown command: ${positional[0]} (only "init" is supported)\n${usage}`);
  process.exit(1);
}

const target = resolve(targetDir);
if (!existsSync(target)) { console.error(`Target directory does not exist: ${target}`); process.exit(1); }
console.log(`Installing Shape Up SDLC Harness into: ${target}`);

// ---- confirmation -----------------------------------------------------------
if (!yes) {
  if (!process.stdin.isTTY) {
    console.error("Non-interactive environment and no --yes given. Re-run with -y.");
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question(`Proceed with installation in ${target}? [y/N] `, res));
  rl.close();
  if (!/^y$/i.test(answer.trim())) { console.log("Installation cancelled."); process.exit(1); }
}

// ---- 0. AGENTS.md harness block ---------------------------------------------
const agentsSrc = join(PKG_ROOT, "AGENTS.md");
const agentsDst = join(target, "AGENTS.md");
if (!existsSync(agentsSrc)) {
  console.warn("Warning: AGENTS.md not found in package — skipping root AGENTS.md setup.");
} else {
  const block = readFileSync(agentsSrc, "utf8");
  if (!existsSync(agentsDst)) {
    writeFileSync(agentsDst, block);
    console.log(`Created ${rel(agentsDst)} from harness template`);
  } else {
    const existing = readFileSync(agentsDst, "utf8");
    if (existing.includes("<!-- HARNESS_START -->")) {
      // Replace the old block in place (block goes at the top, mirroring the bash awk).
      const stripped = existing
        .split(/\r?\n/)
        .reduce((acc, line) => {
          if (line.includes("<!-- HARNESS_START -->")) acc.skip = true;
          else if (line.includes("<!-- HARNESS_END -->")) acc.skip = false;
          else if (!acc.skip) acc.out.push(line);
          return acc;
        }, { out: [], skip: false }).out.join("\n");
      writeFileSync(agentsDst, block + stripped);
      console.log(`Updated harness block in ${rel(agentsDst)}`);
    } else {
      appendFileSync(agentsDst, "\n" + block);
      console.log(`Appended harness block to existing ${rel(agentsDst)}`);
    }
  }
}

// ---- 1. Claude Code install -------------------------------------------------
installClaude();

// ---- 2. wire Claude Code to the root AGENTS.md ------------------------------
ensureAgentImport(join(target, "CLAUDE.md"), "CLAUDE.md");

// ---- 3. .gitignore ----------------------------------------------------------
// Both roots are listed, deliberately. A project may be mid-migration (0006 moves `.shapeup/`
// to `.shapeup/`), and a run trace committed by accident during that window is exactly the mistake
// the tier split exists to prevent. Ignoring a directory that does not exist costs nothing.
const GITIGNORE_RULE = `# Shape Up SDLC run workspace
${LOCAL}/
${LEGACY_LOCAL}/

# Shape Up SDLC Tier C — per-member local config (templates *.example stay committed).
# The env file is SHAPEUP_-namespaced (filename + keys) so it never collides with, or gets
# confused with, this project's own .env / .env.local.
.claude/settings.local.json
.env.shapeup.local
!.env.shapeup.example
!.claude/settings.local.example.json`;
const gitignore = join(target, ".gitignore");
if (existsSync(gitignore)) {
  if (!readFileSync(gitignore, "utf8").includes(`${LOCAL}/`)) {
    appendFileSync(gitignore, "\n" + GITIGNORE_RULE + "\n");
    console.log("Added Shape Up SDLC ignore rules to .gitignore");
  } else console.log(`${LOCAL}/ already ignored in .gitignore`);
} else {
  writeFileSync(gitignore, GITIGNORE_RULE + "\n");
  console.log("Created .gitignore and added ignore rules");
}

// ---- 4. telemetry shard dir + Tier C templates ------------------------------
mkdirSync(metricsDir(target), { recursive: true });
for (const [srcRel, note] of [
  [".claude/settings.local.example.json", "copy to settings.local.json and edit"],
  [".env.shapeup.example", "copy to .env.shapeup.local and edit"],
]) {
  const src = join(PKG_ROOT, srcRel);
  if (existsSync(src)) {
    const dst = join(target, srcRel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst);
    console.log(`Installed ${srcRel} (${note})`);
  }
}

console.log("\n✅ Harness installation and scaffolding completed.");
console.log("   Next: open a Claude Code session in this directory and run /ship \"<your idea>\".");
console.log("   ([ui] evaluation needs a browser — `npx playwright install chromium` — but only");
console.log("   when a run actually reaches a [ui] criterion; nothing else requires it.)");

// ---- helpers ----------------------------------------------------------------
function rel(p) { return p.startsWith(target) ? p.slice(target.length + 1) || "." : p; }

function installClaude() {
  const settingsFile = join(target, ".claude", "settings.json");
  mkdirSync(join(target, ".claude"), { recursive: true });

  // Primary path: the claude CLI registers the marketplace in the live session AND writes
  // project-scoped settings. Single command strings + shell so Windows resolves claude.cmd;
  // every argument is a static constant, nothing user-controlled is interpolated.
  const sh = (cmd, opts = {}) => spawnSync(cmd, { shell: true, ...opts });
  const have = sh("claude --version", { stdio: "ignore" });
  if (have.status === 0) {
    console.log("  [claude] registering marketplace + installing plugin via claude CLI…");
    const add = sh(`claude plugin marketplace add --scope project ${REPO}`, { cwd: target, stdio: "inherit" });
    const ins = add.status === 0
      ? sh(`claude plugin install --scope project ${PLUGIN_KEY}`, { cwd: target, stdio: "inherit" })
      : add;
    if (ins.status === 0) {
      // The CLI registers the marketplace and enables the plugin. It does NOT know about the
      // pipeline permission grant, so this path has to add it — and until v1.6.1 it did not,
      // while the comment below claimed both paths merged it. Measured on a fresh `npx
      // shapeup-sdlc init`: `permissions.allow` came out EMPTY on every machine with the claude
      // CLI installed, which is the common case and the one that prints success. That is FC-02
      // exactly — an enforcement point inert on the path people actually take — and the grant it
      // skipped is the one that exists because a headless run without it was denied approval 26
      // times in a single session.
      //
      // Merged, never overwritten: re-read what the CLI just wrote and add only the allow list.
      let written = {};
      if (existsSync(settingsFile)) {
        try { written = JSON.parse(readFileSync(settingsFile, "utf8")); }
        catch (e) {
          console.error(`  [claude] plugin installed, but ${rel(settingsFile)} is not valid JSON (${e.message}) —`);
          console.error("           the pipeline permission grant was NOT added. Copy it from .claude/settings.local.example.json.");
          return;
        }
      }
      mergePipelinePermissions(written);
      writeFileSync(settingsFile, JSON.stringify(written, null, 2) + "\n");
      console.log("  [claude] plugin installed at project scope + pipeline permissions granted — run /reload-plugins to activate in a live session");
      return;
    }
    console.log("  [claude] Warning: claude CLI failed — falling back to writing settings.json directly");
  }

  // Fallback: merge settings.json natively (the whole reason this file is Node).
  //
  // (See mergePipelinePermissions below — it runs on both paths.)
  let settings = {};
  if (existsSync(settingsFile)) {
    try { settings = JSON.parse(readFileSync(settingsFile, "utf8")); }
    catch (e) {
      console.error(`  [claude] ${rel(settingsFile)} is not valid JSON (${e.message}) — refusing to overwrite it.`);
      console.error(`           Fix the file, or add manually: extraKnownMarketplaces.${MARKETPLACE_KEY} + enabledPlugins["${PLUGIN_KEY}"]`);
      return;
    }
  }
  settings.extraKnownMarketplaces = settings.extraKnownMarketplaces || {};
  settings.extraKnownMarketplaces[MARKETPLACE_KEY] = { source: { source: "github", repo: REPO } };
  settings.enabledPlugins = settings.enabledPlugins || {};
  settings.enabledPlugins[PLUGIN_KEY] = true;
  mergePipelinePermissions(settings);
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");
  console.log(`  [claude] merged marketplace + plugin + pipeline permissions into ${rel(settingsFile)}`);
  console.log("  [claude] the plugin auto-enables on the next session opened in this directory");
}

/**
 * Pre-approve the harness's OWN pipeline scripts, and nothing else.
 *
 * WHY THIS EXISTS (observed, not theorized).
 *
 * Every load-bearing step of a run is a Node script that ships with the plugin and therefore
 * lives OUTSIDE the project — `${CLAUDE_PLUGIN_ROOT}/skills/**\/scripts/*.mjs`. Under any
 * permission mode short of `bypassPermissions`, executing a script from outside the working
 * directory needs approval. In an interactive session you click once and forget it. In a headless
 * one there is nobody to click, and the run cannot take its first step.
 *
 * That is not hypothetical. Without the grant, the run receipt step (`init-run.mjs`) gets
 * attempted six different ways in a single session — direct, via a heredoc, via two hand-written
 * wrapper scripts, via a sub-agent — and every one comes back "This command requires approval".
 * The agent then gives up on the harness and builds the feature by hand. It is the failure the
 * receipt was designed to make visible, arriving through the door the receipt itself opened.
 *
 * Scope is deliberately narrow: `node <plugin>/skills/.../scripts/*.mjs`, by prefix. This grants
 * the harness the right to run its own deterministic, dependency-free, network-free scripts. It
 * grants no general `Bash(node:*)`, which would be a much larger ask for a much smaller reason.
 *
 * BOTH SPELLINGS ARE GRANTED, and that is the point of v1.5's leg-2 fix. The skills now write
 * every invocation in the QUOTED literal form — `node "${CLAUDE_PLUGIN_ROOT}/skills/…"` — because
 * the unquoted form breaks the moment the plugin is installed under a path with a space in it
 * (`~/Library/Application Support/…`), which `lib/is-main.mjs` documents as a measured case, not a
 * hypothetical. A prefix rule is a literal string match, so the quote character would otherwise
 * put every call site back outside the grant — the exact mismatch this fix exists to remove. The
 * unquoted prefix stays for older prose and for anything a user has already typed.
 *
 * The structural suite asserts that every documented call site is in a form
 * one of these prefixes actually matches, so the two can never drift apart again.
 *
 * @param {object} settings - Parsed settings.json, mutated in place.
 * @returns {void}
 */
function mergePipelinePermissions(settings) {
  const OWNERS = ["tech-lead", "ba-pitch-analyzer", "spec-evaluator"];
  const PREFIXES = OWNERS.flatMap((o) => [
    `node \${CLAUDE_PLUGIN_ROOT}/skills/${o}/scripts/`,
    `node "\${CLAUDE_PLUGIN_ROOT}/skills/${o}/scripts/`,
  ]);
  settings.permissions = settings.permissions || {};
  const allow = new Set(settings.permissions.allow || []);
  for (const p of PREFIXES) allow.add(`Bash(${p}:*)`);
  settings.permissions.allow = [...allow];
}

function ensureAgentImport(file, label) {
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, "");
  if (!readFileSync(file, "utf8").includes("@AGENTS.md")) {
    appendFileSync(file, "\n@AGENTS.md\n");
    console.log(`Appended @AGENTS.md import tag to ${label}`);
  } else console.log(`@AGENTS.md import tag already present in ${label}`);
}
