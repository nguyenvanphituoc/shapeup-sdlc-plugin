#!/usr/bin/env node
// Traceability oracle (spine v1.3, plan docs/internal/plan/traceability-spine-plan.md §1.4 + §2).
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
//      for a web-service).
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
// Zero dependencies, zero network — same discipline as t0-verify.mjs / compile-order.mjs.
//
// Usage:  node skills/tech-lead/scripts/trace-lint.mjs --slug <slug> [--cwd <dir>] [--gate] [--quiet]
// Exit:   advisory (default) → always 0. --gate → 1 when overall is red.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname, relative, isAbsolute } from "node:path";
import { readBoard } from "./compile-order.mjs";
import { isMain } from "./lib/is-main.mjs";
import { runArgs } from "./lib/argv.mjs";
import { sharedRoot, traceDir, relLocal } from "./lib/paths.mjs";
import { readContract, unreadableReason, WIRING_MAP, PROJECT_PROFILE } from "./lib/contract-md.mjs";

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
      for (const id of covers) if (/^REQ-\d+$/.test(id)) covered.add(id);
    }
  }
  return covered;
}

// --- import-graph reachability -----------------------------------------------
const SOURCE_EXTS = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"];
const IMPORT_RE = /(?:\bimport\b[^'"]*?from\s*|\bimport\s*|\bexport\b[^'"]*?from\s*|\brequire\s*\(\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g;

/**
 * Resolve a relative import specifier to a repo-relative source file.
 * @param {string} fromFileAbs - Absolute path of the importing file.
 * @param {string} spec - The import specifier string.
 * @param {string} cwd - Repo root the result is made relative to.
 * @returns {(string|null)} The repo-relative source path (trying source extensions and `/index`),
 *   or null for a bare specifier (node_modules) or an unresolved path.
 */
function resolveSpecifier(fromFileAbs, spec, cwd) {
  if (!spec.startsWith(".")) return null; // bare specifier → node_modules, out of the app graph
  const baseAbs = resolve(dirname(fromFileAbs), spec);
  const candidates = [baseAbs, ...SOURCE_EXTS.map((e) => baseAbs + e), ...SOURCE_EXTS.map((e) => join(baseAbs, "index" + e))];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return relative(cwd, c).split("\\").join("/");
  }
  return null;
}

/**
 * Normalize a declared path (entry_point / engine) to an existing repo-relative source file.
 * @param {string} p - The declared path (absolute or cwd-relative).
 * @param {string} cwd - Repo root the result is made relative to.
 * @returns {(string|null)} The repo-relative source path (trying source extensions and `/index`),
 *   or null when nothing on disk matches.
 */
function resolveFile(p, cwd) {
  const abs = isAbsolute(p) ? p : resolve(cwd, p);
  const candidates = [abs, ...SOURCE_EXTS.map((e) => abs + e), ...SOURCE_EXTS.map((e) => join(abs, "index" + e))];
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
 * @param {string} entryRel - The entry-point path (declared form; resolved on disk).
 * @param {string} cwd - Repo root.
 * @returns {{reachable:Set<string>, entryResolved:(string|null)}} The set of repo-relative files
 *   reachable from the entry, and the resolved entry path (null when the entry is not on disk, in
 *   which case `reachable` is empty).
 */
export function reachableFrom(entryRel, cwd) {
  const reachable = new Set();
  const start = resolveFile(entryRel, cwd);
  if (!start) return { reachable, entryResolved: null };
  const queue = [start];
  reachable.add(start);
  while (queue.length) {
    const cur = queue.shift();
    const curAbs = resolve(cwd, cur);
    for (const spec of importsOf(curAbs)) {
      const dep = resolveSpecifier(curAbs, spec, cwd);
      if (dep && !reachable.has(dep)) { reachable.add(dep); queue.push(dep); }
    }
  }
  return { reachable, entryResolved: start };
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

// --- the oracle --------------------------------------------------------------
/**
 * Run the covers-closure + reachability oracle for a slug.
 * @param {string} slug - Feature slug.
 * @param {{cwd:string, gate?:boolean}} opts - cwd (root the SHARED/LOCAL paths resolve against),
 *   gate (records mode; the CLI, not this function, turns gate+red into a non-zero exit).
 * @returns {{report:object, mermaid:(string|null)}} The trace report (covers_closure, reachability,
 *   findings[], overall "green"|"red") and a Mermaid view when a wiring map exists. Each arm
 *   self-skips (checked=false) when its artifact is absent — non-regression on pre-spine specs.
 */
export function traceLint(slug, { cwd, gate = false }) {
  const shared = sharedRoot(cwd, slug);
  const findings = [];

  // 1. Covers-closure.
  const reqPath = join(shared, "requirements.md");
  const clauses = existsSync(reqPath) ? parseRequirements(readFileSync(reqPath, "utf8")) : [];
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
  for (const id of dangling) {
    findings.push({ severity: "red", code: "COVERS-DANGLING", req: id,
      message: `an AC declares (covers: ${id}) but ${id} is not in requirements.md — a covers: link must resolve to a registered REQ.` });
  }

  const closureChecked = existsSync(reqPath);
  const coversClosure = {
    checked: closureChecked,
    requirements_total: clauses.length,
    covered_status: wantCovered.length,
    cut_status: cut.length,
    covered_by_ac: [...covered].filter((id) => knownIds.has(id)).length,
    uncovered,
    dangling_covers: dangling,
    pass: uncovered.length === 0 && dangling.length === 0,
    skipped_reason: closureChecked ? null : "no requirements.md registry — covers-closure not applicable (non-regression on pre-spine specs).",
  };

  // 2. Reachability (profile-gated). Both artifacts are markdown since ADR-0001; `readContract`
  // still accepts the legacy `.json` so a project mid-migration is checked rather than skipped.
  const wiringPath = join(shared, "wiring-map.md");
  const profilePath = join(shared, "project-profile.md");
  let reachability = { checked: false, pass: true, unreachable: [], skipped_reason: "no wiring-map — reachability not applicable." };
  let wiringMap = null;

  let wiringFound = null;
  try { wiringFound = readContract(wiringPath, WIRING_MAP); }
  catch (e) {
    findings.push({ severity: "red", code: "WIRING-UNREADABLE", message: `wiring-map is not readable (${e.message}).` });
  }
  if (wiringFound) wiringMap = wiringFound.contract;

  // HD-001. A map whose `## Wiring` table is under a heading the parser does not claim reads as
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
        const { reachable, entryResolved } = reachableFrom(entryPoint, cwd);
        if (!entryResolved) {
          reachability = { checked: false, pass: true, unreachable: [], entry_point: entryPoint,
            skipped_reason: `entry_point "${entryPoint}" does not resolve to a source file on disk — reachability skipped.` };
          findings.push({ severity: "warn", code: "ENTRY-MISSING", message: `project-profile.md entry_point "${entryPoint}" is not on disk — reachability cannot run.` });
        } else {
          const unreachable = [];
          for (const e of wiringMap.entries || []) {
            const engResolved = resolveFile(e.engine, cwd);
            const ok = engResolved ? reachable.has(engResolved) : false;
            if (!ok) {
              unreachable.push({ use_case: e.use_case, engine: e.engine, reason: engResolved ? "not imported from the entry point" : "engine file not on disk" });
              findings.push({ severity: "red", code: "UC-UNREACHABLE", uc: e.use_case,
                message: `${e.use_case}: engine "${e.engine}" is ${engResolved ? "never imported from" : "missing under"} entry_point "${entryPoint}" — the module ships orphaned from the running app.` });
            }
          }
          reachability = { checked: true, entry_point: entryPoint, entry_resolved: entryResolved,
            reachable_files: reachable.size, engines_total: (wiringMap.entries || []).length, unreachable, pass: unreachable.length === 0 };
        }
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
    findings,
    overall,
  };
  const mermaid = wiringMap ? wiringMermaid(wiringMap, new Set((reachability.unreachable || []).map((u) => u.use_case))) : null;
  return { report, mermaid };
}

// ---------------------------------------------------------------------------
/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "trace-lint.mjs --slug <slug> [--cwd <dir>] [--gate] [--quiet]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
  gate: { type: "flag" },
  quiet: { type: "flag" },
};

const isMainModule = isMain(import.meta.url);
if (isMainModule) {
  const args = runArgs(ARGV_SPEC);
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
