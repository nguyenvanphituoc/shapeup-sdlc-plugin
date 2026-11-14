// Whether Claude Code will honour a PROJECT-scoped grant in this directory at all.
//
// A third failure layer, above the two in the grant banner, and the one that bites hardest in exactly
// the case the grant exists for. Measured 2026-08-14 (CC 2.1.232): in an untrusted workspace the CLI
// prints `Ignoring N permissions.allow entries from .claude/settings.json: this workspace has not
// been trusted.` and drops every one of them. A fresh clone in CI is untrusted by definition, so a
// perfectly correct rule set still grants nothing there. `-p` skips the trust *dialog*; it does not
// confer trust.
//
// This returns a fact, not a fix. The installer reports it; it deliberately does NOT write the
// trust flag, because trusting a directory is a decision about executing code from it and belongs
// to the person, not to a package running under `npx`.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

/**
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
