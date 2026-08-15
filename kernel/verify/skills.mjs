#!/usr/bin/env node
// Worker-roster preflight — refuse a run whose workers are not on disk, before any spend.
//
// WHAT IT CATCHES. A dispatch against a plugin that is absent, disabled or a different version
// returns `<tool_use_error>Unknown skill</tool_use_error>`, and the sub-agent then does the craft
// itself from the prose already in its own prompt. `hooks/dispatch-receipt.mjs` makes that visible
// at ingest; this makes it visible at `init run`, before a single sub-agent has been paid for.
//
// WHAT IT HONESTLY CANNOT DO, stated here because a check that overclaims is worse than no check.
// It proves *these files exist at this root at this version*. It cannot prove the SESSION will
// resolve that copy — that is a property of how the CLI was launched (`--plugin-dir`, an enabled
// marketplace install, the right version among several), and only a live dispatch answers it. The
// orchestrator's first leg is a canary dispatch whose receipt is required for exactly that reason;
// this check and that canary are two halves, not two attempts at the same half.
//
// THE ROSTER IS DERIVED, NEVER SPELLED. It comes from `domain.schema.json#/$defs/WorkerName` — the
// same enum that decides which workers a WorkOrder may be addressed to. A hand-written list beside
// a schema enum is the drift this project exists to prevent: eight names beside a ten-member enum
// reads perfectly and is wrong, and the two it would omit (`translator`, `coach`) are exactly the
// ones a short run never reaches, so the omission would surface months later on the one run that did.
//
// THE ROOT IS DERIVED FROM THIS MODULE'S OWN LOCATION, not from `CLAUDE_PLUGIN_ROOT`: the env var is
// not reliably exported into a sub-agent's shell, and the kernel that is executing is already inside
// the plugin root. `--plugin-root <dir>` exists for fixtures, which must be able to describe a
// broken installation without breaking the installation under test.
//
// Usage:  node kernel/harness.mjs verify skills [--plugin-root <dir>] [--json] [--quiet]
// Exit:   0 = every worker resolved · 1 = one or more missing (named on stderr)

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runArgs } from "../lib/argv.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The plugin root, resolved from where this file actually is (`kernel/verify/` → repo root). */
export const PLUGIN_ROOT = resolve(HERE, "../..");

/**
 * The complete worker roster, read from the schema that defines it.
 *
 * @param {string} [root=PLUGIN_ROOT] - Plugin root the schema is read from.
 * @returns {string[]} Every member of `WorkerName`, in schema order.
 * @throws {Error} When the schema is missing or does not carry the enum — a kernel that cannot find
 *   its own domain registry has a broken installation, which is the very thing being checked.
 */
export function roster(root = PLUGIN_ROOT) {
  const schemaPath = join(root, "skills/tech-lead/schemas/domain.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const names = schema?.$defs?.WorkerName?.enum;
  if (!Array.isArray(names) || !names.length) {
    throw new Error(`${schemaPath} carries no $defs/WorkerName enum — the roster cannot be derived`);
  }
  return names;
}

/**
 * Resolve every worker in the roster against a plugin root.
 *
 * A worker is present when its `SKILL.md` is readable. That is the file the host loads to answer a
 * `Skill(...)` call, so its absence is the closest on-disk fact to "this dispatch will fail".
 *
 * @param {string} [root=PLUGIN_ROOT] - Plugin root to check.
 * @returns {{root:string, version:(string|null), name:(string|null), workers:Array<{worker:string,
 *   path:string, present:boolean}>, missing:string[]}} The full picture, including the version, so a
 *   wrong-version run is legible in the trace instead of silently green.
 */
export function resolveWorkers(root = PLUGIN_ROOT) {
  let version = null, name = null;
  try {
    const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
    version = manifest.version ?? null;
    name = manifest.name ?? null;
  } catch { /* an unreadable manifest is reported as null, never as a failure of its own */ }
  const workers = roster(root).map((worker) => {
    const path = join(root, "skills", worker, "SKILL.md");
    return { worker, path, present: existsSync(path) };
  });
  return { root, version, name, workers, missing: workers.filter((w) => !w.present).map((w) => w.worker) };
}

// ---------------------------------------------------------------------------
/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs verify skills [--plugin-root <dir>] [--json] [--quiet]",
  _: { arity: 0, max: 0 },
  "plugin-root": { type: "path" },
  json: { type: "flag" },
  quiet: { type: "flag" },
};

/**
 * Check the worker roster resolves, and say which copy of the plugin answered.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 when every worker resolved, 1 when any is missing.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  let report;
  try {
    report = resolveWorkers(args.pluginRoot ? resolve(args.pluginRoot) : PLUGIN_ROOT);
  } catch (e) {
    console.error(`  ✗ verify skills: ${e.message}`);
    process.exit(1);
  }
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!args.quiet) {
    // The root and the version are printed on the SUCCESS path too. A run against the wrong copy
    // of the plugin is green by every other measure; printing which copy answered is the only way
    // that shows up in a trace someone reads later.
    console.log(`plugin: ${report.name ?? "unknown"} ${report.version ?? "unknown version"}`);
    console.log(`root:   ${report.root}`);
    console.log(`workers: ${report.workers.length - report.missing.length}/${report.workers.length} resolved`);
  }
  if (report.missing.length) {
    console.error(`  ✗ verify skills: ${report.missing.length} worker skill(s) missing under ${report.root}:`);
    for (const w of report.workers.filter((x) => !x.present)) console.error(`      ${w.worker} — no SKILL.md at ${w.path}`);
    console.error(`    This plugin copy cannot run the pipeline. Load the working copy with`);
    console.error(`    \`claude --plugin-dir <repo>\`, or install/enable the plugin, then retry.`);
    process.exit(1);
  }
  process.exit(0);
}
