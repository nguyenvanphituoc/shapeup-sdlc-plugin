// ratchet-tree — `keep(commit)` and `revert(commit)` for the T0 attempt loop.
//
// WHY THIS FILE EXISTS.
//
// The attempt loop branched a red T0 two ways, and only one of them reverted anything:
//
//   • a SEESAW regression (a previously-finished scope broke) → `git stash push -u`;
//   • a red on the scope's OWN fixtures → "loop to the next attempt", and no revert at all.
//
// So the failing tree stayed on the branch, and attempt N+1's fresh, zero-memory subagent began
// from code it did not write, cannot see the history of, and is told about only through error
// strings. The paper's `revert(commit)` is the MORE COMMON branch, and it was the absent one.
//
// Under a ratchet there is one rule for both (see `t0-verify.mjs` → `decideStatus`): keep the tree
// when the score strictly improved, restore the last kept tree when it did not.
//
// NO COMMITS ON THE BRANCH UNDER TEST. The harness's standing convention is that it never writes
// commits to the user's branch, so the snapshot is a `git stash create` object published under a
// SHADOW REF — `refs/shapeup/<scope_id>/kept` — which is invisible to `git log`, `git status` and
// every branch operation, and is reachable for `git restore` and for forensics afterwards.
//
// NON-REGRESSION (plan §7). Every operation here is best-effort: outside a git work tree, with no
// `git` on PATH, or with no snapshot yet taken, the functions report `{ ok: false, reason }` and
// the caller proceeds exactly as it does today. A ratchet that can break a build by failing to
// take a snapshot would get the whole mechanism disabled, which costs more than it saves.

import { spawnSync } from "node:child_process";

/**
 * Run one git subcommand, capturing its outcome. Never throws.
 * @param {string[]} argv - Git arguments (without the leading "git").
 * @param {string} cwd - Repository working directory.
 * @returns {{ok:boolean, stdout:string, stderr:string, status:(number|null)}} Trimmed output and
 *   the exit status; `ok` is true only on status 0.
 */
function git(argv, cwd) {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8", timeout: 60_000 });
  return {
    ok: r.status === 0,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
    status: r.status ?? null,
  };
}

/**
 * The shadow ref a scope's kept tree is published under.
 * @param {string} scopeId - Scope id (e.g. "SC-02").
 * @returns {string} The full ref name, with anything ref-unsafe in the id replaced by "-".
 */
export function keptRef(scopeId) {
  return `refs/shapeup/${String(scopeId || "unscoped").replace(/[^\w.-]/g, "-")}/kept`;
}

/**
 * Is `cwd` inside a git work tree with git available?
 * @param {string} cwd - Directory to test.
 * @returns {boolean} True when git can answer for this directory.
 */
export function isRepo(cwd) {
  return git(["rev-parse", "--is-inside-work-tree"], cwd).stdout === "true";
}

/**
 * `keep` — publish the current working tree (including untracked files) as this scope's kept tree.
 *
 * `git stash create` builds the stash commit WITHOUT touching the index, the working tree, or the
 * stash list; `update-ref` then points the shadow ref at it. Nothing the user can see changes.
 *
 * @param {string} scopeId - Scope id the snapshot belongs to.
 * @param {string} cwd - Repository working directory.
 * @returns {{ok:boolean, ref?:string, sha?:string, reason?:string}} `ok:true` with the ref and the
 *   snapshot commit sha; `ok:false` with a reason when git is unavailable, the directory is not a
 *   repo, or there was nothing to snapshot (a clean tree — the caller has nothing to restore to
 *   that HEAD does not already provide).
 */
export function snapshot(scopeId, cwd) {
  if (!isRepo(cwd)) return { ok: false, reason: "not a git work tree" };
  const created = git(["stash", "create", `shapeup: kept tree for ${scopeId}`], cwd);
  if (!created.ok) return { ok: false, reason: created.stderr || "git stash create failed" };
  // An empty stdout means the tree is clean relative to HEAD — a legitimate state, not an error.
  const sha = created.stdout || git(["rev-parse", "HEAD"], cwd).stdout;
  if (!sha) return { ok: false, reason: "no commit to snapshot" };
  const ref = keptRef(scopeId);
  const updated = git(["update-ref", ref, sha], cwd);
  if (!updated.ok) return { ok: false, reason: updated.stderr || "git update-ref failed" };
  return { ok: true, ref, sha };
}

/**
 * `revert` — restore the working tree from this scope's last kept snapshot.
 *
 * Deliberately `git restore --source=<ref> --worktree -- .`: it rewrites tracked files back to the
 * kept state and leaves the index and HEAD alone. It does NOT delete files created since the
 * snapshot — removing a file the harness cannot prove it created is not a revert, it is data loss,
 * and the attempt's own fixtures are what decide whether the leftover matters.
 *
 * @param {string} scopeId - Scope id whose kept tree should be restored.
 * @param {string} cwd - Repository working directory.
 * @returns {{ok:boolean, ref?:string, sha?:string, reason?:string}} `ok:true` when the tree was
 *   restored; `ok:false` with a reason when there is no snapshot yet (the first trial, by
 *   definition) or git refused.
 */
export function restore(scopeId, cwd) {
  if (!isRepo(cwd)) return { ok: false, reason: "not a git work tree" };
  const ref = keptRef(scopeId);
  const resolved = git(["rev-parse", "--verify", "--quiet", ref], cwd);
  if (!resolved.ok || !resolved.stdout) return { ok: false, reason: `no snapshot at ${ref}` };
  const restored = git(["restore", `--source=${resolved.stdout}`, "--worktree", "--", "."], cwd);
  if (!restored.ok) return { ok: false, reason: restored.stderr || "git restore failed" };
  return { ok: true, ref, sha: resolved.stdout };
}
