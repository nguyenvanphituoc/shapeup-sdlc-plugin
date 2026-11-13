// fence — the write fence's decision, free of any workflow: which live contract covers a write, which
// freezes it, which owns it, and whether it is append-only. The hook that calls this supplies the live
// contracts (read from its own order set), the path a write lands on and the run trace it must not touch.
//
// A substrate glob is a SPELLING; what it protects is a FILE. So the comparison is made on the resolved
// real path, case-folded when the filesystem itself folds case, and the globs stay exactly as written.

import { existsSync, realpathSync, lstatSync, readlinkSync } from "node:fs";
import { resolve, join, relative, dirname, basename } from "node:path";

// --- tiny glob matcher: supports *, **, ? — enough for substrate globs, zero dependencies ---
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Does `relPath` match any of `globs`? With `fold` set, both sides are compared case-folded — the
 * caller passes it when the filesystem underneath does not distinguish case, so that a glob
 * declared as `receipts/**` also covers the spelling `Receipts/**`, which on that filesystem is the
 * same directory.
 */
export function matchesAny(relPath, globs, fold = false) {
  const path = fold ? relPath.toLowerCase() : relPath;
  return (globs || []).some((g) => globToRegExp(fold ? g.toLowerCase() : g).test(path));
}

// --- the path a write actually lands on ---------------------------------------------------------
//
// A substrate glob is a SPELLING; what it protects is a FILE. Measured against a real compiled
// order: `<trace>/<slug>/receipts/dispatch.jsonl` was denied as frozen, `Receipts/dispatch.jsonl`
// was permitted, and on this machine's case-insensitive filesystem the second spelling overwrote
// the first file. A symlink was the same hole from another side: `src/x -> ../<trace>/<slug>/legs.jsonl`
// sits inside an allowed `src/**` and resolves `..` without following the link, so the write went
// through. No list of globs can close either — case, links, Unicode forms are all further spellings
// of one target — so the comparison is made on the resolved real path instead, and case-folded when
// the filesystem itself folds case. The globs stay exactly as the compiler wrote them.

/**
 * Resolve `abs` through the filesystem: symlinks in any existing ancestor are followed (a dangling
 * link is followed by reading it), and the part that does not exist yet is re-attached to the real
 * path of the deepest ancestor that does. A path nothing on disk can resolve is returned as given.
 *
 * @param {string} abs - Absolute path as the tool named it.
 * @param {number} [depth] - Recursion guard for link chains.
 * @returns {string} The path the write would actually reach.
 */
export function realPathOf(abs, depth = 0) {
  if (depth > 40) return abs;
  let cur = abs;
  const tail = [];
  for (let i = 0; i < 128; i++) {
    try { return join(realpathSync.native(cur), ...[...tail].reverse()); } catch { /* not yet resolvable as a whole */ }
    try {
      if (lstatSync(cur).isSymbolicLink()) {
        const target = resolve(dirname(cur), readlinkSync(cur));
        return realPathOf(join(target, ...[...tail].reverse()), depth + 1);
      }
    } catch { /* does not exist at all — climb */ }
    const parent = dirname(cur);
    if (parent === cur) return abs;
    tail.push(basename(cur));
    cur = parent;
  }
  return abs;
}

/**
 * Does the filesystem under `dir` fold case? Decided by asking it: the directory's own real path,
 * with every letter's case swapped, exists and resolves back to the same real path only where the
 * filesystem does not distinguish case. A path with no letters to swap answers "no".
 *
 * @param {string} dir - An existing directory (the project root).
 * @returns {boolean} True on a case-insensitive filesystem.
 */
export function fsFoldsCase(dir) {
  const swapped = dir.replace(/[a-zA-Z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));
  if (swapped === dir) return false;
  try { return existsSync(swapped) && realpathSync.native(swapped) === realpathSync.native(dir); } catch { return false; }
}


/**
 * Judge each target path of one write against the live contracts.
 *
 * Order matters and is load-bearing: `own` (only against the contract that declared it, and only from the
 * dispatch that took that order), then `frozen` across EVERY live contract (before the run-trace
 * carve-out, or every freeze inside the trace is inert), then the run-trace carve-out, then `allowed`,
 * then `append-only`, else outside every substrate.
 *
 * @param {object} o - Destructured:
 * @param {string[]} o.paths - Where each target of the write lands (resolved real paths).
 * @param {string} o.realRoot - The project root, resolved the same way.
 * @param {Array<{order_id:string, allowed:string[], appendOnly:string[], frozen:string[], own:string[]}>} o.contracts - The live contracts.
 * @param {Map<string,string>} o.agents - order_id -> the agent that took the dispatch, where attributable.
 * @param {string} o.tool - The write tool (`Write` overwrites; an append-only path takes edits).
 * @param {(string|null)} o.writer - The sub-agent making the write, or null for the operator's own session.
 * @param {string} o.tracePrefix - The run trace's repo-relative prefix, which the carve-out lets a worker keep current.
 * @returns {{violations:string[], blockReasons:string[], frozenHits:number, fold:boolean}}
 */
export function judgeWrites({ paths, realRoot, contracts, agents, tool, writer, tracePrefix }) {
  const fold = fsFoldsCase(realRoot);
  const under = (rel, prefix) => (fold ? rel.toLowerCase().startsWith(prefix.toLowerCase()) : rel.startsWith(prefix));
  const violations = [];
  const blockReasons = [];
  let frozenHits = 0;
  for (const target of paths) {
    const abs = realPathOf(resolve(target));
    const rel = relative(realRoot, abs);
    const owners = contracts.filter((c) => matchesAny(rel, c.own, fold));
    if (owners.length) {
      if (!writer || owners.some((c) => !agents.has(c.order_id) || agents.get(c.order_id) === writer)) continue;
      violations.push(rel);
      blockReasons.push(`${rel} belongs to ${owners.map((c) => c.order_id).join(", ")}, whose dispatch is another agent's`);
      continue;
    }
    const freezer = contracts.find((c) => matchesAny(rel, c.frozen, fold));
    if (freezer) {
      violations.push(rel);
      frozenHits++;
      blockReasons.push(`${rel} is frozen by ${freezer.order_id}`);
      continue;
    }
    if (under(rel, tracePrefix)) continue;
    if (contracts.some((c) => matchesAny(rel, c.allowed, fold))) continue;
    if (contracts.some((c) => matchesAny(rel, c.appendOnly, fold))) {
      if (tool === "Write") {
        violations.push(rel);
        blockReasons.push(`${rel} is append-only (Write overwrites, use Edit)`);
      }
      continue;
    }
    violations.push(rel);
    blockReasons.push(`${rel} is outside every live order's allowed scopes`);
  }
  return { violations, blockReasons, frozenHits, fold };
}
