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
//   TIER-DIRECTION  ANY committed (SHARED) file referencing the LOCAL tier: a `TASK-` id in
//             prose, a table cell or frontmatter, or a path into .shapeup/. Scans the whole
//             shapeup/<slug>/ tree, because the leak was never confined to the two corners the
//             narrower checks watched — measured across nine runs it was 264 ids in
//             spec/synthesis.md, 183 in scope-summary.md, 136 in scope-board.md, all in cells
//             and sentences no wikilink check can see. Persisted links flow LOCAL→SHARED only:
//             board ids renumber per machine and .shapeup/ is gitignored, so a committed
//             reference resolves for its author and nobody else. Cite the UC or scope_id.
//             (shapeup/knowledge-base/ is a sibling of the slug tree, so it is outside this
//             walk by construction — those files instruct workers, they do not cite artifacts.)
//   UC-ANCHOR a task whose use_case_refs is empty or names a UC with no usecases/UC-*.md —
//             the LOCAL→SHARED anchor must be complete (single-anchor rule; SPIKE/CHORE/
//             DOCS/MIGRATION tasks anchor elsewhere and are exempt)
//   SCOPE-ANCHOR  the same rule for the other direction's artifact: a scope contract whose
//             use_cases is empty or names a UC with no usecases/UC-*.md. The contract is
//             committed, so this anchor is what the scope↔task join is re-derived through
//   SCOPE-DEPS  a contract's depends_on naming itself, a scope not in this run, or a CYCLE —
//             build ORDER lives in the committed tier now, and the scheduler answers a cycle by
//             dumping every remaining scope into one unordered wave without reporting it
//   SCOPE-COVERS  a contract's covers entry that is not a REQ-id (warn), or names a REQ that
//             is not in requirements.md (red, when a registry exists) — shape alone let a scope
//             claim coverage of a requirement that does not exist
//   SCOPE-PARTITION  a task claimed by more than one scope. The UC anchor is a SPEC link, not an
//             assignment: one use case is routinely implemented by several scopes, so on a
//             four-scope/one-UC cut every scope claimed every task and would build all of them.
//             Resolved by a `scope_id:` on the task (LOCAL→SHARED) or by re-cutting
//   INV-FLOOR the raw idea (intake.md) names explicit constraints (a No-gos/Constraints/
//             Edge-cases heading with real content under it) but no usecases/UC-*.md declares
//             a single [INV-NN] anywhere — a criteria-count check can't tell a healthy small
//             tree from one that silently derived nothing from the pitch
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
import { specDir, scopesDir, tasksDir, intake, sharedRoot, requirements } from "../lib/paths.mjs";
import { readAllContracts, unreadableReason, ucId, scopePartitionConflicts, SCOPE_CONTRACT } from "../lib/contract.mjs";

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
        // DECLARING IT SHARED MAKES IT LEGAL, NOT SAFE, and those are different claims.
        //
        // `shared` is the escape hatch from DISJOINT: two scopes may both write an entry point when
        // both say so. That is right for the WRITE PERMISSION — `sandbox-guard` permits a path any
        // live order covers — and it says nothing about the two scopes running at the SAME TIME.
        // Measured on a shared entry point with three concurrent writers: every trial lost work,
        // because an edit is read-modify-write and the last writer wins. Every layer was individually
        // correct — the lint permitted the overlap, the waves co-scheduled the scopes, the guard
        // allowed both writes — and the join silently dropped a scope's registration.
        //
        // Reported rather than blocked: refusing a legal contract would break the case the escape
        // hatch exists for. What the scheduler needs is the FACT, so it can put two scopes sharing a
        // writable path in different waves instead of discovering the collision in the file.
        else findings.push({ rule: "SHARED-CONCURRENT", level: "warn", scope: `${a.scope_id}+${b.scope_id}`, detail: `${f} is writable by both scopes — legal, but they must not build concurrently: an edit is read-modify-write and the later writer silently drops the earlier one` });
      }
    }
  }
  return findings;
}

/** Text forms worth scanning; anything else in a committed tree is not a reference carrier. */
const SCANNED = /\.(md|markdown|yml|yaml|json|txt)$/i;

/** A machine-local board id. Strict on purpose: a committed tree has no reason to carry one at all. */
const TASK_ID = /\bTASK-[A-Za-z0-9][\w.-]*/;

/**
 * Lint the WHOLE committed tree for references into the gitignored tier.
 *
 * WHY THIS IS NOT THE SAME RULE AS TIER-DIRECTION ABOVE. That one walks wikilinks inside `spec/`
 * and one frontmatter key in `scopes/`. Neither of those is the form the violation actually takes.
 * Measured across nine completed runs, the leak is a bare `TASK-004` in a table cell or a sentence,
 * in seven committed artifact types — 264 of them in `spec/synthesis.md` alone, 183 in
 * `scope-summary.md`, 136 in `scope-board.md` — plus paths into `.shapeup/` in nine more files.
 * A rule that inspects two corners of the tree for two syntactic forms reported all of it clean.
 *
 * The template that motivates the strictness states the rule and then breaks it: `synthesis.tmpl.md`
 * says "Record only the count + status — never task ids … spec-lint flags [[tasks/...]] here as a
 * red TIER-DIRECTION finding" and then prints a dependency chain, a wave table and a critical path
 * entirely in `TASK-NNN` ids, 110 lines later, in cells no wikilink check can see.
 *
 * SCOPE IS THE SLUG'S TREE. `shapeup/knowledge-base/` is a sibling of `shapeup/<slug>/`, not a
 * child, so it is outside this walk by construction — which is right: those files are instructions
 * telling a worker what to do at runtime, not references a reader is expected to resolve.
 *
 * @param {{cwd:string, slug:string}} opts - Working root and feature slug.
 * @returns {Array<{rule:string, level:"red", detail:string}>} One finding per offending line; [] when clean.
 */
export function lintCommittedTier({ cwd, slug }) {
  const root = sharedRoot(cwd, slug);
  if (!existsSync(root)) return [];
  // Built from the LOCAL constant, never a literal — the storage roots have exactly one home.
  const localPath = new RegExp(`${LOCAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/\\S`);
  const findings = [];
  for (const rel of walkFiles(root)) {
    if (!SCANNED.test(rel)) continue;
    let lines;
    try { lines = readFileSync(join(root, rel), "utf8").split(/\r?\n/); } catch { continue; }
    lines.forEach((line, i) => {
      const at = `${relative(cwd, join(root, rel))}:${i + 1}`;
      const task = line.match(TASK_ID);
      if (task) {
        findings.push({ rule: "TIER-DIRECTION", level: "red", detail:
          `${at} names ${task[0]} — a committed file cannot carry a board id. Boards live in ${LOCAL}/ ` +
          "(gitignored) and renumber on every regeneration, so this resolves on the machine that wrote it " +
          "and nowhere else. Cite the use case or the scope_id, which are stable." });
      }
      if (localPath.test(line)) {
        findings.push({ rule: "TIER-DIRECTION", level: "red", detail:
          `${at} points into ${LOCAL}/ — a committed file cannot reference the gitignored tier; the path ` +
          "dangles on every other clone. Name the committed artifact, or describe the tier without a path." });
      }
    });
  }
  return findings;
}

/**
 * Lint the scope contract's anchor into the COMMITTED spec — the direction persisted links flow in.
 *
 * THE MIRROR OF UC-ANCHOR, for the other artifact that has to name what it builds. UC-ANCHOR makes
 * every LOCAL task name a committed use case; nothing made the COMMITTED scope contract name one,
 * and the field it carried instead was a list of LOCAL task ids. That is the exact shape
 * TIER-DIRECTION reds a spec doc for — except TIER-DIRECTION walks wikilinks inside `spec/`, and a
 * contract lives in `scopes/` and holds its pointer in frontmatter, so neither half of the existing
 * rule could see it. Measured before this rule existed: a contract naming `TASK-004`, with no board
 * anywhere in the tree, linted 0 red / 0 warn, and `compile` then wrote a build order carrying no
 * tasks at all and exited 0.
 *
 * `tasks` is red rather than a warn because there is no reading of it that is safe to carry: on the
 * machine that authored it the ids resolve and the contract looks correct, and on every other one
 * they resolve to nothing without a single check going red. A field that is only wrong somewhere
 * else is the kind this repo has been bitten by twice.
 *
 * @param {{scopes:Array<object>, specDir:string}} input - The parsed contracts and the SHARED spec dir.
 * @returns {Array<{rule:string, level:("red"|"warn"), scope:string, detail:string}>} Findings; [] when clean.
 */
export function lintScopeAnchors({ scopes, specDir: specRoot, reqIds = null, tasks = [] }) {
  const findings = [];
  // SCOPE-PARTITION — dispatch has to assign each task to exactly ONE scope.
  //
  // The UC anchor is a spec link, not an assignment: a use case is routinely implemented by several
  // scopes, which is what a vertical slice IS. On the corpus's four-scope / one-use-case cut every
  // scope claimed every task, so each would build all four and be denied by the sandbox on three of
  // them. Red rather than warn: a dispatch that is not a partition burns the attempt budget of every
  // scope in the cut. The fix is a `scope_id:` on the task (LOCAL naming SHARED, the sanctioned
  // direction) or a re-cut that gives each scope its own use cases.
  for (const c of scopePartitionConflicts(tasks, scopes)) {
    findings.push({ rule: "SCOPE-PARTITION", level: "red", scope: c.scopes.join("+"), detail:
      `${c.task_id} is claimed by ${c.scopes.length} scopes (${c.scopes.join(", ")}) — they share a use case, so the ` +
      "UC anchor cannot say who builds it. Stamp `scope_id:` on the task, or re-cut so each scope owns its own use cases." });
  }
  const ucDir = join(specRoot, "usecases");
  const ucIds = new Set(
    (existsSync(ucDir) ? readdirSync(ucDir) : []).filter((f) => /^UC-.*\.md$/.test(f)).map((f) => f.replace(/\.md$/, "")),
  );
  const ids = new Set(scopes.map((s) => s.scope_id).filter(Boolean));
  for (const s of scopes) {
    const where = s.scope_id || "(unnamed scope)";
    if (Array.isArray(s.tasks) && s.tasks.length) {
      findings.push({
        rule: "TIER-DIRECTION", level: "red", scope: where,
        detail: `contract names LOCAL task ids [${s.tasks.join(", ")}] — a committed contract cannot point into ` +
          `.shapeup/ (gitignored, and boards renumber per machine), so these dangle on every other clone. ` +
          "Anchor with use_cases: [UC-…] instead; the scope's tasks are re-derived from the board's own use_case_refs.",
      });
    }
    const anchors = (s.use_cases || []).map(ucId).filter(Boolean);
    if (!anchors.length) {
      findings.push({
        rule: "SCOPE-ANCHOR", level: "red", scope: where,
        detail: "empty use_cases — every scope must anchor into the committed spec (LOCAL→SHARED, the same " +
          "single-anchor rule tasks follow). Without it nothing can say which tasks, requirements or " +
          "affordances this scope is answerable for.",
      });
    }
    for (const uc of anchors) {
      if (!ucIds.has(uc)) findings.push({ rule: "SCOPE-ANCHOR", level: "red", scope: where, detail: `use_cases "${uc}" does not resolve to usecases/${uc}.md` });
    }
    // `depends_on` carries the build ORDER now that task ids no longer do, so a dangling id is a
    // silently-dropped edge in the scheduler (which fails open by design) — reported here instead.
    for (const d of s.depends_on || []) {
      const id = String(d).trim();
      if (id === s.scope_id) findings.push({ rule: "SCOPE-DEPS", level: "red", scope: where, detail: `depends_on names itself — a scope cannot wait for its own completion` });
      else if (id && !ids.has(id)) findings.push({ rule: "SCOPE-DEPS", level: "red", scope: where, detail: `depends_on "${id}" is not a scope in this run — the scheduler drops the edge, so this scope may build before its dependency` });
    }
    for (const r of s.covers || []) {
      const req = String(r).trim();
      if (!/^REQ-[A-Z0-9-]+$/i.test(req)) {
        findings.push({ rule: "SCOPE-COVERS", level: "warn", scope: where, detail: `covers "${r}" is not a REQ-id — the requirement edge will not resolve` });
        continue;
      }
      // CLOSURE, not just shape. Validating the format alone let a scope claim a requirement that
      // does not exist — the field read as traceability while tracing to nothing. Checked only when
      // a registry is on disk, so a pre-spine spec is unaffected (absent artifact ⇒ arm skipped).
      if (reqIds && !reqIds.has(req.toUpperCase())) {
        findings.push({ rule: "SCOPE-COVERS", level: "red", scope: where, detail: `covers "${req}" is not in requirements.md — a covers: link must resolve to a registered REQ, or the scope claims coverage of nothing` });
      }
    }
  }

  // SCOPE-DEPS cycles. `scopeWaves` guards a cycle by dumping the remainder into ONE wave and
  // reporting nothing, so a cyclic cut silently degrades to the unscheduled fan-out the scheduler
  // exists to replace. Now that build order lives on the contract, the cycle has to be reported
  // where it can still be fixed.
  for (const cyc of depCycles(scopes)) {
    findings.push({ rule: "SCOPE-DEPS", level: "red", scope: cyc[0], detail:
      `depends_on cycle: ${cyc.join(" → ")} → ${cyc[0]} — no build order satisfies it, so the scheduler drops to a single unordered wave` });
  }
  return findings;
}

/**
 * Every dependency cycle among the scopes, each reported once from its lowest-sorting member.
 * @param {Array<{scope_id:string, depends_on?:string[]}>} scopes - The contracts.
 * @returns {string[][]} One id path per distinct cycle; [] when the relation is acyclic.
 */
function depCycles(scopes) {
  const deps = new Map(scopes.map((s) => [s.scope_id, (s.depends_on || []).map((d) => String(d).trim())]));
  const seen = new Set();
  const cycles = [];
  for (const start of deps.keys()) {
    const stack = [];
    /**
     * Depth-first walk recording any cycle reached from `start`.
     * @param {string} id - The scope currently being entered.
     * @returns {void}
     */
    const walk = (id) => {
      const at = stack.indexOf(id);
      if (at !== -1) {
        const cyc = stack.slice(at);
        const key = [...cyc].sort().join("|");
        if (!seen.has(key)) { seen.add(key); cycles.push(cyc); }
        return;
      }
      if (!deps.has(id)) return;
      stack.push(id);
      for (const d of deps.get(id)) walk(d);
      stack.pop();
    };
    walk(start);
  }
  return cycles;
}

// Match a heading-like line naming No-gos/Constraints/Edge-cases anywhere in the free-form raw
// idea, any markdown heading level, case-insensitive.
const CONSTRAINT_HEADING = /^#{1,6}\s*(no-?gos|constraints|edge[\s-]?cases)\b/im;

/**
 * Does the raw idea (intake.md, verbatim and free-form) name an explicit constraints section
 * with real content under it — as opposed to naming the heading and leaving it empty? Only a
 * pitch that actually named constraints obligates the derived spec tree to have derived at
 * least one invariant from them (INV-FLOOR below); a pitch that never raised the topic is not
 * evidence of a thinned tree.
 * @param {string} intakeContent - The raw idea, verbatim (may be "" when no intake.md exists).
 * @returns {boolean} True when a No-gos/Constraints/Edge-cases heading is followed by non-blank,
 *   non-comment content before the next heading (or end of file).
 */
export function intakeNamesConstraints(intakeContent) {
  if (!intakeContent) return false;
  const lines = intakeContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!CONSTRAINT_HEADING.test(lines[i])) continue;
    let body = "";
    for (let j = i + 1; j < lines.length && !/^#{1,6}\s/.test(lines[j]); j++) body += lines[j] + "\n";
    if (body.replace(/<!--[\s\S]*?-->/g, "").trim().length > 0) return true;
  }
  return false;
}

/**
 * Lint spec-tree completeness, wikilink resolution, tier-direction, task frontmatter/graph
 * integrity (edge symmetry, dependency existence), UC-anchor completeness, and the invariant
 * floor against a pitch that named constraints.
 * @param {{specDir:string, tasks:Array<object>, intakeContent?:string}} input - The SHARED spec
 *   dir, the parsed board, and the raw idea's verbatim text (intake.md; "" when absent — a run
 *   with no intake on disk cannot be checked against it, so INV-FLOOR simply cannot fire).
 * @returns {Array<{rule:string, level:("red"|"warn"), detail:string}>} Findings; [] when clean.
 */
export function lintStructure({ specDir, tasks, intakeContent = "" }) {
  const findings = [];
  const ucDir = join(specDir, "usecases");
  if (!existsSync(join(specDir, "domain-model.md"))) findings.push({ rule: "STRUCTURE", level: "red", detail: "domain-model.md missing" });
  const ucs = existsSync(ucDir) ? readdirSync(ucDir).filter((f) => /^UC-.*\.md$/.test(f)) : [];
  if (!ucs.length) findings.push({ rule: "STRUCTURE", level: "red", detail: "usecases/ has no UC-*.md — nothing to build or grade against" });
  let anyInvariant = false;
  for (const f of ucs) {
    const body = readFileSync(join(ucDir, f), "utf8");
    if (!/^##\s+Steps/m.test(body)) findings.push({ rule: "STRUCTURE", level: "warn", detail: `${f} has no ## Steps section` });
    if (/\[INV-\d+\]/.test(body)) anyInvariant = true;
  }
  // INV-FLOOR — a criteria-count check can't tell a healthy small tree from one that derived
  // nothing from the pitch. Only fire when the pitch itself named constraints: a pitch that
  // never raised the topic is not evidence of a thinned tree.
  if (!anyInvariant && intakeNamesConstraints(intakeContent)) {
    findings.push({ rule: "INV-FLOOR", level: "red", detail: "intake.md names explicit constraints (a No-gos/Constraints/Edge-cases section with content) but no usecases/UC-*.md declares a single [INV-NN] anywhere — the spec tree derived nothing from the pitch's own constraints" });
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
      const uc = ucId(r);
      if (!ucIds.has(uc)) findings.push({ rule: "UC-ANCHOR", level: "red", detail: `${t.id} use_case_refs "${r}" does not resolve to usecases/${uc}.md` });
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
  const intakePath = intake(cwd, slug);
  const intakeContent = existsSync(intakePath) ? readFileSync(intakePath, "utf8") : "";
  // The REQ registry, when the tree has one — absent means covers-closure simply cannot apply.
  const reqFile = requirements(cwd, slug);
  const reqIds = existsSync(reqFile)
    ? new Set([...readFileSync(reqFile, "utf8").matchAll(/\bREQ-[A-Z0-9-]+/gi)].map((m) => m[0].toUpperCase()))
    : null;
  const repoFiles = walkFiles(cwd);
  const findings = [
    // A contract whose table this parser cannot see reads as a contract that declared no
    // table, and every rule below then passes for the part it could not read. Loud, not empty.
    ...contracts
      .map(({ contract, path }) => ({ reason: unreadableReason(contract), scope: contract.scope_id || path }))
      .filter((x) => x.reason)
      .map((x) => ({ rule: "CONTRACT-UNREADABLE", level: "red", scope: x.scope, detail: `${x.reason} — the rules below could not check what they could not read` })),
    ...lintScopes(scopes, repoFiles),
    ...lintScopeAnchors({ scopes, specDir: specRoot, reqIds, tasks }),
    ...lintCommittedTier({ cwd, slug }),
    ...lintStructure({ specDir: specRoot, tasks, intakeContent }),
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
