#!/usr/bin/env node
// probe owner — which scope owns a path, derived from the contracts and nothing else.
//
// WHY THIS IS A QUERY AND NOT A SENTENCE. GATE H's census stated ownership facts without reading
// the contracts: a ship report said no scope owned the app's page files, while the composition
// root's committed substrate listed `pages/**` in plain sight. The real gap was elsewhere (a route
// table naming files nobody had written), and the report pointed the PO at a scope cut that was
// not the problem. A census that narrates ownership from memory is a census that can be wrong in
// exactly the way that looks most authoritative.
//
// Ownership already has ONE mechanical definition in this plugin — the substrate the sandbox hook
// enforces, and the election `harness compile` runs to address a cited bug to the scope that may
// write the file (`electOwner`). This probe exposes that same answer on the command line, so a
// worker that needs to say "no scope owns X" can cite the query instead of asserting it.
//
// With no `--path`, the input set is what a census would ask about anyway: every engine and
// entry-point call site the wiring map names, plus the profile's entry point. A row with no
// writers is an UNOWNED SEAM — the one kind of gap the disjointness lint cannot see, since DISJOINT
// fails two owners and nothing fails zero.
//
// Usage:
//   node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" probe owner --slug <slug> [--path <p>]... [--format json|table] [--cwd <dir>]
//
// Exit code: 0 = answered, 2 = bad argv or no readable scope contracts.

import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { runArgs, isMain } from "../lib/argv.mjs";
import { wiringMap, projectProfile } from "../lib/paths.mjs";
import { readContract, WIRING_MAP, PROJECT_PROFILE } from "../lib/contract.mjs";
import { scopeSubstrates, electOwner, bugLocations } from "../compile.mjs";
import { matchesAny } from "../../hooks/sandbox-guard.mjs";

/**
 * Ownership of one repo-relative path under a set of scope substrates.
 *
 * @param {string} path - Repo-relative POSIX path.
 * @param {Array<{scope_id:string, allowed:string[], shared:string[]}>} scopes - From
 *   {@link scopeSubstrates}.
 * @param {string} [cwd] - Project root; when given, `exists` says whether the path is on disk.
 * @returns {{path:string, owner:(string|null), writers:string[], shared_with:string[], exists:(boolean|null)}}
 *   `owner` is the elected fixer (exclusive first, lowest id among equals); `writers` every scope
 *   whose substrate admits the path; `shared_with` the writers that declare it shared. Empty
 *   `writers` means no scope may write the file — an unowned path. `exists` is the other half a
 *   census needs: a seam that is owned but not on disk is a route to a file nobody wrote.
 */
export function ownership(path, scopes, cwd = null) {
  const rel = String(path).replace(/^\.\//, "");
  const shared = (scopes || []).filter((s) => matchesAny(rel, s.shared || [])).map((s) => s.scope_id).sort();
  // `writers` is admits-the-path, the same union the sandbox fence composes (allowed ++ shared) —
  // a path declared only in a contract's `shared` list is still a scope this path may write, and
  // must read as owned rather than UNOWNED. `shared_with` (below) stays the narrower subset.
  const writers = (scopes || []).filter((s) => matchesAny(rel, s.allowed) || matchesAny(rel, s.shared || [])).map((s) => s.scope_id).sort();
  return { path: rel, owner: electOwner(rel, scopes), writers, shared_with: shared, exists: cwd ? existsSync(join(cwd, rel)) : null };
}

/**
 * The paths a census asks about when none are given: the wiring map's engines and entry call
 * sites, and the profile's entry point. Only tokens that look like files are kept — an entry call
 * site is prose around a path (`src/server.ts — POST /checkout route`), and the path is what the
 * substrate can answer for.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {Array<{path:string, cited_by:string}>} Distinct paths with where each was named.
 */
export function seamPaths(cwd, slug) {
  const out = [];
  const seen = new Set();
  const add = (p, by) => { if (p && !seen.has(p)) { seen.add(p); out.push({ path: p, cited_by: by }); } };
  const wm = wiringMap(cwd, slug);
  if (existsSync(wm)) {
    const entries = readContract(wm, WIRING_MAP)?.contract?.entries || [];
    for (const e of entries) {
      for (const p of bugLocations({ location: e.engine })) add(p, `${e.use_case || "?"} engine`);
      for (const p of bugLocations({ location: e.entry_call_site })) add(p, `${e.use_case || "?"} entry_call_site`);
    }
  }
  const pp = projectProfile(cwd, slug);
  if (existsSync(pp)) {
    const ep = readContract(pp, PROJECT_PROFILE)?.contract?.entry_point;
    for (const p of bugLocations({ location: ep })) add(p, "project-profile entry_point");
  }
  return out;
}

/**
 * Render the report as a fixed-width table for a human reading a gate block.
 * @param {object} r - The report {@link cli} prints.
 * @returns {string} One header line and one row per path.
 */
export function renderTable(r) {
  const rows = r.paths.map((p) => [p.path, p.owner || "—", p.writers.join(",") || "UNOWNED", p.exists === null ? "?" : p.exists ? "yes" : "MISSING", p.cited_by || ""]);
  const head = ["path", "owner", "writers", "on disk", "cited by"];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((row) => String(row[i]).length)));
  const line = (row) => row.map((c, i) => String(c).padEnd(w[i])).join("  ").trimEnd();
  return [line(head), line(w.map((n) => "-".repeat(n))), ...rows.map(line),
    "", `${r.scopes} scope(s) read · ${r.unowned.length} unowned path(s)${r.unowned.length ? `: ${r.unowned.join(", ")}` : ""}` +
    ` · ${r.missing.length} not on disk${r.missing.length ? `: ${r.missing.join(", ")}` : ""}`].join("\n");
}

export const ARGV_SPEC = {
  usage: "harness.mjs probe owner --slug <slug> [--path <p>]... [--format json|table] [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  path: { type: "str", multiple: true },
  format: { type: "enum", values: ["json", "table"], default: "json" },
  cwd: { type: "path" },
};

/**
 * Answer "which scope owns this path" from the committed contracts.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {Promise<void>} Exits 0 with the report, 2 when no scope contract can be read.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const scopes = scopeSubstrates(cwd, args.slug);
  if (!scopes.length) {
    console.error(`probe owner: no readable scope contract for ${args.slug} — ownership is a property of the contracts, and there are none to read`);
    process.exit(2);
  }
  const asked = (args.path || []).map((p) => ({ path: p, cited_by: "--path" }));
  const inputs = asked.length ? asked : seamPaths(cwd, args.slug);
  const paths = inputs.map((i) => ({ ...ownership(i.path, scopes, cwd), cited_by: i.cited_by }));
  const report = {
    slug: args.slug,
    scopes: scopes.length,
    source: asked.length ? "--path" : "wiring-map + project-profile",
    paths,
    unowned: paths.filter((p) => p.writers.length === 0).map((p) => p.path),
    // Owned but absent: the wiring names a file nobody wrote — the gap a census reads as
    // "unowned" when it does not check the disk.
    missing: paths.filter((p) => p.exists === false).map((p) => p.path),
  };
  console.log(args.format === "table" ? renderTable(report) : JSON.stringify(report, null, 2));
  process.exit(0);
}

if (isMain(import.meta.url)) cli(process.argv.slice(2));
