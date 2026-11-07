// grant — the permission rules that let the harness run its own kernel.
//
// WHY THIS IS ITS OWN MODULE. The installer writes these rules and the structural suite has to
// check them. Checking them by regex-parsing `bin/init.mjs`'s source is how a grant that matched
// no command at all once stayed green for three releases: the test re-derived what it expected
// instead of asking the code what it emits. Exporting the generator is the fix — every caller gets
// the same strings from the same function, or fails.
//
// HOW A BASH RULE ACTUALLY MATCHES (measured 2026-08-14 against Claude Code 2.1.232; every row was
// a real session whose verdict was whether the target script's marker file landed on disk, never
// what the model said about it). There are TWO rule syntaxes and they do not behave alike:
//
//   Bash(<prefix>:*)     PREFIX match. Compared literally; a `*` inside the prefix is an ordinary
//                        asterisk. Matching is at COMPLETE ARGUMENT BOUNDARIES — the command must
//                        equal the prefix or begin with `<prefix> `. A prefix ending mid-argument
//                        (`…/scripts/:*`) therefore grants NOTHING.
//   Bash(<pattern> *)    GLOB match, anchored end to end. Here `*` expands, and it crosses `/`.
//
// Two further facts shape what we emit:
//   - A rule's `${CLAUDE_PLUGIN_ROOT}` is NOT expanded. Rules are read from the user's project
//     settings, where that token has no meaning; measured DENIED against an expanded command.
//   - A SKILL's `${CLAUDE_PLUGIN_ROOT}` IS expanded, at skill-load time, before the model reads it.
//     So the command that reaches the matcher already carries an absolute, quoted path.
//
// WHAT WE EMIT — the whole grant, two lines:
//
//     Bash(node "*/kernel/harness.mjs" *)
//     Bash(node "*/kernel/harness.mjs")
//
//   - GLOB syntax, not prefix, because the installer CANNOT know the path the rule must match.
//     `npx shapeup-sdlc init` runs from an npm tarball; Claude Code loads the plugin from
//     `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. A glob spans both, and the `*`
//     is what makes the grant survive a plugin UPGRADE — an exact path would silently un-grant the
//     harness on every version bump.
//   - The QUOTED form is the one the skills emit, so an install path containing a space does not
//     break the command. Closing the quote INSIDE the rule is what makes it match.
//   - TWO rules, because the trailing ` *` requires at least one argument: a bare
//     `node "<path>"` is DENIED by the ` *` form and needs the bare form as well.
//   - The root is a bare `*`, NOT anchored on the plugin's directory name. Anchoring breaks every
//     development and local install (a `--plugin-dir` checkout is named whatever the user cloned
//     it to) and buys no security: anyone able to plant a script at `/tmp/x/kernel/harness.mjs`
//     can equally plant one at `/tmp/x/shapeup-sdlc-plugin/9.9.9/kernel/harness.mjs`.
//
// WHY TWO LINES AND NOT FORTY. Through v1.8 the grant enumerated every pipeline script — two rules
// each, regenerated whenever a script was added, renamed or removed, and silently wrong whenever
// that regeneration was missed. v2.0 gives the deterministic half of the harness ONE executable
// (`kernel/harness.mjs`, subcommands beneath it), so the grant is a constant a person can read and
// verify by eye. Scope is unchanged in kind and narrower in fact: one dependency-free, network-free
// script that ships with the plugin. It grants no general `Bash(node:*)`.
//
// NO `Workflow` TOKEN. The run is driven by the loop in the session, not launched as a script, so
// nothing here needs the unscoped `Workflow` permission and the installer does not add it. It does not
// remove it either: a project may rely on that token for workflow scripts of its own, so a token already
// in a user's settings is the user's, and the merge below leaves it exactly where it is.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

/** The kernel's path inside the installed plugin — the one executable the grant has to cover. */
export const KERNEL_ENTRY = "kernel/harness.mjs";

/**
 * The `permissions.allow` rules for the harness kernel.
 *
 * Constant — deliberately not derived from the filesystem. A grant computed from a directory
 * listing is a grant that changes silently when the listing does; with one entry point there is
 * nothing left to enumerate.
 *
 * @returns {string[]} The two Bash rules, sorted.
 */
export function pipelineRules() {
  const pattern = `node "*/${KERNEL_ENTRY}"`;
  return [`Bash(${pattern} *)`, `Bash(${pattern})`].sort();
}

/**
 * True for a rule this plugin has ever written and no longer wants in a user's settings.
 *
 * Two generations are purged: the v1.5–v1.8 prefix rules (which granted nothing), and the
 * per-script glob rules v1.8 replaced them with (superseded by the single kernel entry point).
 * Leaving either behind turns a user's settings into a museum of dead grants and hides which rules
 * are live, so the installer purges rather than merging alongside.
 *
 * @param {string} rule - One entry from `permissions.allow`.
 * @returns {boolean} Whether the installer should drop it.
 */
export function isSupersededRule(rule) {
  return /^Bash\(node "?\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/[a-z-]+\/scripts\/:\*\)$/.test(rule)
    || /^Bash\(node "\*\/skills\/[a-z-]+\/scripts\/[\w.-]+\.mjs"( \*)?\)$/.test(rule);
}

/**
 * Whether Claude Code will honour a PROJECT-scoped grant in this directory at all.
 *
 * A third failure layer, above the two in the banner, and the one that bites hardest in exactly the
 * case the grant exists for. Measured 2026-08-14 (CC 2.1.232): in an untrusted workspace the CLI
 * prints `Ignoring N permissions.allow entries from .claude/settings.json: this workspace has not
 * been trusted.` and drops every one of them. A fresh clone in CI is untrusted by definition, so a
 * perfectly correct rule set still grants nothing there. `-p` skips the trust *dialog*; it does not
 * confer trust.
 *
 * This returns a fact, not a fix. The installer reports it; it deliberately does NOT write the
 * trust flag, because trusting a directory is a decision about executing code from it and belongs
 * to the person, not to a package running under `npx`.
 *
 * @param {string} projectDir - The project directory being installed into.
 * @returns {(boolean|null)} True/false when `~/.claude.json` is readable, null when it is not.
 */
export function isWorkspaceTrusted(projectDir) {
  const cfg = join(homedir(), ".claude.json");
  if (!existsSync(cfg)) return null;
  try {
    const projects = JSON.parse(readFileSync(cfg, "utf8"))?.projects || {};
    return projects[resolve(projectDir)]?.hasTrustDialogAccepted === true;
  } catch { return null; }
}

/**
 * Merge the harness grant into a parsed settings object, in place.
 *
 * Adds the two kernel rules and drops only the rules this plugin itself once wrote and superseded;
 * every other entry — a user's own rule, a `Workflow` token — is left alone.
 *
 * @param {object} settings - Parsed settings.json.
 * @returns {void}
 */
export function mergePipelinePermissions(settings) {
  settings.permissions = settings.permissions || {};
  const allow = new Set(settings.permissions.allow || []);
  for (const r of [...allow]) if (isSupersededRule(r)) allow.delete(r);
  for (const r of pipelineRules()) allow.add(r);
  settings.permissions.allow = [...allow].sort();
}
