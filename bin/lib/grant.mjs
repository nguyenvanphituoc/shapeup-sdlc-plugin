// grant — the permission rules that let the harness run its own pipeline scripts.
//
// WHY THIS IS ITS OWN MODULE. The installer writes these rules and the structural suite has to
// check them. For three releases the suite checked them by REGEX-PARSING `bin/init.mjs`'s source
// for a `const OWNERS = [...]` literal, which is how a grant that matched no command at all stayed
// green: the test re-derived what it expected instead of asking the code what it emits. Exporting
// the generator is the fix — every caller gets the same strings from the same function, or fails.
//
// HOW A BASH RULE ACTUALLY MATCHES (measured 2026-08-14 against Claude Code 2.1.232; every row of
// the table below was a real session whose verdict was whether the target script's marker file
// landed on disk, never what the model said about it).
//
// There are TWO rule syntaxes and they do not behave alike:
//
//   Bash(<prefix>:*)     PREFIX match. The rule is compared literally against the command; a `*`
//                        inside the prefix is an ordinary asterisk, matching nothing but itself.
//                        Matching is at COMPLETE ARGUMENT BOUNDARIES — the command must equal the
//                        prefix or begin with `<prefix> ` (prefix + space).
//   Bash(<pattern> *)    GLOB match, anchored end to end. Here `*` expands, and it crosses `/`.
//
// The rules this plugin shipped through v1.8.0 were of the first kind and ended MID-ARGUMENT:
//
//     Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/:*)
//
// A real command is `node <root>/skills/tech-lead/scripts/init-run.mjs …`, which neither equals
// that prefix nor begins with it followed by a space, because `scripts/` is the middle of a path
// argument. The rule granted NOTHING, on every install, since it was introduced. Two further facts
// each independently doomed it:
//
//   - A rule's `${CLAUDE_PLUGIN_ROOT}` is NOT expanded. Rules are read from the user's project
//     settings, where that token has no meaning; measured DENIED against an expanded command.
//   - A SKILL's `${CLAUDE_PLUGIN_ROOT}` IS expanded, at skill-load time, before the model reads it.
//     So the command that reaches the matcher already carries an absolute, quoted path — the one
//     shape the shipped rule could never match.
//
// WHAT WE EMIT, AND WHY EACH PIECE IS LOAD-BEARING:
//
//     Bash(node "*/skills/<owner>/scripts/<name>.mjs" *)
//     Bash(node "*/skills/<owner>/scripts/<name>.mjs")
//
//   - GLOB syntax, not prefix — because the installer CANNOT know the path the rule must match.
//     `npx shapeup-sdlc init` runs from an npm tarball; Claude Code loads the plugin from
//     `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. Different directories. A glob
//     spans both, and the `*` in the version segment is what makes the grant survive a plugin
//     UPGRADE — an exact path would silently un-grant the harness on every version bump, which is
//     the same invisible-until-first-dispatch failure this defect already cost us once.
//   - The QUOTED form is the one the skills emit (v1.5 adopted quoting so an install path
//     containing a space would not break the command — `lib/is-main.mjs` records that as measured,
//     not hypothetical). Closing the quote INSIDE the rule is what makes it match; a rule with an
//     unclosed quote matches nothing, which is the other half of the shipped defect.
//   - TWO rules per script, because the trailing ` *` requires at least one argument: a bare
//     `node "<path>"` with no flags is DENIED by the ` *` form and needs the bare form as well.
//   - The root is a bare `*`, NOT anchored on the plugin's directory name. Anchoring was the first
//     thing tried and it is wrong twice over. It breaks every development and local install — a
//     `--plugin-dir` checkout is named whatever the user cloned it to, and this repo's own is
//     `proj-harness-plugin` — so the anchor would grant marketplace installs and silently deny
//     everyone building on the plugin. And it buys no security: anyone able to plant a script at
//     `/tmp/x/skills/tech-lead/scripts/init-run.mjs` can equally plant one at
//     `/tmp/x/shapeup-sdlc-plugin/9.9.9/skills/tech-lead/scripts/init-run.mjs`. The suffix
//     `skills/<owner>/scripts/<name>.mjs` is what identifies the script; the prefix is not a
//     boundary, and pretending otherwise costs real installs for imagined safety.
//
// Scope stays deliberately narrow: the harness's own deterministic, dependency-free, network-free
// scripts. It grants no general `Bash(node:*)`, which would be a much larger ask for a much
// smaller reason.
//
// A DOCUMENTED ALTERNATIVE, for anyone who would rather read six lines than forty: the per-owner
// directory glob `Bash(node "*/shapeup-sdlc-plugin/*/skills/<owner>/scripts/*.mjs" *)`. That is
// precisely what the broken rule was trying to say. Its only privilege delta is that `*` crosses
// `/`, so it also covers `scripts/lib/*.mjs` — this plugin's own libraries, in its own read-only
// install directory. Per-script enumeration is the shipped default.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every shipped pipeline entry point, read off the package being installed.
 *
 * Derived from the filesystem rather than a hand-maintained list, so a new script cannot ship
 * ungranted and an removed one cannot leave a rule behind. `scripts/lib/` is skipped because a
 * library is imported, never invoked — it needs no grant.
 *
 * @param {string} pkgRoot - Root of the package/plugin to enumerate.
 * @returns {string[]} Repo-relative paths, e.g. `skills/tech-lead/scripts/init-run.mjs`, sorted.
 */
export function pipelineEntryPoints(pkgRoot) {
  const out = [];
  const skills = join(pkgRoot, "skills");
  if (!existsSync(skills)) return out;
  for (const owner of readdirSync(skills).sort()) {
    const dir = join(skills, owner, "scripts");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) {
      if (f.endsWith(".mjs")) out.push(`skills/${owner}/scripts/${f}`);
    }
  }
  return out;
}

/**
 * The `permissions.allow` rule set for a package's pipeline scripts.
 *
 * @param {string} pkgRoot - Root of the package/plugin to enumerate.
 * @returns {string[]} Rule strings, two per entry point, sorted.
 */
export function pipelineRules(pkgRoot) {
  return pipelineEntryPoints(pkgRoot)
    .flatMap((rel) => {
      const pattern = `node "*/${rel}"`;
      return [`Bash(${pattern} *)`, `Bash(${pattern})`];
    })
    .sort();
}

/**
 * True for a rule this plugin has ever written and no longer wants in a user's settings.
 *
 * The v1.5–v1.8 prefix rules granted nothing. Leaving them behind on upgrade turns a user's
 * settings into a museum of dead grants and hides which rules are actually live, so the installer
 * purges them rather than merging alongside them.
 *
 * @param {string} rule - One entry from `permissions.allow`.
 * @returns {boolean} Whether the installer should drop it.
 */
export function isSupersededRule(rule) {
  return /^Bash\(node "?\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/[a-z-]+\/scripts\/:\*\)$/.test(rule);
}

/**
 * Merge the pipeline grant into a parsed settings object, in place.
 *
 * @param {object} settings - Parsed settings.json.
 * @param {string} pkgRoot - Root of the package/plugin to enumerate.
 * @returns {void}
 */
export function mergePipelinePermissions(settings, pkgRoot) {
  settings.permissions = settings.permissions || {};
  const allow = new Set(settings.permissions.allow || []);
  for (const r of [...allow]) if (isSupersededRule(r)) allow.delete(r);
  for (const r of pipelineRules(pkgRoot)) allow.add(r);
  settings.permissions.allow = [...allow].sort();
}
