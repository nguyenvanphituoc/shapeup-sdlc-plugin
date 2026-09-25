// env — the machine a T0 verdict was measured on.
//
// A T0 artifact records `exit 0`, `pass: true` and a captured tail, and the harness treats that as
// the fact a generator cannot fabricate. What it did not record is that the command's outcome
// depended on state outside the tree. Measured on a consumer whose toolchain resolves its build
// plugins through a cache keyed by the project's ABSOLUTE PATH: the working tree built green; a
// clone of the same commit at a different path failed on a registry 404; a clone with a
// hand-seeded cache compiled a different plugin set and produced two errors the original never
// saw. Three environments, three outcomes, one tree — and three byte-identical verdicts apart from
// their captured output.
//
// The consequence is not that such a project is badly configured; that is its own problem. It is
// that a green verdict is portable evidence in appearance only, and nothing in it said so. This
// module records enough about where a command ran that two machines disagreeing can be told from a
// regression. It measures and never judges: no field here makes a verdict green or red.
//
// WHAT IS DELIBERATELY NOT HERE. No wall clock — a duration is not an environment fact and invites
// comparing speeds across machines. No dependency-tree manifest — the lockfile digest plus the
// cache paths answer the decision this record exists for, and a manifest is unbounded. No raw
// environment values: variables are hashed, never stored, and only from a declared allowlist.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { platform, arch, release, hostname } from "node:os";
import { splitFrontmatter } from "../lib/contract.mjs";

const sha256 = (t) => createHash("sha256").update(t).digest("hex");

/** Lockfiles worth digesting, by ecosystem. Bounded on purpose — a glob would walk the tree. */
export const LOCKFILES = [
  "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "oh-package-lock.json5", "Podfile.lock", "Gemfile.lock", "Cargo.lock", "go.sum",
  "poetry.lock", "Pipfile.lock", "composer.lock", "gradle.lockfile", "pubspec.lock",
];

/**
 * Environment variables whose VALUES are hashed into the fingerprint. Names are recorded in the
 * clear; values never are. Kept short and reviewed — a wide allowlist is how a token ends up
 * hashed into a record somebody later publishes.
 */
export const ENV_ALLOWLIST = ["PATH", "NODE_ENV", "CI", "LANG", "TZ"];

/** What an unset variable hashes as — distinct from a variable set to the empty string. */
const UNSET = "<unset>";

/**
 * The tokens a shell command actually invokes — one per `&&`/`;`/`||` segment, with `cd`, `env` and
 * `VAR=value` prefixes stripped. Returns the token AS WRITTEN (`./scripts/t0-assemble.sh`,
 * `/Applications/…/hvigorw`), because the resolved path is the signal a basename loses.
 *
 * @param {string} cmd - A shell command line.
 * @returns {string[]} Invoked tokens, in order, without duplicates.
 */
export function cdTargets(cmd) {
  const out = [];
  for (const seg of String(cmd || "").split(/&&|;|\|\|/).map((s) => s.trim()).filter(Boolean)) {
    const m = seg.match(/^cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))/);
    const dir = m && (m[1] || m[2] || m[3]);
    if (dir && !dir.startsWith("-") && !out.includes(dir)) out.push(dir);
  }
  return out;
}

export function invokedTokens(cmd) {
  const out = [];
  for (const seg of String(cmd || "").split(/&&|;|\|\|/).map((s) => s.trim()).filter(Boolean)) {
    if (seg.startsWith("cd ")) continue;
    const tokens = seg.split(/\s+/).filter((t) => t && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) && t !== "env" && t !== "cd");
    if (tokens.length && !out.includes(tokens[0])) out.push(tokens[0]);
  }
  return out;
}

/** Where a token resolves on this machine, or null when nothing resolves it. */
function resolveBin(token, cwd) {
  try {
    const r = spawnSync(`command -v ${JSON.stringify(token)}`, { shell: true, cwd, encoding: "utf8", timeout: 10_000 });
    const p = (r.stdout || "").trim().split("\n")[0];
    return p || null;
  } catch { return null; }
}

/** `git rev-parse HEAD` plus whether the tree is dirty. All null outside a repository. */
function treeState(cwd) {
  const git = (args) => {
    try {
      const r = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 20_000 });
      return r.status === 0 ? (r.stdout || "").trim() : null;
    } catch { return null; }
  };
  const head = git(["rev-parse", "HEAD"]);
  if (head === null) return { head: null, dirty: null, branch: null };
  const porcelain = git(["status", "--porcelain"]);
  return {
    head,
    // A dirty flag says "something differs", never what — the honest limit of one boolean, and the
    // reason `head` alone cannot call two measurements the same measurement.
    dirty: porcelain === null ? null : porcelain.length > 0,
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
  };
}

/**
 * Cache directories the project profile declares, resolved. A path-keyed cache is identified by its
 * path, which is exactly the mechanism that made one tree build three ways.
 *
 * `null` means the profile declared nothing — NOT that there are none. "Not asked" and "none" are
 * different facts, and collapsing them is the mistake the seesaw arm already makes elsewhere.
 *
 * @param {(string|null)} profilePath - `shapeup/<slug>/project-profile.md`, when the caller knows it.
 * @returns {(object[]|null)} One entry per declared cache, or null when none is declared.
 */
export function declaredCaches(profilePath) {
  if (!profilePath || !existsSync(profilePath)) return null;
  let meta;
  try { meta = splitFrontmatter(readFileSync(profilePath, "utf8")).meta || {}; } catch { return null; }
  const raw = meta.cache_dirs ?? meta.caches ?? null;
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string" && raw.trim() && raw.trim() !== "~"
      ? raw.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      : null;
  if (!list || !list.length) return null;
  return list.map((p) => {
    const path = p.startsWith("~") ? join(process.env.HOME || "", p.slice(1)) : p;
    let mtime = null;
    try { mtime = statSync(path).mtime.toISOString(); } catch { /* absent is a fact, not an error */ }
    return { declared: p, path, exists: existsSync(path), mtime };
  });
}

/**
 * Stable JSON: object keys sorted at every depth, so a digest does not depend on insertion order.
 * @param {*} value - Anything JSON-representable.
 * @returns {string} The canonical form.
 */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * The environment block a T0 verdict carries.
 *
 * @param {string} rawCwd - The directory the fixtures ran in; resolved to an absolute path here.
 * @param {object} [opts] - `commands` (the fixture command lines) and `profilePath`.
 * @returns {object} `{schema_version, host, cwd, tree, toolchain, lockfiles, caches, env, env_sha256}`.
 *   `env_sha256` digests the block itself, so a reader compares one field and a human diffs the
 *   rest. Without the digest every consumer re-implements the comparison and they disagree, which
 *   is three key spaces for one id waiting to happen on a new record.
 */
export function environmentFingerprint(rawCwd, { commands = [], profilePath = null } = {}) {
  // ABSOLUTE, always. A caller that ran with `--cwd .` would otherwise record "." as the place —
  // and the place is the whole point: the cache that made one tree build three ways is keyed by
  // the project's absolute path.
  const cwd = resolve(rawCwd || process.cwd());
  const tokens = [...new Set(commands.flatMap((c) => invokedTokens(c)))];
  const block = {
    schema_version: 1,
    host: {
      platform: platform(),
      arch: arch(),
      os_release: release(),
      node: process.version,
      // Hashed: equality is all a reader needs, and a hostname names a person's laptop.
      hostname_sha256: sha256(hostname()),
    },
    cwd,
    tree: treeState(cwd),
    toolchain: tokens.map((bin) => ({ bin, path: resolveBin(bin, cwd) })),
    // The root AND wherever the commands actually run. Measured on a consumer whose fixtures are
    // `cd app && …`: the lockfile that decides what the build resolves lives in `app/`, and a scan
    // of the project root alone recorded an empty list beside a build whose dependencies were the
    // whole question.
    lockfiles: [...new Set(["", ...commands.flatMap((c) => cdTargets(c))])]
      .flatMap((sub) => LOCKFILES
        .map((f) => (sub ? `${sub.replace(/\/+$/, "")}/${f}` : f))
        .filter((rel) => existsSync(join(cwd, rel)))
        .map((rel) => {
          try { return { file: rel, sha256: sha256(readFileSync(join(cwd, rel))) }; }
          catch { return { file: rel, sha256: null }; }
        }))
      .filter((l, i, all) => all.findIndex((x) => x.file === l.file) === i),
    caches: declaredCaches(profilePath),
    env: {
      allowlist: ENV_ALLOWLIST,
      // One digest over the allowlisted names AND values: a PATH that changed shows up, and no
      // value is stored.
      sha256: sha256(ENV_ALLOWLIST.map((k) => `${k}=${process.env[k] ?? UNSET}`).join("\n")),
    },
  };
  return { ...block, env_sha256: sha256(canonical(block)) };
}
