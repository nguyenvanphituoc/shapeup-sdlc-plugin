// 45 — the storage roots have exactly one home.
//
// WHY THIS TEST EXISTS (measured by grepping the shipped tree at v1.4.1, not theorized).
//
// The two harness roots were hard-coded in ~90 files, in TWO syntaxes:
//
//     "docs/shapeup-sdlc/<slug>/scopes/..."            568 string literals
//     join(cwd, "docs", "shapeup-sdlc", slug, ...)      48 segment-built sites
//
// A find/replace over the first set leaves the second pointing at the old root, with no error and
// no failing test — the script simply reads a directory that is not there and takes its fail-open
// branch. That is this project's recurring defect shape: a change that looks complete, produces no
// diagnostic, and is wrong. `lib/is-main.mjs` (a guard duplicated 18 times, inert under a symlinked
// install) and `lib/argv.mjs` (`rNaN-a1.json` written with exit 0) are the same bug at other layers,
// and both were closed the same way — one home for the duplicated thing, plus a test that no file
// may bypass it. This is that test for paths, and it is deliberately modelled on #11a.
//
// WHAT IT ASSERTS
//   (a) no runtime file names a storage root outside `lib/paths.mjs` — in either syntax;
//   (b) `paths.mjs` itself round-trips: every exported path function lands under one of the roots;
//   (c) the two roots stay POSIX strings, because they are interpolated into substrate globs that
//       `sandbox-guard` matches against forward-slash paths (a backslash silently stops matching).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("45. The storage roots have exactly one home (lib/paths.mjs)");
  // =============================================================================

  const PATHS_MODULE = "skills/tech-lead/scripts/lib/paths.mjs";
  const paths = await import(join(ROOT, PATHS_MODULE));

  // --- (a) no runtime file names a root outside paths.mjs --------------------
  //
  // Scope is RUNTIME code only. Prose (SKILL.md, docs) legitimately names paths — that is what
  // documentation is for, and doc drift is test #26's job. This test is about code that RESOLVES a
  // path, where a stale literal is invisible rather than merely stale.
  const SCAN_DIRS = ["hooks", "bin", "skills"];
  const SKIP = new Set([PATHS_MODULE]);

  const walk = (rel, out = []) => {
    for (const e of readdirSync(join(ROOT, rel))) {
      const p = `${rel}/${e}`;
      if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
      else if (p.endsWith(".mjs") && !SKIP.has(p)) out.push(p);
    }
    return out;
  };
  const files = SCAN_DIRS.flatMap((d) => walk(d));

  // Both syntaxes. The segment form is the one a find/replace misses, so it is matched explicitly
  // rather than relying on the literal form catching it.
  const LITERAL = /(?<!["'`\w-])(?:docs\/)?\.?shapeup-sdlc\//;
  const SEGMENTS = /join\([^)]*["'](?:docs|\.shapeup-sdlc|shapeup-sdlc|shapeup|\.shapeup)["']/;

  /** Strip comments and JSDoc so prose inside runtime files is not mistaken for a path resolution. */
  const codeOnly = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

  const offenders = [];
  for (const f of files) {
    const code = codeOnly(readFileSync(join(ROOT, f), "utf8"));
    code.split("\n").forEach((line, i) => {
      if (LITERAL.test(line) || SEGMENTS.test(line)) offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  if (offenders.length === 0) {
    ok(`no storage root is named outside ${PATHS_MODULE} (${files.length} runtime files scanned)`);
  } else {
    fail(`${offenders.length} file(s) resolve a harness path without ${PATHS_MODULE} — a root rename ` +
         `would silently miss these:\n    ${offenders.join("\n    ")}`);
  }

  // --- (b) every exported path function lands under a root -------------------
  const CWD = "/tmp/x";
  const roots = [paths.SHARED, paths.LOCAL];
  let checked = 0, stray = [];
  for (const [name, fn] of Object.entries(paths)) {
    if (typeof fn !== "function") continue;
    // Call with the arity the module uses: (cwd), (cwd, slug), (cwd, slug, id).
    let out;
    try { out = fn(CWD, "demo", "SC-01"); } catch { continue; }
    if (typeof out !== "string") continue;
    checked++;
    const rel = out.startsWith(CWD) ? relative(CWD, out) : out;
    if (!roots.some((r) => rel.split(/[/\\]/)[0] === r.split("/")[0])) stray.push(`${name}() → ${rel}`);
  }
  if (checked === 0) fail("paths.mjs exported no callable path builders — the module is not doing its job");
  else if (stray.length === 0) ok(`all ${checked} exported path builders land under a declared root`);
  else fail(`path builder(s) escaped both roots:\n    ${stray.join("\n    ")}`);

  // --- (c) roots stay POSIX ---------------------------------------------------
  for (const [label, root] of [["SHARED", paths.SHARED], ["LOCAL", paths.LOCAL]]) {
    if (typeof root !== "string") fail(`${label} must be a string, got ${typeof root}`);
    else if (root.includes("\\")) {
      fail(`${label} contains a backslash ("${root}") — it is interpolated into substrate globs, ` +
           `which sandbox-guard matches against forward-slash paths. A backslash stops matching silently.`);
    } else ok(`${label} is a POSIX root ("${root}") — safe to interpolate into a substrate glob`);
  }

  // --- (d) the glob builders never emit a platform separator -----------------
  const globs = [paths.globLocal("demo", "tasks", "**"), paths.globShared("demo", "scopes", "*.json")];
  if (globs.every((g) => !g.includes("\\"))) ok("glob builders emit POSIX separators");
  else fail(`a glob builder emitted a backslash: ${globs.join(", ")}`);
}
