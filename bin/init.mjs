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
import { LOCAL, LEGACY, metricsDir } from "../kernel/lib/paths.mjs";
import { mergePipelinePermissions as mergeGrant, isWorkspaceTrusted, WORKFLOW_RULE } from "./lib/grant.mjs";

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
      --no-native-workflow Do not grant the unscoped "Workflow" permission (see below)
  -h, --help               Print this help

The grant this writes is two Bash rules for the harness kernel, plus — unless
--no-native-workflow is given — the "Workflow" token that lets the tech-lead
launch its run script without approving each launch. That token is UNSCOPED: it
authorises every dynamic workflow script in the project, not only this plugin's.
Declining it leaves the harness fully functional in an interactive session; only
the unattended lane needs the pre-approval.`;

let targetDir = ".", yes = false, override = false, nativeWorkflow = true;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-d" || a === "--directory") targetDir = argv[++i];
  else if (a === "-y" || a === "--yes") yes = true;
  else if (a === "-o" || a === "--override") override = true;
  else if (a === "--no-native-workflow") nativeWorkflow = false;
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
warnIfUntrusted(target);

// ---- 2. wire Claude Code to the root AGENTS.md ------------------------------
ensureAgentImport(join(target, "CLAUDE.md"), "CLAUDE.md");

// ---- 3. .gitignore ----------------------------------------------------------
// Both roots are listed, deliberately. A project may still be carrying the pre-ADR-0001 local root
// alongside the current one, and a run trace committed by accident from either is exactly the
// mistake the tier split exists to prevent. Ignoring a directory that does not exist costs nothing.
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
      // kernel permission grant, so this path has to add it — and until v1.6.1 it did not,
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
          console.error("           the kernel permission grant was NOT added. Copy it from .claude/settings.local.example.json.");
          return;
        }
      }
      mergePipelinePermissions(written);
      writeFileSync(settingsFile, JSON.stringify(written, null, 2) + "\n");
      console.log("  [claude] plugin installed at project scope + kernel permissions granted — run /reload-plugins to activate in a live session");
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
  console.log(`  [claude] merged marketplace + plugin + kernel permissions into ${rel(settingsFile)}`);
  console.log("  [claude] the plugin auto-enables on the next session opened in this directory");
}

/**
 * Pre-approve the harness's OWN kernel, and nothing else.
 *
 * WHY THIS EXISTS. Every deterministic step of a run is a Node subcommand that ships with the
 * plugin and therefore lives OUTSIDE the project. Under any permission mode short of
 * `bypassPermissions`, executing a script from outside the working directory needs approval. In an
 * interactive session you click once and forget it. In a headless one there is nobody to click,
 * and the run cannot take its first step — measured, without a working grant, as the receipt step
 * being attempted six different ways in one session and denied every time, after which the agent
 * abandons the harness and builds the feature by hand.
 *
 * The rule form and the measurements behind it live in `bin/lib/grant.mjs`. It is a separate module
 * so the structural suite can IMPORT the generator instead of regex-parsing this file for the rule
 * shape — the proxy that let a grant matching no command at all ship green for three releases.
 *
 * @param {object} settings - Parsed settings.json, mutated in place.
 * @returns {void}
 */
function mergePipelinePermissions(settings) {
  mergeGrant(settings, { nativeWorkflow });
  if (!nativeWorkflow) {
    console.log(`  [claude] --no-native-workflow: "${WORKFLOW_RULE}" not granted — launch the run`);
    console.log("           script interactively and approve it, or re-run init without the flag.");
  }
}

/**
 * Say so when the grant we just wrote will be ignored anyway.
 *
 * Writing a correct rule into an untrusted workspace produces no error at install, no error at
 * session start, and a denial at the first dispatch — the same invisible failure shape that let a
 * grant matching no command at all ship for three releases. The one thing this project cannot
 * afford is another enforcement point that is silent when it is not working, so this prints.
 *
 * It reports rather than repairs: trusting a directory authorises executing code from it, which is
 * the user's call, not a decision for a package running under `npx`.
 *
 * @param {string} projectDir - The directory just installed into.
 * @returns {void}
 */
function warnIfUntrusted(projectDir) {
  const trusted = isWorkspaceTrusted(projectDir);
  if (trusted === true || trusted === null) return;
  console.log("");
  console.log("  [claude] ⚠ This workspace is not trusted yet, so Claude Code will IGNORE the");
  console.log("           permission grant just written and the harness will stop at its first");
  console.log("           dispatch. Fix it in one of two ways:");
  console.log("             • open Claude Code here interactively once and accept the trust prompt, or");
  console.log(`             • set projects[${JSON.stringify(resolve(projectDir))}].hasTrustDialogAccepted`);
  console.log("               to true in ~/.claude.json (this is what a CI image should bake in).");
}

function ensureAgentImport(file, label) {
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, "");
  if (!readFileSync(file, "utf8").includes("@AGENTS.md")) {
    appendFileSync(file, "\n@AGENTS.md\n");
    console.log(`Appended @AGENTS.md import tag to ${label}`);
  } else console.log(`@AGENTS.md import tag already present in ${label}`);
}
