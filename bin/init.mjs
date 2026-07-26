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
// a bug (tests/structural keeps the shared bits honest).
//
// Usage:
//   npx shapeup-sdlc init [-d <dir>] [-y] [-o] [--cli claude,antigravity,codex|all]
//
// What it configures (identical to install-harness.sh):
//   AGENTS.md harness block · Claude Code plugin (CLI or settings.json merge) ·
//   Antigravity .agents/skills + subagents · Codex .codex/skills · CLAUDE.md @AGENTS.md
//   import · .gitignore rules · docs/shapeup-sdlc/metrics/ · Tier C templates

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync, appendFileSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "nguyenvanphituoc/shapeup-sdlc-plugin";
const MARKETPLACE_KEY = "nvptuoc-marketplace";
const PLUGIN_KEY = "shapeup-sdlc-plugin@nvptuoc-marketplace";
const ALL_CLIS = ["claude", "antigravity", "codex"];

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const usage = `Usage: npx shapeup-sdlc init [options]
Options:
  -d, --directory <path>   Target project directory (default: current directory)
  --cli <list>             Comma-separated: claude,antigravity,codex or "all" (default: all)
  -o, --override           Overwrite existing files in target
  -y, --yes                Run unattended (answer yes to all prompts)
  -h, --help               Print this help`;

let targetDir = ".", yes = false, override = false, clis = [...ALL_CLIS];
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-d" || a === "--directory") targetDir = argv[++i];
  else if (a === "-y" || a === "--yes") yes = true;
  else if (a === "-o" || a === "--override") override = true;
  else if (a === "--cli") {
    const v = argv[++i] || "";
    clis = v === "all" ? [...ALL_CLIS] : v.split(",").map((s) => s.trim()).filter(Boolean);
    const bad = clis.filter((c) => !ALL_CLIS.includes(c));
    if (bad.length) { console.error(`Unknown CLI(s): ${bad.join(", ")}. Valid: ${ALL_CLIS.join(", ")}, all`); process.exit(1); }
  } else if (a === "-h" || a === "--help") { console.log(usage); process.exit(0); }
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
console.log(`CLIs: ${clis.join(", ")}`);

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

// ---- 1. per-CLI install -----------------------------------------------------
for (const cli of clis) {
  if (cli === "claude") installClaude();
  else replaceSkills(cli);
}

// ---- 2. wire each CLI to the root AGENTS.md ---------------------------------
if (clis.includes("claude")) ensureAgentImport(join(target, "CLAUDE.md"), "CLAUDE.md", "claude");
if (clis.includes("antigravity")) ensureAgentImport(join(target, ".agents", "AGENTS.md"), ".agents/AGENTS.md", "auto");
if (clis.includes("codex")) ensureAgentImport(join(target, ".codex", "AGENTS.md"), ".codex/AGENTS.md", "auto");

// ---- 3. .gitignore ----------------------------------------------------------
const GITIGNORE_RULE = `# Shape Up SDLC run workspace
.shapeup-sdlc/

# Shape Up SDLC Tier C — per-member local config (templates *.example stay committed).
# The env file is SHAPEUP_-namespaced (filename + keys) so it never collides with, or gets
# confused with, this project's own .env / .env.local.
.claude/settings.local.json
.env.shapeup.local
!.env.shapeup.example
!.claude/settings.local.example.json`;
const gitignore = join(target, ".gitignore");
if (existsSync(gitignore)) {
  if (!readFileSync(gitignore, "utf8").includes(".shapeup-sdlc/")) {
    appendFileSync(gitignore, "\n" + GITIGNORE_RULE + "\n");
    console.log("Added Shape Up SDLC ignore rules to .gitignore");
  } else console.log(".shapeup-sdlc/ already ignored in .gitignore");
} else {
  writeFileSync(gitignore, GITIGNORE_RULE + "\n");
  console.log("Created .gitignore and added ignore rules");
}

// ---- 4. telemetry shard dir + Tier C templates ------------------------------
mkdirSync(join(target, "docs", "shapeup-sdlc", "metrics"), { recursive: true });
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
      console.log("  [claude] plugin installed at project scope — run /reload-plugins to activate in a live session");
      return;
    }
    console.log("  [claude] Warning: claude CLI failed — falling back to writing settings.json directly");
  }

  // Fallback: merge settings.json natively (the whole reason this file is Node).
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
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");
  console.log(`  [claude] merged marketplace + plugin into ${rel(settingsFile)}`);
  console.log("  [claude] the plugin auto-enables on the next session opened in this directory");
}

function replaceSkills(cli) {
  const src = join(PKG_ROOT, "skills");
  const dest = join(target, cli === "antigravity" ? ".agents" : ".codex", "skills");
  mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const name of readdirSync(src)) {
    const skillPath = join(src, name);
    if (!existsSync(join(skillPath, "SKILL.md"))) continue; // skip empty stubs
    rmSync(join(dest, name), { recursive: true, force: true });
    cpSync(skillPath, join(dest, name), { recursive: true });
    n++;
  }
  console.log(`  [${cli}] ${n} skills replaced in ${rel(dest)}`);

  if (cli === "antigravity") {
    const distSub = join(PKG_ROOT, "dist", "antigravity", "subagents");
    if (existsSync(distSub)) {
      const subDest = join(target, ".agents", "subagents");
      mkdirSync(subDest, { recursive: true });
      cpSync(distSub, subDest, { recursive: true });
      const idx = join(PKG_ROOT, "dist", "antigravity", "subagents.json");
      if (existsSync(idx)) cpSync(idx, join(target, ".agents", "subagents.json"));
      console.log(`  [antigravity] subagent configs replaced in ${rel(subDest)}`);
    }
  }
}

function ensureAgentImport(file, label, mode) {
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, "");
  if (mode === "claude") {
    if (!readFileSync(file, "utf8").includes("@AGENTS.md")) {
      appendFileSync(file, "\n@AGENTS.md\n");
      console.log(`Appended @AGENTS.md import tag to ${label}`);
    } else console.log(`@AGENTS.md import tag already present in ${label}`);
  } else {
    console.log(`${label} ready (root AGENTS.md auto-discovered)`);
  }
}
