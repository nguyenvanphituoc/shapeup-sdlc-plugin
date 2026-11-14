// Installing the plugin into Claude Code, and the grant that lets its run entry points execute.
//
// This step is an act, not a file write: the claude CLI registers the marketplace in the live session
// and writes project settings itself. So the plan is one `run` operation; `--dry-run` describes it and
// `check()` reads the result back off disk.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { mergePipelinePermissions as mergeGrant, pipelineRules } from "../../grant.mjs";
import { isWorkspaceTrusted } from "./trust.mjs";

export const REPO = "nguyenvanphituoc/shapeup-sdlc-plugin";
export const MARKETPLACE_KEY = "nvptuoc-marketplace";
export const PLUGIN_KEY = "shapeup-sdlc-plugin@nvptuoc-marketplace";

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

function installClaude({ target, rel, log = console.log }) {
  const settingsFile = join(target, ".claude", "settings.json");
  mkdirSync(join(target, ".claude"), { recursive: true });

  // Primary path: the claude CLI. Single command strings + shell so Windows resolves claude.cmd;
  // every argument is a static constant, nothing user-controlled is interpolated.
  const sh = (cmd, opts = {}) => spawnSync(cmd, { shell: true, ...opts });
  const have = sh("claude --version", { stdio: "ignore" });
  if (have.status === 0) {
    log("  [claude] registering marketplace + installing plugin via claude CLI…");
    const add = sh(`claude plugin marketplace add --scope project ${REPO}`, { cwd: target, stdio: "inherit" });
    const ins = add.status === 0 ? sh(`claude plugin install --scope project ${PLUGIN_KEY}`, { cwd: target, stdio: "inherit" }) : add;
    if (ins.status === 0) {
      // The CLI registers the marketplace and enables the plugin; it does NOT know about the kernel
      // permission grant, so this path adds it, merged and never overwritten.
      let written = {};
      if (existsSync(settingsFile)) {
        try { written = JSON.parse(readFileSync(settingsFile, "utf8")); }
        catch (e) {
          console.error(`  [claude] plugin installed, but ${rel(settingsFile)} is not valid JSON (${e.message}) —`);
          console.error("           the kernel permission grant was NOT added. Copy it from .claude/settings.local.example.json.");
          return;
        }
      }
      mergePipelinePermissions(written, log);
      writeFileSync(settingsFile, JSON.stringify(written, null, 2) + "\n");
      log("  [claude] plugin installed at project scope + kernel permissions granted — run /reload-plugins to activate in a live session");
      warnIfUntrusted(target, log);
      return;
    }
    log("  [claude] Warning: claude CLI failed — falling back to writing settings.json directly");
  }

  // Fallback: merge settings.json natively.
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
  mergePipelinePermissions(settings, log);
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");
  log(`  [claude] merged marketplace + plugin + kernel permissions into ${rel(settingsFile)}`);
  log("  [claude] the plugin auto-enables on the next session opened in this directory");
  warnIfUntrusted(target, log);
}

export const pluginInstallStep = {
  id: "claude-plugin-install",
  plan(ctx) {
    return [{ op: "run", describe: "install the plugin into Claude Code and merge the kernel permission grant into .claude/settings.json", fn: () => installClaude(ctx) }];
  },
  check({ target }) {
    const file = join(target, ".claude", "settings.json");
    if (!existsSync(file)) return { ok: false, problems: [".claude/settings.json is missing"] };
    let allow;
    try { allow = JSON.parse(readFileSync(file, "utf8")).permissions?.allow ?? []; }
    catch { return { ok: false, problems: [".claude/settings.json is not valid JSON"] }; }
    const missing = pipelineRules().filter((r) => !allow.includes(r));
    return { ok: !missing.length, problems: missing.map((r) => `the kernel grant lacks ${r}`) };
  },
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
