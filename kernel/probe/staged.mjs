// staged — is the orchestrator this launch will execute the one that is installed?
//
// A run stages its own copy of the workflow scripts into the local tier when it is OPENED, and
// keeps that copy for the run's life. That is deliberate and right: an upgrade must not swap the
// orchestrator under a run in flight. The consequence is not obvious from anywhere a person about
// to soak an upgrade would look — relaunching an existing run after installing a new version
// executes the OLD orchestrator, reports normally, closes normally, and every observation made of
// it is an observation of the previous release. That is worse than a failed soak: it is confident
// evidence about the wrong artifact.
//
// So the launch compares, and says so. A warning, never a block — the run keeping its copy is the
// correct behaviour, and the operator is the one who decides whether this run is the one they
// meant to measure.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { workflowsStage, receipt, readReceipt } from "../lib/paths.mjs";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** A file's digest, or null when it cannot be read. */
function digestOf(path) {
  try { return sha256(readFileSync(path)); } catch { return null; }
}

/** The version the plugin at `pluginRoot` declares, or null. */
export function installedPluginVersion(pluginRoot) {
  if (!pluginRoot) return null;
  try { return JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")).version ?? null; }
  catch { return null; }
}

/**
 * How the orchestrator this launch will run compares with the one installed.
 *
 * @param {string} cwd - Project root.
 * @param {(string|null)} pluginRoot - The installed plugin's root, as the launch knows it.
 * @param {(string|null)} [slug] - The run, when the caller knows it — for the version the run opened under.
 * @returns {object} `{checked, drift, staged_dir, plugin_root, installed_version, run_version}`.
 *   `drift` lists each script whose staged copy differs from the installed one; `checked: false`
 *   means the comparison could not be made (no plugin root, or nothing staged), which is not the
 *   same fact as "they agree" and is reported as itself.
 */
export function stagedWorkflowDrift(cwd, pluginRoot, slug = null) {
  const stagedDir = workflowsStage(cwd);
  const srcDir = pluginRoot ? join(pluginRoot, "skills", "tech-lead", "workflows") : null;
  const out = {
    checked: false,
    drift: [],
    staged_dir: stagedDir,
    plugin_root: pluginRoot ?? null,
    installed_version: installedPluginVersion(pluginRoot),
    run_version: slug ? (readReceipt(receipt(cwd, slug))?.plugin?.version ?? null) : null,
  };
  if (!srcDir || !existsSync(srcDir) || !existsSync(stagedDir)) return out;
  let names;
  try { names = readdirSync(stagedDir).filter((f) => f.endsWith(".js")).sort(); } catch { return out; }
  if (!names.length) return out;
  out.checked = true;
  for (const f of names) {
    const staged = digestOf(join(stagedDir, f));
    const installed = digestOf(join(srcDir, f));
    // A script the installed plugin no longer carries is drift too — the staged copy is running
    // something that has no counterpart in what is installed.
    if (staged !== installed) out.drift.push({ file: f, staged_sha256: staged, installed_sha256: installed });
  }
  return out;
}

/**
 * The one-line warning a launch prints, or null when there is nothing to say.
 * @param {object} d - A {@link stagedWorkflowDrift} result.
 * @returns {(string|null)} Operator-facing text naming both versions.
 */
export function driftWarning(d) {
  if (!d?.checked || !d.drift.length) return null;
  const versions = d.run_version && d.installed_version && d.run_version !== d.installed_version
    ? ` The run opened under plugin ${d.run_version}; ${d.installed_version} is installed.`
    : d.installed_version ? ` Installed plugin: ${d.installed_version}.` : "";
  return `the orchestrator this launch runs is NOT the installed one — ${d.drift.length} staged script(s) differ `
    + `(${d.drift.map((x) => x.file).join(", ")}).${versions} A run keeps the copy it opened with, by design, so this `
    + `launch measures the release the run was opened under. Open a NEW run to soak an upgrade.`;
}
