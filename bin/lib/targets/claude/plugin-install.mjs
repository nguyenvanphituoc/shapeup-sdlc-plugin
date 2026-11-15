// Installing the plugin into Claude Code, and the grant that lets its run entry points execute.
//
// Two acts, kept apart so each entry point takes only the one it needs:
//   • registering the plugin at project scope (the claude CLI, else a settings.json merge), which
//     `npx shapeup-sdlc init` does so teammates who pull the repo inherit the plugin;
//   • merging the kernel permission grant into .claude/settings.json, which every install needs —
//     including one started from the plugin's own init command, where the plugin is already
//     installed (often at user scope) and registering it again would add a second, project-scope copy.
//
// Both are acts, not file writes: the claude CLI registers the marketplace in the live session and
// writes project settings itself. So each plan is one `run` operation; `--dry-run` describes it and
// `check()` reads the result back off disk.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { mergePipelinePermissions as mergeGrant, pipelineRules } from "../../grant.mjs";
import { isWorkspaceTrusted } from "./trust.mjs";

export const REPO = "nguyenvanphituoc/shapeup-sdlc-plugin";
export const MARKETPLACE_KEY = "nvptuoc-marketplace";
export const PLUGIN_KEY = "shapeup-sdlc-plugin@nvptuoc-marketplace";

const settingsPath = (target) => join(target, ".claude", "settings.json");

/** Merge the grant, say so when the user's own settings carry a token this plugin no longer needs. */
function mergePipelinePermissions(settings, log) {
  mergeGrant(settings);
  if ((settings.permissions?.allow || []).includes("Workflow")) {
    log('  [claude] your settings carry a "Workflow" permission. This plugin no longer needs it and');
    log("           leaves it alone — remove it yourself if nothing else in the project uses it.");
  }
}

/** Say so when the grant just written will be ignored anyway. It reports rather than repairs. */
function warnIfUntrusted(projectDir, log) {
  const trusted = isWorkspaceTrusted(projectDir);
  if (trusted === true || trusted === null) return;
  log("");
  log("  [claude] ⚠ This workspace is not trusted yet, so Claude Code will IGNORE the");
  log("           permission grant just written and the harness will stop at its first");
  log("           dispatch. Fix it in one of two ways:");
  log("             • open Claude Code here interactively once and accept the trust prompt, or");
  log(`             • set projects[${JSON.stringify(resolve(projectDir))}].hasTrustDialogAccepted`);
  log("               to true in ~/.claude.json (this is what a CI image should bake in).");
}

/**
 * Read the project's settings, or an empty object when there are none.
 * @returns {object|null} The parsed settings, or null when the file is not valid JSON (`onBad` was told).
 */
function readSettings(file, onBad) {
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { onBad(e); return null; }
}

const writeSettings = (file, settings) => writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");

/** Register the marketplace and install the plugin at project scope through the claude CLI. */
function registerViaCli(target, log) {
  // Single command strings + shell so Windows resolves claude.cmd; every argument is a static
  // constant, nothing user-controlled is interpolated.
  const sh = (cmd, opts = {}) => spawnSync(cmd, { shell: true, ...opts });
  if (sh("claude --version", { stdio: "ignore" }).status !== 0) return false;
  log("  [claude] registering marketplace + installing plugin via claude CLI…");
  const add = sh(`claude plugin marketplace add --scope project ${REPO}`, { cwd: target, stdio: "inherit" });
  const ins = add.status === 0 ? sh(`claude plugin install --scope project ${PLUGIN_KEY}`, { cwd: target, stdio: "inherit" }) : add;
  if (ins.status === 0) return true;
  log("  [claude] Warning: claude CLI failed — falling back to writing settings.json directly");
  return false;
}

/** The settings-file form of a project-scope registration: the marketplace and the enabled plugin. */
function registerInSettings(settings) {
  settings.extraKnownMarketplaces = settings.extraKnownMarketplaces || {};
  settings.extraKnownMarketplaces[MARKETPLACE_KEY] = { source: { source: "github", repo: REPO } };
  settings.enabledPlugins = settings.enabledPlugins || {};
  settings.enabledPlugins[PLUGIN_KEY] = true;
}

/** Register the plugin at project scope and merge the grant — what `npx shapeup-sdlc init` does. */
function installClaude({ target, rel, log = console.log }) {
  const settingsFile = settingsPath(target);
  mkdirSync(join(target, ".claude"), { recursive: true });

  if (registerViaCli(target, log)) {
    // The CLI registers the marketplace and enables the plugin; it does NOT know about the kernel
    // permission grant, so this path adds it, merged and never overwritten.
    const written = readSettings(settingsFile, (e) => {
      console.error(`  [claude] plugin installed, but ${rel(settingsFile)} is not valid JSON (${e.message}) —`);
      console.error("           the kernel permission grant was NOT added. Copy it from .claude/settings.local.example.json.");
    });
    if (!written) return;
    mergePipelinePermissions(written, log);
    writeSettings(settingsFile, written);
    log("  [claude] plugin installed at project scope + kernel permissions granted — run /reload-plugins to activate in a live session");
    warnIfUntrusted(target, log);
    return;
  }

  // Fallback: merge settings.json natively.
  const settings = readSettings(settingsFile, (e) => {
    console.error(`  [claude] ${rel(settingsFile)} is not valid JSON (${e.message}) — refusing to overwrite it.`);
    console.error(`           Fix the file, or add manually: extraKnownMarketplaces.${MARKETPLACE_KEY} + enabledPlugins["${PLUGIN_KEY}"]`);
  });
  if (!settings) return;
  registerInSettings(settings);
  mergePipelinePermissions(settings, log);
  writeSettings(settingsFile, settings);
  log(`  [claude] merged marketplace + plugin + kernel permissions into ${rel(settingsFile)}`);
  log("  [claude] the plugin auto-enables on the next session opened in this directory");
  warnIfUntrusted(target, log);
}

/** Merge the grant and nothing else — for a project whose plugin is already installed. */
function grantClaude({ target, rel, log = console.log }) {
  const settingsFile = settingsPath(target);
  mkdirSync(join(target, ".claude"), { recursive: true });
  const settings = readSettings(settingsFile, (e) => {
    console.error(`  [claude] ${rel(settingsFile)} is not valid JSON (${e.message}) — refusing to overwrite it.`);
    console.error("           Fix the file, or copy the permissions.allow block from .claude/settings.local.example.json.");
  });
  if (!settings) return;
  mergePipelinePermissions(settings, log);
  writeSettings(settingsFile, settings);
  log(`  [claude] merged the kernel permissions into ${rel(settingsFile)} (plugin registration skipped: it is already installed)`);
  warnIfUntrusted(target, log);
}

/** Both steps leave the same thing on disk to check: the grant in the project's settings. */
function checkGrant({ target }) {
  const file = settingsPath(target);
  if (!existsSync(file)) return { ok: false, problems: [".claude/settings.json is missing"] };
  let allow;
  try { allow = JSON.parse(readFileSync(file, "utf8")).permissions?.allow ?? []; }
  catch { return { ok: false, problems: [".claude/settings.json is not valid JSON"] }; }
  const missing = pipelineRules().filter((r) => !allow.includes(r));
  return { ok: !missing.length, problems: missing.map((r) => `the kernel grant lacks ${r}`) };
}

export const pluginInstallStep = {
  id: "claude-plugin-install",
  plan(ctx) {
    return [{ op: "run", describe: "install the plugin into Claude Code and merge the kernel permission grant into .claude/settings.json", fn: () => installClaude(ctx) }];
  },
  check: checkGrant,
};

export const grantStep = {
  id: "claude-grant",
  plan(ctx) {
    return [{ op: "run", describe: "merge the kernel permission grant into .claude/settings.json (the plugin is not registered again)", fn: () => grantClaude(ctx) }];
  },
  check: checkGrant,
};

export const agentImportStep = {
  id: "claude-md-import",
  plan({ target }) {
    const file = join(target, "CLAUDE.md");
    const has = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (has.includes("@AGENTS.md")) return [{ op: "note", text: "@AGENTS.md import tag already present in CLAUDE.md" }];
    if (!existsSync(file)) return [{ op: "write", path: file, content: "\n@AGENTS.md\n", note: "Appended @AGENTS.md import tag to CLAUDE.md" }];
    return [{ op: "append", path: file, content: "\n@AGENTS.md\n", note: "Appended @AGENTS.md import tag to CLAUDE.md" }];
  },
  check({ target }) {
    const file = join(target, "CLAUDE.md");
    const ok = existsSync(file) && readFileSync(file, "utf8").includes("@AGENTS.md");
    return { ok, problems: ok ? [] : ["CLAUDE.md does not import @AGENTS.md"] };
  },
};
