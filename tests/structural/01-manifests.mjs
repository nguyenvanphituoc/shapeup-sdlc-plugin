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

  // =============================================================================
  section("55. Every source file in the repo is text a line-oriented tool can read");
  // =============================================================================
  // WHY THIS EXISTS (found by an audit that its own grep could not complete).
  //
  // A shipped library was written with LITERAL NUL bytes in a template literal — the field
  // separator in a hash input, typed as raw control characters instead of `\u0000` escapes. Node
  // parsed it, every test passed, and the module behaved correctly. But `file(1)` classified it as
  // `data`, and a NUL makes grep treat a file as binary: `grep -rn` over the shipped tree silently
  // SKIPPED it. The repo's non-delivered-content sweep runs on exactly that grep, so the file was
  // invisible to the audit — and it was hiding a real finding, a citation into a `docs/` path a
  // user does not receive.
  //
  // That is the failure this repo names as its own recurring shape: a change that looks complete,
  // produces no error, and is wrong. The check is cheap and general — the harm is not the byte, it
  // is that one unreadable file turns every grep-based guarantee over the tree into a claim about
  // an unknown subset. A skipped file and a clean file must not look the same from outside.
  //
  // ⟐ THE SCOPE IS THE WHOLE REPO, and that correction is the finding's second half. Written to
  // cover only the shipped roots, this check could not see ITSELF: the same keystroke that put a
  // NUL in the library put one in this module's own comment and one in the CHANGELOG entry
  // describing the defect, and only `git` noticed — `Bin 2484 -> 5746 bytes` in the commit stat.
  // A guard scoped more narrowly than the mistake it guards against is the shape of every defect
  // above it. `docs/` and `tests/` do not ship, but a doc or a test no grep can read defeats an
  // audit just as completely, so readability is a property of the TREE, not of the package.
  {
    const ROOTS = ["bin", "skills", "hooks", "commands", "oracles", "docs", "tests", "tools", "scripts"];
    // README and CHANGELOG carry no `files[]` entry but npm publishes them anyway, and they are the
    // densest prose in the package.
    const LOOSE = ["AGENTS.md", "SECURITY.md", "README.md", "CHANGELOG.md", "CLAUDE.md", "CONTRIBUTING.md"];
    const SRC = /\.(mjs|js|json|md|sh|yml|yaml)$/;
    const collect = (rel, out = []) => {
      for (const e of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
        const p = `${rel}/${e.name}`;
        if (e.isDirectory()) collect(p, out);
        else if (SRC.test(e.name)) out.push(p);
      }
      return out;
    };
    const files = [
      ...ROOTS.filter((r) => existsSync(join(ROOT, r))).flatMap((r) => collect(r)),
      ...LOOSE.filter((f) => existsSync(join(ROOT, f))),
    ];
    const binary = [];
    for (const f of files) {
      const buf = readFileSync(join(ROOT, f));
      // NUL is what actually flips grep to binary mode. Other C0 controls (except tab/CR/LF) are
      // reported too: none of them belongs in source, and each is equally invisible in review.
      const bad = [];
      for (let i = 0; i < buf.length; i++) {
        const b = buf[i];
        if (b === 0 || (b < 32 && b !== 9 && b !== 10 && b !== 13)) { bad.push(`0x${b.toString(16)}@${i}`); break; }
      }
      if (bad.length) binary.push(`${f} (${bad[0]})`);
    }
    if (binary.length === 0) {
      ok(`all ${files.length} source files are control-character-free — every grep over the tree sees the whole tree`);
    } else {
      fail(`file(s) carry control characters, so grep skips them as binary and every ` +
           `content sweep silently under-reports:\n    ${binary.join("\n    ")}`);
    }
  }
}
