// Structural test module: manifests. Split out of tests/structural.mjs (Track C).
// Sections: 1. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the manifests structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;

  // =============================================================================
  section("1. Plugin & marketplace manifests parse and agree");
  // =============================================================================
  const pluginPath = join(ROOT, ".claude-plugin/plugin.json");
  const marketPath = join(ROOT, ".claude-plugin/marketplace.json");
  const pkgPath = join(ROOT, "package.json");

  let plugin, market, pkg;
  try { plugin = readJSON(pluginPath); ok("plugin.json parses"); }
  catch (e) { fail(`plugin.json does not parse: ${e.message}`); }
  try { market = readJSON(marketPath); ok("marketplace.json parses"); }
  catch (e) { fail(`marketplace.json does not parse: ${e.message}`); }
  try { pkg = readJSON(pkgPath); ok("package.json parses"); }
  catch (e) { fail(`package.json does not parse: ${e.message}`); }

  if (plugin) {
    for (const f of ["name", "version", "description"]) {
      if (!plugin[f]) fail(`plugin.json missing required field "${f}"`); else ok(`plugin.json has ${f}`);
    }
  }
  if (plugin && pkg && plugin.version !== pkg.version) {
    fail(`version drift: plugin.json=${plugin.version} but package.json=${pkg.version}`);
  } else if (plugin && pkg) ok(`versions agree (${plugin.version})`);

  if (market && plugin) {
    const named = (market.plugins || []).some((p) => p.name === plugin.name);
    if (!named) fail(`marketplace.json does not list plugin "${plugin.name}"`);
    else ok(`marketplace lists ${plugin.name}`);
  }

}
