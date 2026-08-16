#!/usr/bin/env node
// Spec lint — the checks that must hold before a board becomes work.
//
// The mechanical half of the old ba-pitch-analyzer Phase 7a self-audit + Phase 7c parse steps
// + Phase 6b PA1/PA2 lints — checkbox walking and glob checks a model should never grade on
// its own output (a worker grading itself was always a judge-purity smell):
//
//   PA1  a scope substrate aligned 1:1 with a single top-level directory (directory-thinking)
//   PA2  a scope substrate resolving to more than the size cap (~15 files)
//   DISJOINT  a path matched by two scopes' allowed_file_substrate without BOTH declaring it
//             in shared_substrate
//   STRUCTURE spec tree completeness (usecases/ ≥1 UC, domain-model, UC ## Steps),
//             unresolved wikilinks, task frontmatter completeness, unlocks edge-symmetry,
//             depends_on referencing unknown tasks
//   TIER-DIRECTION  a committed (SHARED) spec doc wikilinking the LOCAL board ([[tasks/...]]).
//             Persisted links flow LOCAL→SHARED only: task ids are machine-local (boards
//             regenerate and renumber) and .shapeup/ is gitignored — a committed task
//             link dangles on every fresh clone. Cite the UC or scope_id instead.
//   UC-ANCHOR a task whose use_case_refs is empty or names a UC with no usecases/UC-*.md —
//             the LOCAL→SHARED anchor must be complete (single-anchor rule; SPIKE/CHORE/
//             DOCS/MIGRATION tasks anchor elsewhere and are exempt)
//
// Zero dependencies (glob matcher inlined from hooks/sandbox-guard.mjs). Judgment stays in the skill
// (gap severity, lens choice); this script only reports facts.
//
// Usage:  node kernel/harness.mjs verify spec --slug <slug> [--cwd <dir>]
// Prints a JSON report. Exit 0 = no red findings, 1 = at least one red.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { parseBoard, deriveUnlocks } from "../reduce/board.mjs";
import { runArgs } from "../lib/argv.mjs";
import { LOCAL } from "../lib/paths.mjs";
import { specDir, scopesDir, tasksDir } from "../lib/paths.mjs";
import { readAllContracts, unreadableReason, SCOPE_CONTRACT } from "../lib/contract.mjs";

// Inlined from hooks/sandbox-guard.mjs so this skill ships self-contained (a skill's scripts
// must not reach outside its own folder — channels that copy only skills/ would dangle).
/**
 * Compile a substrate glob into an anchored RegExp (inlined from sandbox-guard so the skill ships
 * self-contained). Supports single-star, double-star, and double-star-slash segment wildcards.
 * @param {string} glob - The glob pattern.
 * @returns {RegExp} A full-string (`^…$`) matcher for repo-relative paths.
 */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += glob[i + 2] === "/" ? "(?:[^/]+/)*" : ".*";
        i += glob[i + 2] === "/" ? 2 : 1;
      } else re += "[^/]*";
    } else if ("\\^$.|?+()[]{}".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp(`^${re}$`);
}

const SIZE_CAP = 15;

/**
 * Recursively list repo-relative file paths under a root, skipping .git/node_modules/.shapeup.
 * @param {string} root - The base the results are made relative to.
 * @param {string} [dir=root] - Current directory being walked (callers omit it).
 * @param {string[]} [acc=[]] - Accumulator (callers omit it).
 * @returns {string[]} Repo-relative paths of every file found.
 */
function walkFiles(root, dir = root, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === LOCAL) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(root, p, acc);
    else acc.push(relative(root, p));
  }
  return acc;
}

/**
 * Lint scope contracts for PA1 (directory-thinking), PA2 (size cap), and DISJOINT substrate overlap.
 * @param {Array<{scope_id:string, topology_type?:string, allowed_file_substrate?:string[],
 *   shared_substrate?:string[]}>} scopes - The scope contracts.
 * @param {string[]} repoFiles - Repo-relative file list the substrate globs resolve against.
 * @returns {Array<{rule:string, level:("red"|"warn"), scope:string, detail:string}>} Findings; [] when clean.
 */
export function lintScopes(scopes, repoFiles) {
  const findings = [];
  /**
   * Resolve a list of substrate globs to the repo files they match.
   * @param {(string[]|undefined)} globs - Glob patterns (undefined → none).
   * @returns {string[]} The repo-relative files matched by any glob (deduplication is the caller's).
   */
  const resolveGlobs = (globs) => {
    const res = (globs || []).map((g) => globToRegExp(g));
    return repoFiles.filter((f) => res.some((r) => r.test(f)));
  };
  for (const s of scopes) {
    const allowed = s.allowed_file_substrate || [];
    // PA1 — directory-thinking: every glob confined to ONE layer directory (e.g. all of it
    // under apps/web/). A flow slice crosses layers (apps/web/cart + apps/api/cart passes).
    const layers = new Set(allowed.map((g) => g.split("/").slice(0, 2).join("/")));
    if (allowed.length && layers.size === 1 && s.topology_type !== "CHOWDER") {
      findings.push({ rule: "PA1", level: "red", scope: s.scope_id, detail: `substrate aligns 1:1 with '${[...layers][0]}/' — slice by flow, not by directory` });
    }
    // PA2 — resolved file count over the cap (chowder absorbs true strays).
    const files = resolveGlobs(allowed);
    if (files.length > SIZE_CAP && s.topology_type !== "CHOWDER") {
      findings.push({ rule: "PA2", level: "warn", scope: s.scope_id, detail: `substrate resolves to ${files.length} files (cap ~${SIZE_CAP}) — consider splitting` });
    }
    // T0-UNVERIFIABLE — a scope with no fixtures the parser can see.
    //
    // RED, not warn, and it is the most important line in this file. `runFixtures` used to answer
    // `pass: true` for an empty list (`[].every(…)` is `true`), so a scope whose fixtures did not
    // PARSE was certified T0-green having executed nothing — "measured, not claimed" inverted into
    // "nothing measured, therefore green", in the one layer the evaluator must cite.
    //
    // It is not hypothetical and it is not an authoring slip in the usual sense: the architect wrote
    // GOOD fixtures (`node --test test/…`) as a markdown `## e2e_verification_fixtures` section
    // instead of a frontmatter key. The substrate list beside it, written as a frontmatter block
    // list, parsed perfectly. One field silently reached the scorer as `undefined` and the scope
    // went green on zero evidence.
    //
    // `verify t0` now refuses to call an unrun scope green, so the failure is loud either way. This
    // catches it one gate earlier, where the fix is editing a contract rather than burning a round.
    if (!(s.e2e_verification_fixtures || []).length) {
      findings.push({
        rule: "T0-UNVERIFIABLE", level: "red", scope: s.scope_id,
        detail: "no e2e_verification_fixtures the parser can see — T0 has nothing to run, so this scope " +
          "cannot be verified. Declare them as a FRONTMATTER key (a `- ` block list or a [a, b] inline " +
          "list); a `## e2e_verification_fixtures` markdown section is not read, and a scope whose " +
          "fixtures silently vanish is a scope certified on no evidence.",
      });
    }
    // T0-UNPASSABLE — a fixture whose own comment declares a non-zero exit.
    //
    // `verify t0` scores a fixture as passing iff it exits 0, and that rule lived only in the
    // scorer. Handed a contract that said "commands that drive this scope end-to-end", an architect
    // wrote the error paths as bare invocations — `todo done abc  # E_INVALID_INDEX, exit 1` — which
    // cannot pass by construction. Four of six scopes then burned their attempt budget on code that
    // was already correct, and the run reported them as hard scopes.
    //
    // Caught here because the cost of finding it late is measured in whole attempts: this is the
    // last gate before BUILD spends anything. Matched on the author's OWN declaration of a non-zero
    // exit, not on guessing what a command does — a fixture that merely mentions "exit" in another
    // sense does not match, and a warn never blocks a run.
    for (const fx of s.e2e_verification_fixtures || []) {
      const m = String(fx).match(/#[^#]*\bexit\s+([1-9]\d*)\b/i);
      if (m) {
        findings.push({
          rule: "T0-UNPASSABLE", level: "warn", scope: s.scope_id,
          detail: `fixture declares "exit ${m[1]}" — T0 passes a fixture only on exit 0, so this scope cannot go green. ` +
            `Assert the error path inside a test file that itself exits 0: ${String(fx).slice(0, 60)}`,
        });
      }
    }
  }
  // DISJOINT — pairwise overlap not covered by BOTH scopes' shared_substrate.
  for (let i = 0; i < scopes.length; i++) {
    for (let j = i + 1; j < scopes.length; j++) {
      const a = scopes[i], b = scopes[j];
      const filesA = new Set(resolveGlobs(a.allowed_file_substrate));
      const overlap = resolveGlobs(b.allowed_file_substrate).filter((f) => filesA.has(f));
      const sharedA = (a.shared_substrate || []).map(globToRegExp);
      const sharedB = (b.shared_substrate || []).map(globToRegExp);
      for (const f of overlap) {
        const declared = sharedA.some((r) => r.test(f)) && sharedB.some((r) => r.test(f));
        if (!declared) findings.push({ rule: "DISJOINT", level: "red", scope: `${a.scope_id}+${b.scope_id}`, detail: `${f} is in both substrates but not in both shared_substrate lists — PA3 waiting to happen` });
      }
    }
  }
  return findings;
}

/**
 * Lint spec-tree completeness, wikilink resolution, tier-direction, task frontmatter/graph
 * integrity (edge symmetry, dependency existence), and UC-anchor completeness.
 * @param {{specDir:string, tasks:Array<object>}} input - The SHARED spec dir and the parsed board.
 * @returns {Array<{rule:string, level:("red"|"warn"), detail:string}>} Findings; [] when clean.
 */
export function lintStructure({ specDir, tasks }) {
  const findings = [];
  const ucDir = join(specDir, "usecases");
  if (!existsSync(join(specDir, "domain-model.md"))) findings.push({ rule: "STRUCTURE", level: "red", detail: "domain-model.md missing" });
  const ucs = existsSync(ucDir) ? readdirSync(ucDir).filter((f) => /^UC-.*\.md$/.test(f)) : [];
  if (!ucs.length) findings.push({ rule: "STRUCTURE", level: "red", detail: "usecases/ has no UC-*.md — nothing to build or grade against" });
  for (const f of ucs) {
    const body = readFileSync(join(ucDir, f), "utf8");
    if (!/^##\s+Steps/m.test(body)) findings.push({ rule: "STRUCTURE", level: "warn", detail: `${f} has no ## Steps section` });
  }
  // Wikilinks in spec docs must resolve within the spec dir — and never cross the tier
  // boundary: a SHARED doc linking the LOCAL board is the wrong direction by construction.
  const specFiles = existsSync(specDir) ? walkFiles(specDir) : [];
  const names = new Set(specFiles.map((f) => f.replace(/\.md$/, "")));
  for (const f of specFiles.filter((x) => x.endsWith(".md"))) {
    const body = readFileSync(join(specDir, f), "utf8");
    for (const m of body.matchAll(/\[\[([^\]#|]+)/g)) {
      const target = m[1].trim().replace(/\.md$/, "");
      if (target.startsWith("tasks/")) {
        findings.push({ rule: "TIER-DIRECTION", level: "red", detail: `${f} → [[${m[1].trim()}]] links the LOCAL board from a committed doc — links flow LOCAL→SHARED only; cite the UC or scope_id instead (task ids renumber per machine)` });
        continue;
      }
      if (!names.has(target) && ![...names].some((n) => n.endsWith(`/${target}`) || n === target)) {
        findings.push({ rule: "WIKILINK", level: "warn", detail: `${f} → [[${m[1].trim()}]] unresolved in spec dir` });
      }
    }
  }
  // Task frontmatter + graph integrity (edge symmetry — the hand-authored-unlocks drift, mechanized).
  const ids = new Set(tasks.map((t) => t.id));
  const derived = deriveUnlocks(tasks);
  for (const t of tasks) {
    for (const k of ["id", "status"]) if (!t[k] || t[k] === "unknown") findings.push({ rule: "TASK", level: "red", detail: `${t.file} missing frontmatter ${k}` });
    for (const d of t.depends_on) if (!ids.has(d)) findings.push({ rule: "TASK", level: "red", detail: `${t.id} depends_on ${d} which does not exist` });
    if (JSON.stringify([...t.unlocks].sort()) !== JSON.stringify(derived[t.id] || [])) {
      findings.push({ rule: "EDGE-SYMMETRY", level: "red", detail: `${t.id} unlocks ${JSON.stringify(t.unlocks)} ≠ derived inverse ${JSON.stringify(derived[t.id])} — run harness reduce board --write` });
    }
  }
  // UC-ANCHOR — the LOCAL→SHARED anchor must be complete: every implementation task names
  // ≥1 UC (single-anchor rule, task-generation.md) and each named UC exists on disk.
  // SPIKE/CHORE/DOCS/MIGRATION tasks anchor elsewhere (api_ref / linked_docs) — exempt.
  const ucIds = new Set(ucs.map((f) => f.replace(/\.md$/, "")));
  const anchorExempt = new Set(["spike", "chore", "docs", "migration"]);
  for (const t of tasks) {
    if (anchorExempt.has((t.type || "").toLowerCase())) continue;
    const refs = t.use_case_refs || [];
    if (!refs.length) {
      findings.push({ rule: "UC-ANCHOR", level: "red", detail: `${t.id} has empty use_case_refs — every task must anchor into the committed spec (LOCAL→SHARED, single-anchor rule)` });
      continue;
    }
    for (const r of refs) {
      const ucId = r.replace(/^\[\[|\]\]$/g, "").replace(/^usecases\//, "");
      if (!ucIds.has(ucId)) findings.push({ rule: "UC-ANCHOR", level: "red", detail: `${t.id} use_case_refs "${r}" does not resolve to usecases/${ucId}.md` });
    }
  }
  return findings;
}

/**
 * Run the full spec lint (scopes + structure) for a slug.
 * @param {{cwd:string, slug:string}} opts - Working root and feature slug.
 * @returns {{slug:string, scopes:number, tasks:number, red:number, warn:number,
 *   findings:Array<object>}} Counts and the combined findings from {@link lintScopes} and
 *   {@link lintStructure}.
 */
export function lint({ cwd, slug }) {
  const specRoot = specDir(cwd, slug);
  const contracts = readAllContracts(scopesDir(cwd, slug), SCOPE_CONTRACT);
  const scopes = contracts.map((c) => c.contract);
  const tasks = parseBoard(tasksDir(cwd, slug));
  const repoFiles = walkFiles(cwd);
  const findings = [
    // A contract whose table this parser cannot see reads as a contract that declared no
    // table, and every rule below then passes for the part it could not read. Loud, not empty.
    ...contracts
      .map(({ contract, path }) => ({ reason: unreadableReason(contract), scope: contract.scope_id || path }))
      .filter((x) => x.reason)
      .map((x) => ({ rule: "CONTRACT-UNREADABLE", level: "red", scope: x.scope, detail: `${x.reason} — the rules below could not check what they could not read` })),
    ...lintScopes(scopes, repoFiles),
    ...lintStructure({ specDir: specRoot, tasks }),
  ];
  return {
    slug,
    scopes: scopes.length,
    tasks: tasks.length,
    red: findings.filter((f) => f.level === "red").length,
    warn: findings.filter((f) => f.level === "warn").length,
    findings,
  };
}

/** The typed argv contract (see `kernel/lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs verify spec --slug <slug> [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
};

/**
 * Lint the committed spec tree against the board it must stay in step with.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const report = lint({ cwd: resolve(args.cwd || process.cwd()), slug: args.slug });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.red > 0 ? 1 : 0);
}
