// isMain — "was this module executed directly, or imported?"
//
// WHY THIS FILE EXISTS (observed, not theorized).
//
// Eighteen of this plugin's scripts and hooks decided whether to do anything at all with:
//
//     if (import.meta.url === `file://${process.argv[1]}`) main();
//
// That comparison is FALSE — and the whole body silently does nothing, exit 0, no output —
// whenever the path the process was invoked with is not byte-identical to the resolved module
// URL. Two extremely common cases make it false:
//
//  1. A SYMLINKED DIRECTORY ANYWHERE IN THE PATH. Node resolves `import.meta.url` through
//     symlinks; `process.argv[1]` is the string as typed. On macOS `/var` is a symlink to
//     `/private/var`, so EVERY path under the system temp directory mismatches — which is where
//     an npm-packed install lands (`/var/folders/…/package`). nvm, pnpm's content store,
//     Homebrew and any symlinked checkout do the same thing on every platform.
//
//  2. A SPACE OR OTHER URL-RESERVED CHARACTER IN THE PATH. `import.meta.url` is percent-encoded
//     (`My%20Plugins`); the template literal is not (`My Plugins`). So a plugin installed under
//     `~/Library/Application Support/…` or any directory with a space in its name mismatches too.
//
// WHAT THAT COSTS. `init-run.mjs` is GATE L0.1 — the orchestrator's mandatory first tool call, the
// script that writes the run receipt everything else is derived from. Under a `/var` path it
// exited 0 with empty stdout and wrote no receipt. The orchestrator then cannot distinguish "the
// run opened" from "nothing happened", and burns its budget on forensics against its own
// bootstrap — retrying the script several ways, hitting permission refusals trying to capture an
// exit code, and finally searching the filesystem for its own skill — while the artifact it needs
// sits on disk the entire time.
//
// The same guard sits in seven hooks, including `gate-zerowork`, `safety-spine` and
// `sandbox-guard`. This project's stated organising idea is that "every invariant that matters
// lives in the runtime, not in a prompt" — and under a symlinked install the runtime half was
// inert, while every gate still reported success. A silent no-op is the single worst failure mode
// an enforcement layer can have, because it is indistinguishable from working.
//
// THE FIX. Compare resolved URL to resolved URL, using `pathToFileURL` so encoding matches and
// `realpathSync` so symlinks match. The structural suite asserts that no file
// reintroduces the fragile form, and actually executes each entry point through a symlinked
// directory AND through a directory with a space in its name to prove the guard holds — because
// this defect was invisible to every test that invoked scripts by their real path.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * True when `moduleUrl` belongs to the module Node was asked to execute.
 *
 * Usage, at the bottom of an entry point:
 *
 *     import { isMain } from "./lib/is-main.mjs";
 *     if (isMain(import.meta.url)) main();
 *
 * @param {string} moduleUrl - The caller's `import.meta.url`.
 * @returns {boolean} true if executed directly, false if imported (or if there is no entry point,
 *   e.g. `node --eval`, where nothing should auto-run).
 */
export function isMain(moduleUrl) {
  const entry = process.argv[1];
  if (!entry || !moduleUrl) return false;

  // Cheap path first: correct encoding, no filesystem access. Handles spaces and unicode.
  let entryUrl;
  try { entryUrl = pathToFileURL(entry).href; } catch { return false; }
  if (entryUrl === moduleUrl) return true;

  // Then resolve symlinks on both sides. `import.meta.url` is already realpath-resolved by Node,
  // but resolving it again is harmless and covers the reverse case (a caller passing an
  // unresolved URL) rather than assuming Node's behaviour never changes.
  try {
    const realEntry = pathToFileURL(realpathSync(entry)).href;
    if (realEntry === moduleUrl) return true;
    return realEntry === pathToFileURL(realpathSync(new URL(moduleUrl))).href;
  } catch {
    // An unreadable or deleted entry point is not this function's problem to report. Returning
    // false means "do not auto-run", which is the safe direction for an imported module and is
    // never the direction that silently skips a gate — a directly-invoked script whose own path
    // cannot be stat'd has larger problems that will surface immediately.
    return false;
  }
}
