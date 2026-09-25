#!/usr/bin/env node
// Traceability oracle (spine v1.3).
//
// ONE oracle, TWO mechanically-checkable assertions — nothing that merely *asserts* quality:
//
//   1. Covers-closure (§1) — every SHARED requirement with status `covered` must be named by
//      ≥1 acceptance criterion's `(covers: REQ-…)` clause. A REQ that is neither covered nor
//      CUT (PO-approved) is RED. This catches the *dropped clause* (a customer requirement that
//      silently vanished in translation), not a *contradiction* (§1 honest boundary → §4.2).
//
//   2. Reachability (§2) — a use-case whose engine module does not reach the project profile's
//      `entry_point` via the import graph (0 import sites) is RED. This catches the *dead module*
//      (631 lines, 26 passing tests, zero call sites), not a *dead data-path* (§2 honest boundary
//      → §4.4). Entry point is PROFILE-GATED, never hardcoded (main.js for a game is not the seam
//      for a web-service). It reports `checked: false` with a reason rather than a verdict when it
//      cannot root the walk: an import it could not follow (the graph is missing edges, so nothing
//      about a destination follows from not arriving there), or no reachable engine at all (with
//      no positive control, an orphaned module and a wrong entry point are the same evidence —
//      and a framework that registers screens by name produces the second on every run).
//
// Governing rule: if a script can't check it, it's decoration. This script checks a deletion and
// an orphan — both provable from files, zero LLM tokens. What it deliberately does NOT assert:
// it does not count or grade tests (§4.1 — a green test that asserts nothing real would satisfy
// a "≥1 test" arm, so that arm was cut).
//
// Staged severity (§1.4 / §6): ADVISORY (warn-only, exit 0) by default — it goes ~100% red on a
// board with no covers: yet, and that's the intended demonstration, not a gate. Promote to a
// blocking gate with --gate only once covers: is populated, or it breaks every legacy run.
//
// Reads   SHARED shapeup/<slug>/requirements.md   (RequirementClause registry)
//         SHARED shapeup/<slug>/wiring-map.md    (WiringMap — optional)
//         SHARED shapeup/<slug>/project-profile.md (ProjectProfile — optional)
//         LOCAL  .shapeup/<slug>/tasks/TASK-*.md         (board AC covers[])
// Writes  LOCAL  .shapeup/<slug>/trace/report.json       (regenerated each run)
//         LOCAL  .shapeup/<slug>/trace/wiring.mmd         (Mermaid view of the checked graph)
//
// Zero dependencies, zero network — same discipline as `harness verify t0` / `harness compile`.
//
// Usage:  node kernel/harness.mjs verify trace --slug <slug> [--cwd <dir>] [--gate] [--quiet]
// Exit:   advisory (default) → always 0. --gate → 1 when overall is red.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname, relative, isAbsolute } from "node:path";
import { readBoard } from "../compile.mjs";
import { runArgs } from "../lib/argv.mjs";
import { sharedRoot, traceDir, relLocal, scopesDir } from "../lib/paths.mjs";
import { globToRegExp } from "./spec.mjs";
import { readContract, readAllContracts, unreadableReason, LEGACY_LAYOUT, WIRING_MAP, PROJECT_PROFILE, SCOPE_CONTRACT, reqId } from "../lib/contract.mjs";

// --- requirements.md registry parser -----------------------------------------
// A committed markdown table: | REQ-id | clause (verbatim) | source | status | note |
// The first two columns are load-bearing; source/note are optional. Status is normalized so
// "CUT (PO-approved)", "cut", "CUT" all read as cut and anything else non-covered stays covered.
/**
 * Parse the committed `requirements.md` table into RequirementClause rows.
 * @param {string} md - The registry Markdown ("" / null → []). Table columns:
 *   | REQ-id | clause | source | status | note |.
 * @returns {Array<{id:string, clause:string, source:string, status:("covered"|"CUT (PO-approved)"),
 *   note:string}>} One row per `REQ-\d+`; any status containing "cut" normalizes to CUT, all else
 *   to covered. Header/separator/prose rows are skipped.
 */
export function parseRequirements(md) {
  const clauses = [];
  if (!md) return clauses;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim()); // drop the leading/trailing empties
    if (!cells.length) continue;
    const id = (cells[0].match(/REQ-\d+/) || [])[0];
    if (!id) continue; // header row ("REQ-id"), separator row ("---"), or prose — skip
    const statusRaw = (cells[3] || cells[cells.length - 1] || "").toLowerCase();
    const status = /\bcut\b/.test(statusRaw) ? "CUT (PO-approved)" : "covered";
    clauses.push({
      id,
      clause: cells[1] || "",
      source: cells[2] || "",
      status,
      note: cells[4] || "",
    });
  }
  return clauses;
}

/**
 * Collect every REQ-id named by a `covers:` clause across the board's acceptance criteria.
 * @param {Array<object>} board - Task entries (see compile-order's parseTaskFile).
 * @returns {Set<string>} The set of `REQ-\d+` ids referenced by any AC's covers[].
 */
export function coveredReqIds(board) {
  const covered = new Set();
  for (const task of board) {
    for (const ac of task.acceptance_criteria || []) {
      const covers = typeof ac === "object" && Array.isArray(ac.covers) ? ac.covers : [];
      // ONE KEY SPACE. `R-2`, `[[REQ-5]]` and `req-4` are the same clause spelled three ways, and the
      // sibling rule accepts all of them; testing the raw string here counted every one as nothing, so
      // an author told at L1b to cover a requirement with an AC — which they had — stayed red.
      for (const raw of covers) { const id = reqId(raw); if (/^REQ-\d+$/.test(id)) covered.add(id); }
    }
  }
  return covered;
}

// --- import-graph reachability -----------------------------------------------
//
// THE RESOLVER KNOWS ONE FAMILY OF LANGUAGES, AND IT MUST SAY SO. This list is the JS/TS family and
// nothing else, which is correct for the stacks it was written against and silently wrong for any
// other: a stack whose modules end in something else resolves no relative import at all, the walk
// stops at the entry file, and every engine then looks "never imported from the entry point" — a
// red verdict on every input, reported as a check that ran. Two things keep that from happening:
// the extension set is widened from what the project actually declares (below), and a walk that
// could not follow an edge reports itself unchecked instead of reporting the destination missing.
const DEFAULT_SOURCE_EXTS = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"];
const IMPORT_RE = /(?:\bimport\b[^'"]*?from\s*|\bimport\s*|\bexport\b[^'"]*?from\s*|\brequire\s*\(\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g;

/**
 * The module extensions this project's import graph is walked with.
 *
 * Widened two ways, both from declarations rather than from a guess: the project profile may state
 * `source_extensions` outright, and the entry point's own suffix is always a module extension of
 * this project by construction — it is the one file the profile names and the walk starts from.
 *
 * @param {(object|null)} profile - The parsed ProjectProfile, or null.
 * @param {(string|null)} entryPoint - The declared entry-point path, or null.
 * @returns {{exts:string[], declared:string[], from_entry:(string|null)}} The extension set the
 *   walk uses, plus what each widening contributed (reported, so a reader can see why it resolved).
 */
export function sourceExtensions(profile, entryPoint) {
  // One spelling, the one the schema declares. A silent alias is a field nobody documented and
  // nobody can be told to write.
  const raw = profile?.source_extensions ?? null;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
  const declared = list
    .map((e) => String(e).trim())
    .filter(Boolean)
    .map((e) => (e.startsWith(".") ? e : "." + e));
  const m = /(\.[A-Za-z0-9]+)$/.exec(entryPoint || "");
  const fromEntry = m ? m[1] : null;
  const exts = [...new Set([...DEFAULT_SOURCE_EXTS, ...declared, ...(fromEntry ? [fromEntry] : [])])];
  return { exts, declared, from_entry: fromEntry };
}

/**
 * Resolve a relative import specifier to a repo-relative source file.
 *
 * The three answers are kept apart on purpose. A bare specifier is out of the app graph by design;
 * a relative specifier carrying a non-module suffix (`./styles.css`, `./data.json`) is an asset,
 * which imports nothing and can never be an engine; and a relative specifier that looks like a
 * module but resolves to no file is an edge the walk could not follow — the one case that makes
 * the resulting graph incomplete, and the caller has to be able to see it.
 *
 * @param {string} fromFileAbs - Absolute path of the importing file.
 * @param {string} spec - The import specifier string.
 * @param {string} cwd - Repo root the result is made relative to.
 * @param {string[]} exts - The module extensions of this project (see `sourceExtensions`).
 * @returns {{file:(string|null), kind:("bare"|"asset"|"resolved"|"unresolved")}} The repo-relative
 *   source path when one was found, and which of the four answers this was.
 */
function resolveSpecifier(fromFileAbs, spec, cwd, exts) {
  if (!spec.startsWith(".")) return { file: null, kind: "bare" }; // node_modules, out of the app graph
  const suffix = /(\.[A-Za-z0-9]+)$/.exec(spec);
  const baseAbs = resolve(dirname(fromFileAbs), spec);
  const candidates = [baseAbs, ...exts.map((e) => baseAbs + e), ...exts.map((e) => join(baseAbs, "index" + e))];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return { file: relative(cwd, c).split("\\").join("/"), kind: "resolved" };
  }
  if (suffix && !exts.includes(suffix[1])) return { file: null, kind: "asset" };
  return { file: null, kind: "unresolved" };
}

/**
 * Normalize a declared path (entry_point / engine) to an existing repo-relative source file.
 * @param {string} p - The declared path (absolute or cwd-relative).
 * @param {string} cwd - Repo root the result is made relative to.
 * @param {string[]} [exts] - The module extensions to try (defaults to the JS/TS family).
 * @returns {(string|null)} The repo-relative source path (trying source extensions and `/index`),
 *   or null when nothing on disk matches.
 */
function resolveFile(p, cwd, exts = DEFAULT_SOURCE_EXTS) {
  const abs = isAbsolute(p) ? p : resolve(cwd, p);
  const candidates = [abs, ...exts.map((e) => abs + e), ...exts.map((e) => join(abs, "index" + e))];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return relative(cwd, c).split("\\").join("/");
  }
  return null;
}

/**
 * Extract every import/require/dynamic-import specifier string from a file.
 * @param {string} fileAbs - Absolute path of the source file.
 * @returns {string[]} The raw specifier strings; [] when the file is unreadable.
 */
function importsOf(fileAbs) {
  let src;
  try { src = readFileSync(fileAbs, "utf8"); } catch { return []; }
  const out = [];
  for (const m of src.matchAll(IMPORT_RE)) out.push(m[1]);
  return out;
}

/**
 * BFS the import graph from an entry point.
 *
 * Reports the edges it could NOT follow alongside the set it built. "This module is never imported"
 * is only a supportable claim over a graph with every edge in it; over a graph missing edges it is
 * indistinguishable from "the walker could not read this language", and the second must not be
 * published as the first.
 *
 * @param {string} entryRel - The entry-point path (declared form; resolved on disk).
 * @param {string} cwd - Repo root.
 * @param {string[]} [exts] - The module extensions of this project (defaults to the JS/TS family).
 * @returns {{reachable:Set<string>, entryResolved:(string|null), unresolved:Array<{from:string,
 *   spec:string}>}} The set of repo-relative files reachable from the entry, the resolved entry
 *   path (null when the entry is not on disk, in which case `reachable` is empty), and every
 *   module-shaped relative specifier that resolved to no file.
 */
export function reachableFrom(entryRel, cwd, exts = DEFAULT_SOURCE_EXTS) {
  const reachable = new Set();
  const unresolved = [];
  const start = resolveFile(entryRel, cwd, exts);
  if (!start) return { reachable, entryResolved: null, unresolved };
  const queue = [start];
  reachable.add(start);
  while (queue.length) {
    const cur = queue.shift();
    const curAbs = resolve(cwd, cur);
    for (const spec of importsOf(curAbs)) {
      const { file: dep, kind } = resolveSpecifier(curAbs, spec, cwd, exts);
      if (kind === "unresolved") unresolved.push({ from: cur, spec });
      if (dep && !reachable.has(dep)) { reachable.add(dep); queue.push(dep); }
    }
  }
  return { reachable, entryResolved: start, unresolved };
}

// --- Mermaid view (a view of the checked graph, so it cannot drift — §2) ------
/**
 * Render a Mermaid flowchart of the wiring map, marking orphaned engines (a view of the checked
 * graph, so it cannot drift from the reachability result).
 * @param {(object|null)} wiringMap - The WiringMap ({entries:[{use_case,engine,affordance}]}).
 * @param {Set<string>} unreachableSet - Use-case ids found unreachable (rendered as dashed/dead).
 * @returns {string} The Mermaid `flowchart LR` source.
 */
export function wiringMermaid(wiringMap, unreachableSet) {
  const lines = ["flowchart LR", "  entry([entry point])"];
  /**
   * Make a Mermaid-safe node id from an arbitrary string.
   * @param {*} s - Any value (engine path / use-case id); coerced to string.
   * @returns {string} A `n_`-prefixed id with every non-alphanumeric char replaced by `_`.
   */
  const id = (s) => "n_" + String(s).replace(/[^A-Za-z0-9]/g, "_");
  for (const e of wiringMap?.entries || []) {
    const dead = unreachableSet.has(e.use_case);
    const eng = id(e.engine);
    lines.push(`  ${eng}["${e.engine}"]${dead ? ":::dead" : ""}`);
    lines.push(`  entry ${dead ? "-.->|orphan| " : "--> "}${eng}`);
    if (e.affordance) lines.push(`  ${eng} --> ${id(e.use_case + "_aff")}(["${e.affordance}"])`);
  }
  lines.push("  classDef dead stroke:#d33,stroke-width:2px,color:#d33;");
  return lines.join("\n");
}

// --- per-scope reachability ---------------------------------------------------
//
// A SCOPE'S BUILD FIXTURE PROVES NOTHING UNTIL THE SCOPE'S CODE IS REACHABLE, and on a toolchain
// that compiles only what the entry point reaches, the two come apart in the worst direction:
// three scopes were T0-green on an assemble fixture while their own files did not compile at all,
// and the errors surfaced only once a fourth scope — one that may not write those files — wired
// the screens in. The fixture was honest about what it ran. Nothing asked whether what it ran
// included the scope's work.
//
// This arm asks, and only ever warns. A scope legitimately owns resources, route maps, manifests,
// tests and files a later scope will wire, so *some* of its substrate sitting outside the import
// graph is the normal case and says nothing. What is worth a word is a scope with source files on
// disk and NOT ONE of them reachable: everything that scope contributes is outside the running
// app, which is the shape the defect had. Red would be wrong even then — the wiring may be the
// next scope's job by design, which is a plan the PO made, not a defect the oracle found.
const SKIP_DIRS = new Set([".git", "node_modules", "oh_modules", ".shapeup", "build", "dist", "out", ".idea", "coverage"]);

/**
 * List the repo-relative source files under a root, by module extension.
 * @param {string} root - Repo root; results are relative to it.
 * @param {string[]} exts - The module extensions that make a file a source file.
 * @returns {string[]} Repo-relative paths, build and dependency directories skipped.
 */
function sourceFilesUnder(root, exts) {
  const out = [];
  /**
   * Walk one directory, recursing into its subdirectories.
   * @param {string} dir - Absolute directory to walk.
   * @returns {void}
   */
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (exts.some((x) => e.name.endsWith(x))) out.push(relative(root, abs).split("\\").join("/"));
    }
  };
  walk(root);
  return out;
}

/**
 * For each scope contract, how much of its own source substrate the app actually reaches.
 *
 * @param {Array<{id?:string, contract?:object}>} contracts - Scope contracts as `readAllContracts`
 *   returns them.
 * @param {Set<string>} reachable - The repo-relative files reachable from the entry point.
 * @param {string[]} sources - Every repo-relative source file on disk.
 * @returns {Array<{scope_id:string, source_files:number, reachable_files:number}>} One row per
 *   scope that owns at least one source file on disk; scopes owning none are left out entirely,
 *   because a scope with nothing to reach is not a finding.
 */
export function scopeReachability(contracts, reachable, sources) {
  const rows = [];
  for (const found of contracts) {
    const c = found?.contract || found || {};
    const id = c.scope_id || found?.id;
    // A CONTRACT THIS CANNOT READ IS SKIPPED, NEVER THROWN OVER. The whole oracle runs advisory, so
    // a throw here takes out covers-closure too and the run gets no report at all — one malformed
    // contract silencing every arm. A substrate that is not a list of globs is simply a scope this
    // arm has nothing to say about.
    const declared = c.allowed_file_substrate;
    if (!Array.isArray(declared) || !declared.length) continue;
    const globs = declared.filter((g) => typeof g === "string").map(globToRegExp);
    if (!globs.length) continue;
    const owned = sources.filter((f) => globs.some((r) => r.test(f)));
    if (!owned.length) continue;
    rows.push({ scope_id: id, source_files: owned.length, reachable_files: owned.filter((f) => reachable.has(f)).length });
  }
  return rows;
}

// --- the oracle --------------------------------------------------------------
/**
 * Run the covers-closure + reachability oracle for a slug.
 * @param {string} slug - Feature slug.
 * @param {{cwd:string, gate?:boolean}} opts - cwd (root the SHARED/LOCAL paths resolve against),
 *   gate (records mode; the CLI, not this function, turns gate+red into a non-zero exit).
 * @returns {{report:object, mermaid:(string|null)}} The trace report (covers_closure, reachability,
 *   scope_reachability, findings[], overall "green"|"red") and a Mermaid view when a wiring map
 *   exists. Each arm self-skips (checked=false) when its artifact is absent — non-regression on
 *   pre-spine specs — and reachability also self-skips when it cannot root its walk, which is what
 *   skips the per-scope arm with it.
 */
export function traceLint(slug, { cwd, gate = false }) {
  const shared = sharedRoot(cwd, slug);
  const findings = [];

  // 1. Covers-closure.
  //
  // THE WHOLE ARM IS GATED ON THE REGISTRY EXISTING — both halves of it, and the second half is the
  // one that was missing. With no `requirements.md` there are no clauses, so `REQ-UNCOVERED` cannot
  // fire; but `dangling` is derived from the BOARD, which needs no registry to carry a `covers:`
  // clause, so a tree with no registry reported "covers-closure not applicable" in the same breath
  // as a red finding for every `covers:` on the board. An arm that reports itself skipped and emits
  // findings anyway is not skipped, and the report says the opposite of what the findings do.
  const reqPath = join(shared, "requirements.md");
  const closureChecked = existsSync(reqPath);
  const clauses = closureChecked ? parseRequirements(readFileSync(reqPath, "utf8")) : [];
  const board = readBoard(cwd, slug);
  const covered = coveredReqIds(board);
  const knownIds = new Set(clauses.map((c) => c.id));

  const wantCovered = clauses.filter((c) => c.status === "covered");
  const cut = clauses.filter((c) => c.status !== "covered");
  const uncovered = wantCovered.filter((c) => !covered.has(c.id)).map((c) => c.id);
  const dangling = [...covered].filter((id) => !knownIds.has(id));

  for (const id of uncovered) {
    const c = clauses.find((x) => x.id === id);
    findings.push({ severity: "red", code: "REQ-UNCOVERED", req: id,
      message: `${id} (status: covered) is named by no AC's covers: — the clause "${(c?.clause || "").slice(0, 60)}" would silently vanish. Cover it with an AC, or mark it CUT (PO-approved).` });
  }
  if (closureChecked) {
    for (const id of dangling) {
      findings.push({ severity: "red", code: "COVERS-DANGLING", req: id,
        message: `an AC declares (covers: ${id}) but ${id} is not in requirements.md — a covers: link must resolve to a registered REQ.` });
    }
  }

  const coversClosure = {
    checked: closureChecked,
    requirements_total: clauses.length,
    covered_status: wantCovered.length,
    cut_status: cut.length,
    covered_by_ac: [...covered].filter((id) => knownIds.has(id)).length,
    uncovered,
    dangling_covers: closureChecked ? dangling : [],
    pass: uncovered.length === 0 && (!closureChecked || dangling.length === 0),
    skipped_reason: closureChecked ? null : "no requirements.md registry — covers-closure not applicable (non-regression on pre-spine specs).",
  };

  // 2. Reachability (profile-gated). Both artifacts are markdown since ADR-0001; `readContract`
  // still accepts the legacy `.json` so a project mid-migration is checked rather than skipped.
  const wiringPath = join(shared, "wiring-map.md");
  const profilePath = join(shared, "project-profile.md");
  let reachability = { checked: false, pass: true, unreachable: [], skipped_reason: "no wiring-map — reachability not applicable." };
  // Hoisted so the per-scope arm below can reuse the walk this one already paid for. Both stay
  // null unless reachability actually ran, which is what gates the second arm on the first.
  let reachableSet = null;
  let walkExts = null;
  let wiringMap = null;

  let wiringFound = null;
  try { wiringFound = readContract(wiringPath, WIRING_MAP); }
  catch (e) {
    findings.push({ severity: "red", code: "WIRING-UNREADABLE", message: `wiring-map is not readable (${e.message}).` });
  }
  if (wiringFound) wiringMap = wiringFound.contract;

  // A map whose `## Wiring` table is under a heading the parser does not claim reads as
  // zero entries, and the loop below then walks nothing and reports `0/0 engines reach <entry>` —
  // GREEN, for a committed file holding six correct rows. The gate whose entire purpose is that no
  // engine ships orphaned failing open, on a file that looks right to every human who reviews it.
  // An unreadable contract is now RED and reachability is not claimed, because none was checked.
  const wiringUnreadable = unreadableReason(wiringMap);
  if (wiringUnreadable) {
    findings.push({ severity: "red", code: "WIRING-UNREADABLE", message: `wiring-map.md could not be read as a WiringMap: ${wiringUnreadable}. Reachability was NOT checked — a map this parser cannot see is not a map with nothing in it.` });
    wiringMap = null;
    reachability = { checked: false, pass: false, unreachable: [],
      skipped_reason: `wiring-map.md is present but unreadable (${wiringUnreadable}) — reachability cannot be claimed.` };
  }

  // A map that parsed only through the migration reader still WORKS — but silence about that is
  // how a temporary fallback becomes a permanent second format. Warn, so the next `wire` converges
  // the file on the canonical table rather than the reader carrying the old shape indefinitely.
  if (wiringMap && wiringMap[LEGACY_LAYOUT]) {
    findings.push({ severity: "warn", code: "WIRING-LEGACY-LAYOUT", message:
      "wiring-map.md is in the pre-canonical per-use-case layout (`### UC-xx` + a `| Field | Value |` table). " +
      "It reads correctly through the migration reader, but the canonical form is one `## Wiring` table — " +
      "re-run the wire operation to converge it, so this artifact stops having two shapes." });
  }

  if (wiringMap) {
    let profileFound = null;
    try { profileFound = readContract(profilePath, PROJECT_PROFILE); }
    catch (e) { findings.push({ severity: "red", code: "PROFILE-UNREADABLE", message: `project-profile is not readable (${e.message}).` }); }
    if (!profileFound) {
      reachability = { checked: false, pass: true, unreachable: [],
        skipped_reason: "wiring-map present but no project-profile — reachability needs an entry_point; declare the profile at L0." };
      findings.push({ severity: "warn", code: "PROFILE-MISSING", message: "wiring-map exists but project-profile does not — reachability is skipped until the entry point is declared." });
    } else {
      const profile = profileFound.contract;
      const entryPoint = profile?.entry_point;
      if (!entryPoint) {
        reachability = { checked: false, pass: true, unreachable: [], skipped_reason: "project-profile has no entry_point." };
      } else {
        const { exts, declared, from_entry: fromEntry } = sourceExtensions(profile, entryPoint);
        const { reachable, entryResolved, unresolved } = reachableFrom(entryPoint, cwd, exts);
        if (!entryResolved) {
          reachability = { checked: false, pass: true, unreachable: [], entry_point: entryPoint,
            skipped_reason: `entry_point "${entryPoint}" does not resolve to a source file on disk — reachability skipped.` };
          findings.push({ severity: "warn", code: "ENTRY-MISSING", message: `project-profile.md entry_point "${entryPoint}" is not on disk — reachability cannot run.` });
        } else if (unresolved.length) {
          // AN INCOMPLETE GRAPH GRADES NOTHING. Every module-shaped relative import the walker could
          // not follow is a missing edge, and a module is "unreachable" only in the sense that this
          // walk did not get there. Publishing that as red produces a check that is red for every
          // input on a stack the resolver cannot read, while reporting that it looked.
          const sample = unresolved.slice(0, 3).map((u) => `${u.spec} (from ${u.from})`);
          reachability = { checked: false, pass: true, unreachable: [], entry_point: entryPoint,
            entry_resolved: entryResolved, reachable_files: reachable.size,
            module_extensions: exts, unresolved_imports: unresolved.length, unresolved_sample: sample,
            skipped_reason: `${unresolved.length} relative import(s) from the entry point resolve to no file with the extensions this project declares (${exts.join(", ")}) — the import graph is incomplete, so "never imported" is not a claim this walk can support.` };
          findings.push({ severity: "warn", code: "GRAPH-INCOMPLETE", message:
            `reachability did not run: ${unresolved.length} relative import(s) could not be resolved (e.g. ${sample.join("; ")}). ` +
            `The walker tried ${exts.join(", ")}${declared.length ? "" : " — the project profile declares no `source_extensions`, so the set is the JS/TS family plus the entry point's own suffix" + (fromEntry ? ` (${fromEntry})` : "")}. ` +
            "Declare `source_extensions` in project-profile.md to let this arm run." });
        } else {
          const engines = wiringMap.entries || [];
          const unreachable = [];
          for (const e of engines) {
            const engResolved = resolveFile(e.engine, cwd, exts);
            if (!(engResolved && reachable.has(engResolved))) {
              unreachable.push({ use_case: e.use_case, engine: e.engine, reason: engResolved ? "not imported from the entry point" : "engine file not on disk" });
            }
          }
          // THE ARM NEEDS ONE POSITIVE CONTROL, AND EVERY-ENGINE-ORPHANED IS NOT ONE. What this
          // check was built to catch is the dead module: one engine with no call site among
          // siblings that have them. When NO engine is reachable, nothing demonstrates that this
          // entry point is the root the app actually runs from — and for whole archetypes it is
          // not. A framework that registers screens declaratively reaches them by name at runtime
          // (`loadContent("pages/Index")`, a route map, a manifest), so its entry file imports a
          // handful of modules and no engine, and the import graph is complete and beside the
          // point. "Every engine is dead" and "I am walking the wrong tree" produce identical
          // evidence, so the arm reports that it could not check rather than picking one.
          //
          // THE COST, NAMED: a wiring map with a single engine can no longer red, because its only
          // engine being unreachable is exactly the indistinguishable case. A genuinely orphaned
          // module in a one-use-case feature is therefore reported as unchecked, not as dead. That
          // is the price of never being red for every input on a stack this walk cannot root.
          if (engines.length && unreachable.length === engines.length) {
            reachability = { checked: false, pass: true, unreachable: [], entry_point: entryPoint,
              entry_resolved: entryResolved, module_extensions: exts, reachable_files: reachable.size,
              engines_total: engines.length, engines_reachable: 0,
              skipped_reason: `no engine is reachable from entry_point "${entryPoint}", which reaches ${reachable.size} file(s) — with no reachable engine as a control this walk cannot tell an orphaned module from an entry point that is not the runtime root (declarative routing, a manifest, a string-loaded screen). Reachability skipped.` };
            findings.push({ severity: "warn", code: "REACH-NO-CONTROL", message:
              `reachability did not run: all ${engines.length} engine(s) are unreachable from entry_point "${entryPoint}", which reaches ${reachable.size} file(s). ` +
              "Every engine orphaned is the one result this arm cannot distinguish from a wrong root. If some module does compose the app, declare that one as the entry point. " +
              "If the screens are registered in a manifest instead — a route map, a plugin table — then no entry point roots this walk and unchecked is the correct end state for this project, not a profile to fix." });
          } else {
            for (const u of unreachable) {
              findings.push({ severity: "red", code: "UC-UNREACHABLE", uc: u.use_case,
                message: `${u.use_case}: engine "${u.engine}" is ${u.reason === "engine file not on disk" ? "missing under" : "never imported from"} entry_point "${entryPoint}" — the module ships orphaned from the running app, while ${engines.length - unreachable.length} other engine(s) reach it.` });
            }
            reachableSet = reachable;
            walkExts = exts;
            reachability = { checked: true, entry_point: entryPoint, entry_resolved: entryResolved,
              module_extensions: exts, reachable_files: reachable.size,
              engines_total: engines.length, engines_reachable: engines.length - unreachable.length,
              unreachable, pass: unreachable.length === 0 };
          }
        }
      }
    }
  }

  // --- per-scope reachability, gated on the first arm having actually run ---------------------
  let scopeReach = { checked: false, scopes: [], orphaned: [],
    skipped_reason: "reachability did not run, so there is no graph to measure a scope against." };
  if (reachableSet) {
    const contracts = readAllContracts(scopesDir(cwd, slug), SCOPE_CONTRACT);
    if (!contracts.length) {
      scopeReach = { checked: false, scopes: [], orphaned: [], skipped_reason: "no scope contracts on disk." };
    } else {
      const rows = scopeReachability(contracts, reachableSet, sourceFilesUnder(cwd, walkExts));
      const orphaned = rows.filter((r) => r.reachable_files === 0);
      scopeReach = { checked: true, scopes: rows, orphaned: orphaned.map((r) => r.scope_id) };
      for (const r of orphaned) {
        findings.push({ severity: "warn", code: "SCOPE-UNREACHABLE", scope: r.scope_id, message:
          `scope ${r.scope_id}: none of its ${r.source_files} source file(s) is reached from the entry point. ` +
          "A build fixture that compiles only what the entry point reaches can be green while this scope's own " +
          "code never compiles — the errors then surface in whichever scope wires the screens in. Warn, not red: " +
          "the wiring may legitimately be a later scope's job." });
      }
    }
  }

  const overall = findings.some((f) => f.severity === "red") ? "red" : "green";
  const report = {
    schema_version: 1,
    slug,
    at: new Date().toISOString(),
    mode: gate ? "gate" : "advisory",
    advisory: !gate,
    covers_closure: coversClosure,
    reachability,
    scope_reachability: scopeReach,
    findings,
    overall,
  };
  const mermaid = wiringMap ? wiringMermaid(wiringMap, new Set((reachability.unreachable || []).map((u) => u.use_case))) : null;
  return { report, mermaid };
}

// ---------------------------------------------------------------------------
/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs verify trace --slug <slug> [--cwd <dir>] [--gate] [--quiet]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
  gate: { type: "flag" },
  quiet: { type: "flag" },
};

/**
 * Run the traceability oracle over the spine artifacts and write its report.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const slug = args.slug;
  const gate = !!args.gate;

  const { report, mermaid } = traceLint(slug, { cwd, gate });

  const outDir = traceDir(cwd, slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  if (mermaid) writeFileSync(join(outDir, "wiring.mmd"), mermaid + "\n");

  if (!args.quiet) {
    const cc = report.covers_closure, rc = report.reachability;
    const badge = report.overall === "green" ? "🟢 green" : (gate ? "🔴 red" : "🟠 red (advisory)");
    console.log(`trace-lint ${slug} — ${badge} [${report.mode}]`);
    if (cc.checked) console.log(`  covers-closure: ${cc.covered_by_ac}/${cc.covered_status} covered · ${cc.cut_status} cut · uncovered [${cc.uncovered.join(", ")}]${cc.dangling_covers.length ? ` · dangling [${cc.dangling_covers.join(", ")}]` : ""}`);
    else console.log(`  covers-closure: skipped — ${cc.skipped_reason}`);
    if (rc.checked) console.log(`  reachability: ${rc.engines_total - rc.unreachable.length}/${rc.engines_total} engines reach ${rc.entry_point} · unreachable [${rc.unreachable.map((u) => u.use_case).join(", ")}]`);
    else console.log(`  reachability: skipped — ${rc.skipped_reason}`);
    for (const f of report.findings) console.log(`  ${f.severity === "red" ? "✗" : "⚠"} [${f.code}] ${f.message}`);
    console.log(`  → ${relLocal(slug, "trace", "report.json")}`);
  }

  process.exit(gate && report.overall === "red" ? 1 : 0);
}
