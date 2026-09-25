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
//   REQ-UNCOVERED  the other direction of the same edge: a registered requirement still marked
//             covered that NO acceptance criterion grades and NO scope claims. SCOPE-COVERS asks
//             whether a link resolves; this asks whether a requirement has one at all. Red here
//             and only advisory in trace-lint, because a requirement nothing reaches is a plan
//             defect the PO can still answer at L1b — cover it, or cut it on the record
//   SCOPE-PARTITION  a task claimed by more than one scope. The UC anchor is a SPEC link, not an
//             assignment: one use case is routinely implemented by several scopes, so on a
//             four-scope/one-UC cut every scope claimed every task and would build all of them.
//             Resolved by a `scope_id:` on the task (LOCAL→SHARED) or by re-cutting
//   INV-FLOOR the raw idea (intake.md) names explicit constraints (a No-gos/Constraints/
//             Edge-cases heading with real content under it) but no usecases/UC-*.md declares
//             a single [INV-NN] anywhere — a criteria-count check can't tell a healthy small
//             tree from one that silently derived nothing from the pitch
//   BREADBOARD-PLACE (red) a breadboard Place that owns UI affordances has no ux-behavior.md
//             `## Screen: … (P#)` section and is not under `## Deferred Places`
//   BREADBOARD-UI (red) a UI affordance (U#) not cited inside the screen section of any Place the
//             breadboard puts it in. CITING IS NOT PLACING: a U# specified under another Place's
//             screen passes a presence check and is exactly the defect this rule exists for
//   BREADBOARD-TRACE (warn) N#/S# cited nowhere in the spec, V# slices no scope board records,
//             U# the spec places that no manifest entry names as its `source`
//   BREADBOARD-UNPARSED (warn) a staged breadboard this reader finds no ids in — a layout it
//             cannot read must never become a hard stop
//   All four are silent when the run has no breadboard (staged, or inline in the intake).
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
import { readAllContracts, unreadableReason, ucId, reqId, scopePartitionConflicts, SCOPE_CONTRACT } from "../lib/contract.mjs";
import { UNREADABLE, LEGACY_LAYOUT } from "../lib/contract.mjs";
import { validate as validateAgainstSchema, SCHEMAS_DIR } from "./envelope.mjs";
import { breadboard as stagedBreadboard } from "../lib/paths.mjs";
import { parseBreadboard, hasBreadboardTables, idCounts } from "../lib/breadboard.mjs";
// ONE implementation of covers-closure, two reporters: trace-lint narrates it, spec-lint gates it.
// Re-deriving either here is how the advisory report and the gate start disagreeing about which
// requirement is covered. This closes the import ring spec → trace → compile → probe/resume → spec,
// which holds only while no module in it dereferences an imported binding at module-evaluation
// time — do NOT add a top-level `const x = someImportedFn()` to any of the four.
import { parseRequirements, coveredReqIds } from "./trace.mjs";
import { readBoard } from "../compile.mjs";

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
export const SCANNED = /\.(md|markdown|yml|yaml|json|txt)$/i;

/** A machine-local board id. Strict on purpose: a committed tree has no reason to carry one at all. */
const TASK_ID = /\bTASK-[A-Za-z0-9][\w.-]*/;

/**
 * The tier-direction violations one piece of text carries — the whole rule, on a string.
 *
 * EXPORTED BECAUSE IT HAS TWO ENFORCEMENT POINTS NOW, and they must not be allowed to drift.
 * `lintCommittedTier` below walks files at GATE L1b; `hooks/tier-guard.mjs` refuses the same text
 * at the moment a tool writes it, minutes earlier, while the writer still holds the context needed
 * to rephrase. Four producers wrote committed files this rule reds and none of them learned from
 * the lint, because by the time it speaks the dispatch that wrote the line is over. A second
 * enforcement point is only worth having if it enforces the SAME predicate, so both call this.
 *
 * The detail strings are the message the writer reads, so they carry the remedy, not just the
 * verdict: a board id resolves on the machine that wrote it and nowhere else, and a path into the
 * gitignored tier dangles on every clone.
 *
 * @param {string} text - The file body, or the fragment a tool is about to write.
 * @returns {Array<{kind:("board-id"|"local-path"), token:string, line:number, detail:string}>}
 *   One entry per offending line and form, in file order; [] when clean.
 */
export function tierLeaks(text) {
  // Built from the LOCAL constant, never a literal — the storage roots have exactly one home.
  const esc = LOCAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `\S+` where the walk's own rule is `\S`: the same LINES match either way (a path with one
  // non-space character after the slash has at least one), and the longer form yields the token to
  // quote back at the writer. Trailing punctuation the prose wrapped it in is trimmed off the
  // quote only — never off the test.
  const localPath = new RegExp(`${esc}/\\S+`);
  const leaks = [];
  String(text ?? "").split(/\r?\n/).forEach((line, i) => {
    const task = line.match(TASK_ID);
    if (task) {
      leaks.push({ kind: "board-id", token: task[0], line: i + 1, detail:
        `names ${task[0]} — a committed file cannot carry a board id. Boards live in ${LOCAL}/ ` +
        "(gitignored) and renumber on every regeneration, so this resolves on the machine that wrote it " +
        "and nowhere else. Cite the use case or the scope_id, which are stable." });
    }
    const path = line.match(localPath);
    if (path) {
      leaks.push({ kind: "local-path", token: path[0].replace(/[`)\]},.;:'"]+$/, ""), line: i + 1, detail:
        `points into ${LOCAL}/ — a committed file cannot reference the gitignored tier; the path ` +
        "dangles on every other clone. Name the committed artifact, or describe the tier without a path." });
    }
  });
  return leaks;
}

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
  const findings = [];
  for (const rel of walkFiles(root)) {
    if (!SCANNED.test(rel)) continue;
    let text;
    try { text = readFileSync(join(root, rel), "utf8"); } catch { continue; }
    for (const leak of tierLeaks(text)) {
      findings.push({ rule: "TIER-DIRECTION", level: "red",
        detail: `${relative(cwd, join(root, rel))}:${leak.line} ${leak.detail}` });
    }
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
      // ONE KEY SPACE. A pitch numbers its requirements `R<n>` and the registry keys off
      // `REQ-<n>`; `reqId` maps the first onto the second BEFORE the pattern below, so a link the
      // planner actually wrote resolves instead of reading as a shape warning nobody can act on.
      // A reference neither space recognises comes back verbatim and still fails the pattern.
      const req = reqId(r);
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

/** Registry sources that name the pitch's own out-of-scope section, in the spellings pitches use. */
const NOGO_SOURCE = /\bno[-\s]?gos?\b|\bnon[-\s]?goals?\b|\bout[-\s]of[-\s]scope\b|\bwill not build\b/i;

/**
 * REQ-UNCOVERED — a live requirement that nothing in the plan reaches.
 *
 * THE OTHER DIRECTION OF THE COVERS EDGE. `SCOPE-COVERS` walks the links that exist and asks
 * whether each one resolves; a requirement with no link at all satisfies it perfectly. Measured on
 * a full run of one pitch: twenty-one requirements, every one of them with an acceptance criterion
 * somewhere, and only eleven reaching a criterion the judge grades — the board is the last place a
 * requirement can be dropped without anything going red, because after L1b nobody re-reads the
 * pitch.
 *
 * WHY THE BOARD HERE IS `readBoard`, NOT `lint()`'s `tasks`. `parseBoard` (`kernel/reduce/board.mjs`)
 * builds the scheduling view and its records carry no `acceptance_criteria` field at all, while
 * `coveredReqIds` reads exactly that field — feed it the wrong board and the covered set is empty
 * and EVERY requirement reds on EVERY run. `readBoard` (`kernel/compile.mjs`) is the parser that
 * carries the criteria, and it is the only other one there may be: a second parser of the task file
 * is explicitly ruled out where the first one lives.
 *
 * A SCOPE'S CLAIM COUNTS. The arm is about requirements nothing reaches, not about which layer
 * reaches them: a clause claimed by a contract's `covers:` has an owner who answers for it at L1b,
 * even before the criterion that grades it is written. `CUT (PO-approved)` is likewise an answer
 * already given, not a defect — which is why `status` is read rather than assumed.
 *
 * @param {{clauses:Array<{id:string, clause:string, source:string, status:string}>,
 *   board:Array<object>, scopes:Array<{covers?:string[]}>}} input - The registry clauses
 *   (`parseRequirements`), the board `readBoard` parsed, and the scope contracts. An empty
 *   `clauses` (no registry on disk) yields no findings — absent artifact ⇒ arm skipped.
 * @returns {Array<{rule:string, level:("red"|"warn"), scope:string, detail:string}>} One red per
 *   uncovered live requirement; [] when every one is graded, claimed or cut.
 */
/**
 * REQ-NARRATED — a committed spec file stating the requirement-coverage verdict as fact.
 *
 * The Health Dashboard's `Coverage` row is about USE CASES and tasks, derived by inverting each
 * task's `use_case_refs` over the local board. Measured on a consumer, a worker filled its Signal
 * cell with a different claim entirely — *"every registered non-CUT REQ-id (REQ-1 … REQ-7) reaches
 * an AC carrying `(covers: REQ-…)`"*, with a 🟢 beside it — while a grep for `covers:` across the
 * whole spec folder returned that sentence and nothing else. Not one acceptance criterion carried
 * the clause, and the run's own derived report said `0/11 PASS`.
 *
 * `AGENTS.md` names the invariant this breaks: the requirements matrix is a projection, never a
 * verdict, derived from files for one named run and never narrated. The rule is the narrow,
 * checkable form of it — a dashboard Coverage row in a committed file may not name a REQ id — and
 * it cannot fire on the legitimate signal, which counts use cases and tasks.
 *
 * @param {{cwd:string, slug:string}} opts - Working root and feature slug.
 * @returns {object[]} Findings, one per offending line.
 */
export function lintNarratedCoverage({ cwd, slug }) {
  const findings = [];
  const dir = join(sharedRoot(cwd, slug), "spec");
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith(".md")); } catch { return findings; }
  for (const f of files) {
    let lines;
    try { lines = readFileSync(join(dir, f), "utf8").split(/\r?\n/); } catch { continue; }
    lines.forEach((line, i) => {
      if (!/^\|\s*Coverage\s*\|/i.test(line.trim())) return;
      const named = [...line.matchAll(/\bREQ-\d+/g)].map((m) => m[0]);
      if (!named.length) return;
      findings.push({ rule: "REQ-NARRATED", level: "red", scope: `${f}:${i + 1}`, detail:
        `${f}:${i + 1} states the requirement-coverage verdict in a committed file, naming ${named.slice(0, 3).join(", ")}` +
        `${named.length > 3 ? ` (+${named.length - 3})` : ""}. That row is the UC × Task indicator; the ` +
        "REQ → AC → criterion → verdict state is a projection derived per run (probe requirements), " +
        "never a claim a committed artifact may make — a reader who checks the file finds corroboration " +
        "for something no run measured. Say what the use cases and tasks show, and leave the requirement " +
        "matrix to the run that derives it." });
    });
  }
  return findings;
}

/**
 * REQ-UNCOVERED and REQ-NOGO — the registry's two ways of being wrong about what ships.
 *
 * @param {{clauses:object[], board:object[], scopes:object[]}} opts - The parsed registry, the
 *   board `readBoard` produced (its acceptance criteria carry the covers clauses), and the scope
 *   contracts.
 * @returns {object[]} Findings, most specific first: a no-go registered as covered is reported as
 *   itself rather than as the coverage gap it inevitably becomes.
 */
export function lintRequirementCoverage({ clauses = [], board = [], scopes = [] }) {
  const findings = [];
  const graded = coveredReqIds(board);
  // The contracts speak the pitch's numbering as readily as the registry's; `reqId` lands both in
  // the one key space before the comparison, exactly as SCOPE-COVERS does above.
  const claimed = new Set();
  for (const s of scopes) for (const r of s.covers || []) claimed.add(reqId(r).toUpperCase());
  for (const c of clauses) {
    // A NO-GO IS A CONSTRAINT, NOT A DELIVERABLE, and marking one `covered` asserts something that
    // cannot be true: nothing grades "do not build a settings screen". Measured on a consumer — a
    // coverage dispatch lifted seven clauses out of the pitch's No-gos section, registered each as
    // covered, and L1b then refused the run with seven REQ-UNCOVERED findings, correctly and
    // unavoidably. Reported here as itself, so the operator reads one cause instead of seven
    // symptoms, and named before REQ-UNCOVERED can fire on the same row.
    if (c.status === "covered" && NOGO_SOURCE.test(c.source || "")) {
      findings.push({ rule: "REQ-NOGO", level: "red", scope: c.id, detail:
        `${c.id} ← ${c.source} registers a NO-GO as a covered requirement — "${(c.clause || "").slice(0, 60)}". ` +
        "A no-go is a constraint the shape deliberately does not build, so no acceptance criterion can " +
        "grade it and nothing downstream can ever turn it green. Mark it CUT (PO-approved) in " +
        "requirements.md — the family that already means deliberately-not-built — or drop the row and give " +
        "the breach a Test Surface row (TS-NOGO-NN) instead, which is the channel that does grade one." });
      continue;
    }
    if (c.status !== "covered") continue; // CUT (PO-approved) — an answer on the record, not a gap
    const id = c.id.toUpperCase();
    if (graded.has(c.id) || claimed.has(id)) continue;
    const from = c.source ? ` ← ${c.source}` : "";
    findings.push({ rule: "REQ-UNCOVERED", level: "red", scope: c.id, detail:
      `${c.id}${from} is graded by no acceptance criterion and claimed by no scope — "${(c.clause || "").slice(0, 60)}" ` +
      "would ship unverified and nothing downstream would say so. Cover it with an AC carrying " +
      `(covers: ${c.id}), or mark it CUT (PO-approved) in requirements.md.` });
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

/** Every Place id inside a heading's parentheses — `## Screen: Sheet (P2)`, `(P1, P3)`. */
const PLACE_IN_PARENS = /\(([^)]*)\)/g;
const PLACE_ID = /\bP\d+(?:\.\d+)*\b/g;

/**
 * Cut ux-behavior.md into the screen sections a breadboard's Places are checked against.
 *
 * A section runs from its `Screen:` heading to the next heading at the same level or higher, so
 * a screen's `### States` table and behavior rules belong to it. Its Places are the P# ids in the
 * heading's parentheses; a screen with none is kept (its citations are still "somewhere") but can
 * place nothing.
 *
 * @param {string} uxText - ux-behavior.md, verbatim ("" when absent).
 * @returns {{screens: {heading: string, places: string[], body: string}[], deferred: Set<string>}}
 *   The screen sections, and the Place ids listed first-cell under `## Deferred Places`.
 */
export function uxScreens(uxText) {
  const lines = String(uxText ?? "").split(/\r?\n/);
  const screens = [];
  const deferred = new Set();
  let cur = null; // { level, heading, places, body[] } for a screen, or { level, deferred: true }
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      if (cur && level <= cur.level) cur = null;
      if (!cur) {
        const text = h[2].trim();
        if (/^screen\s*:/i.test(text)) {
          const places = [...text.matchAll(PLACE_IN_PARENS)].flatMap((m) => m[1].match(PLACE_ID) ?? []);
          cur = { level, heading: text, places, body: [] };
          screens.push(cur);
          continue;
        }
        if (/^deferred places\b/i.test(text)) { cur = { level, deferred: true }; continue; }
      }
    }
    if (!cur) continue;
    if (cur.deferred) {
      const row = line.match(/^\s*\|\s*([^|]*)\|/);
      const id = row ? row[1].replace(/[*`\[\]]/g, "").match(/^\s*(P\d+(?:\.\d+)*)\b/) : null;
      if (id) deferred.add(id[1]);
    } else cur.body.push(line);
  }
  return {
    screens: screens.map((s) => ({ heading: s.heading, places: s.places, body: s.body.join("\n") })),
    deferred,
  };
}

/**
 * Lint the spec against the pitch's breadboard: every Place with UI affordances has a screen, and
 * every UI affordance is specified on a screen of a Place the breadboard puts it in.
 *
 * PLACEMENT, NOT CITATION. The loss this exists for did not drop a new sheet's affordances — they
 * were all in the spec, inside the composer's state table. What was lost was the Place. A rule that
 * only asks "is U2 cited?" passes that spec; this one asks "is U2 cited under P2?". It checks WHICH
 * screen, never where on the screen: layout inside a Place stays the designer's.
 *
 * Absent breadboard ⇒ zero findings, the same "absent artifact ⇒ arm skipped" rule INV-FLOOR and
 * SCOPE-COVERS follow — every pre-breadboard spec and every run without one is untouched.
 *
 * @param {object} input - What to lint (destructured).
 * @param {string} input.uxText - ux-behavior.md, verbatim ("" when absent).
 * @param {string} input.specText - Every markdown file under the spec tree, concatenated.
 * @param {Array<object>} [input.scopes] - Parsed scope contracts ([] before MAP SCOPES).
 * @param {(string|null)} [input.scopeSummaryText] - scope-summary.md, or null when absent.
 * @param {(string|null)} [input.scopeBoardText] - scope-board.md, or null when absent — the scope
 *   architect's own write surface, where it records which scopes deliver each slice.
 * @param {(string|null)} input.bbText - The breadboard, or null when the run has none.
 * @returns {Array<{rule:string, level:("red"|"warn"), detail:string}>} Findings; [] when clean or
 *   when there is no breadboard.
 */
export function lintBreadboard({ uxText = "", specText = "", scopes = [], scopeSummaryText = null, scopeBoardText = null, bbText = null }) {
  if (!bbText) return [];
  const findings = [];
  const bb = parseBreadboard(bbText);
  const counts = idCounts(bb);
  if (Object.values(counts).every((n) => n === 0)) {
    findings.push({ rule: "BREADBOARD-UNPARSED", level: "warn", detail: "the run has a breadboard but no P#/U#/N#/S#/V# ids could be read from its tables — placement was not checked. A `#` or `ID` first column holding the id, and a `Place` column on affordance rows, is the layout this reads" });
    return findings;
  }

  const { screens, deferred } = uxScreens(uxText);
  /**
   * A Place as a finding names it — id and breadboard name.
   * @param {string} p - Place id.
   * @returns {string} e.g. `P2 Payment Sheet`.
   */
  const name = (p) => {
    const n = bb.places.find((x) => x.id === p)?.name;
    return n ? `${p} ${n}` : p;
  };
  /**
   * Does the text cite this exact id — `U2` but not `U21` or `U2a`?
   * @param {string} text - Markdown to search.
   * @param {string} id - A breadboard id.
   * @returns {boolean} True when the id appears as a whole word.
   */
  const cites = (text, id) => new RegExp(`\\b${id.replace(/\./g, "\\.")}\\b`).test(text);

  // BREADBOARD-PLACE — a Place with something to place needs a screen of its own.
  const owners = new Map(); // Place → the U# it owns
  for (const u of bb.ui) for (const p of u.places) (owners.get(p) ?? owners.set(p, []).get(p)).push(u.id);
  for (const [p, us] of owners) {
    if (deferred.has(p)) continue;
    if (screens.some((s) => s.places.includes(p))) continue;
    findings.push({ rule: "BREADBOARD-PLACE", level: "red", detail: `${name(p)} owns ${us.join(", ")} but ux-behavior.md has no "## Screen: … (${p})" section — add the screen or defer the Place under "## Deferred Places"; never fold it into another screen` });
  }

  // BREADBOARD-UI — each U# is specified on a screen of a Place the breadboard puts it in.
  const unplaceable = [];
  for (const u of bb.ui) {
    if (!u.places.length) { unplaceable.push(u.id); continue; }
    const live = u.places.filter((p) => !deferred.has(p));
    if (!live.length) continue;
    if (screens.some((s) => s.places.some((p) => live.includes(p)) && cites(s.body, u.id))) continue;
    const elsewhere = [...new Set(screens.filter((s) => cites(s.body, u.id)).flatMap((s) => s.places.length ? s.places : [`"${s.heading}"`]))];
    const where = elsewhere.length
      ? `is cited only under ${elsewhere.join(", ")}`
      : cites(uxText, u.id) ? "is cited in ux-behavior.md but on no screen" : "is cited on no screen";
    findings.push({ rule: "BREADBOARD-UI", level: "red", detail: `${u.id} (${live.map(name).join(" / ")}) ${where} — specify it in the screen section of its own Place` });
  }

  // BREADBOARD-TRACE — the rest of the breadboard, reported and never blocking.
  const trace = [];
  const lost = [...bb.code, ...bb.stores].map((x) => x.id).filter((id) => !cites(specText, id));
  if (lost.length) trace.push(`N#/S# cited nowhere in the spec: ${lost.join(", ")}`);
  const slicesText = [scopeSummaryText, scopeBoardText].filter((t) => t !== null && t !== undefined).join("\n");
  if (scopeSummaryText !== null || scopeBoardText !== null) {
    const unsliced = bb.slices.map((v) => v.id).filter((id) => !cites(slicesText, id));
    if (unsliced.length) trace.push(`V# slices no scope board or scope summary records: ${unsliced.join(", ")}`);
  }
  if (scopes.length) {
    const sourced = new Set(scopes.flatMap((s) => (s.affordance_manifest ?? []).map((a) => String(a?.source ?? "").trim())));
    const unsourced = bb.ui.map((u) => u.id).filter((id) => cites(uxText, id) && !sourced.has(id));
    if (unsourced.length) trace.push(`U# the spec places but no manifest entry names as its source: ${unsourced.join(", ")}`);
  }
  if (unplaceable.length) trace.push(`U# with no Place column to check placement against: ${unplaceable.join(", ")}`);
  if (trace.length) findings.push({ rule: "BREADBOARD-TRACE", level: "warn", detail: trace.join("; ") });
  return findings;
}

/**
 * The breadboard a run's spec is linted against: the staged copy, else the intake when it carries
 * one inline, else null — and null switches every BREADBOARD-* rule off.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} intakeContent - The run's intake, verbatim ("" when absent).
 * @returns {(string|null)} The breadboard text, or null when the run has none.
 */
export function runBreadboard(cwd, slug, intakeContent) {
  const p = stagedBreadboard(cwd, slug);
  if (existsSync(p)) return readFileSync(p, "utf8");
  return hasBreadboardTables(intakeContent) ? intakeContent : null;
}

/**
 * Every scope contract whose PARSED shape fails `$defs/ScopeContract`.
 *
 * `kernel/lib/contract.mjs`'s own banner promised this check — "spec-lint re-validates every parsed
 * contract against domain.schema.json, so a hand-edit that breaks the shape fails loudly instead of
 * silently widening a sandbox" — and it did not exist. `compile` validated, spec-lint did not, so a
 * contract could pass GATE L1b green and then be refused at dispatch by the one reader that checked.
 *
 * Measured 2026-09-19 on a real run: a planner wrote every `required_states` table cell bare
 * (`loading, error, ready`) where the dialect wants `[loading, error, ready]`, so all 32 manifest
 * rows across the six UI scopes parsed as strings. `verify spec` reported `red=0`; `compile` then
 * refused all six with `expected array, got string`, and those scopes were never dispatched — no
 * order, no leg, no T0 trial. The round reached EVAL with six of eighteen scopes missing and the
 * evaluator escalated rather than grading. This arm turns that into a red at the gate, naming the
 * scope and the field, with the message the compiler would otherwise produce an hour later.
 *
 * The validator is the one `compile` already uses; there is no second implementation here.
 *
 * @param {Array<{contract:object, path:string}>} contracts - Parsed contracts with their paths.
 * @param {object} domainSchema - The parsed `domain.schema.json`.
 * @returns {Array<{rule:string, level:string, scope:string, detail:string}>} One red per invalid
 *   contract; [] when the schema cannot be read (absent artifact ⇒ arm skipped).
 */
export function lintContractSchema(contracts, domainSchema) {
  const def = domainSchema?.$defs?.ScopeContract;
  if (!def) return [];
  const schema = { ...def, $defs: domainSchema.$defs };
  const out = [];
  for (const { contract, path } of contracts) {
    const c = { ...contract };
    delete c[UNREADABLE];
    delete c[LEGACY_LAYOUT];
    let res;
    try { res = validateAgainstSchema(c, schema); } catch { continue; }  // fail open, never closed
    if (res?.valid) continue;
    out.push({
      rule: "CONTRACT-SCHEMA", level: "red", scope: contract.scope_id || path,
      detail: `the contract parses, but not into the shape a WorkOrder carries — ${(res.errors || [])[0] || "schema validation failed"}. ` +
        `compile refuses an order that fails its own schema, so as written this scope would be silently undispatched. ` +
        `A list in a table cell is written [a, b], brackets and all.`,
    });
  }
  return out;
}

/**
 * Run the full spec lint (scopes + structure) for a slug.
 * @param {{cwd:string, slug:string}} opts - Working root and feature slug.
 * @returns {{slug:string, scopes:number, tasks:number, red:number, warn:number,
 *   findings:Array<object>}} Counts and the combined findings from {@link lintScopes},
 *   {@link lintStructure} and, when the run has a breadboard, {@link lintBreadboard}.
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
  const reqText = existsSync(reqFile) ? readFileSync(reqFile, "utf8") : null;
  const reqIds = reqText !== null
    ? new Set([...reqText.matchAll(/\bREQ-[A-Z0-9-]+/gi)].map((m) => m[0].toUpperCase()))
    : null;
  // Table rows only, and with the status/source cells REQ-UNCOVERED reports from — the id set
  // above is deliberately looser (it also sees ids named in the registry's prose) and stays that
  // way, because the two arms ask different questions of the same file.
  const reqClauses = reqText !== null ? parseRequirements(reqText) : [];
  const repoFiles = walkFiles(cwd);
  // Loaded HERE, not at module scope. `spec → trace → compile → probe/resume → spec` is a live
  // import ring, and a top-level dereference of an imported binding is what would break it.
  // Unreadable schema ⇒ the arm skips itself, like every other absent-artifact arm.
  let domainSchema = null;
  try { domainSchema = JSON.parse(readFileSync(join(SCHEMAS_DIR, "domain.schema.json"), "utf8")); } catch { /* arm skipped */ }

  const findings = [
    // A contract whose table this parser cannot see reads as a contract that declared no
    // table, and every rule below then passes for the part it could not read. Loud, not empty.
    ...contracts
      .map(({ contract, path }) => ({ reason: unreadableReason(contract), scope: contract.scope_id || path }))
      .filter((x) => x.reason)
      .map((x) => ({ rule: "CONTRACT-UNREADABLE", level: "red", scope: x.scope, detail: `${x.reason} — the rules below could not check what they could not read` })),
    ...lintContractSchema(contracts, domainSchema),
    ...lintScopes(scopes, repoFiles),
    ...lintScopeAnchors({ scopes, specDir: specRoot, reqIds, tasks }),
    // `readBoard`, not the `tasks` above: only the compile-order parser carries acceptance_criteria.
    ...lintRequirementCoverage({ clauses: reqClauses, board: readBoard(cwd, slug), scopes }),
    ...lintCommittedTier({ cwd, slug }),
    ...lintNarratedCoverage({ cwd, slug }),
    ...lintStructure({ specDir: specRoot, tasks, intakeContent }),
    ...(() => {
      const bbText = runBreadboard(cwd, slug, intakeContent);
      if (!bbText) return [];
      /**
       * A file's text, or null when it does not exist.
       * @param {string} p - Absolute path.
       * @returns {(string|null)} The contents, or null.
       */
      const readOr = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
      const specFiles = existsSync(specRoot) ? walkFiles(specRoot).filter((f) => f.endsWith(".md")) : [];
      return lintBreadboard({
        uxText: readOr(join(specRoot, "ux-behavior.md")) ?? "",
        specText: specFiles.map((f) => readFileSync(join(specRoot, f), "utf8")).join("\n"),
        scopes,
        scopeSummaryText: readOr(join(specRoot, "scope-summary.md")),
        scopeBoardText: readOr(join(sharedRoot(cwd, slug), "scope-board.md")),
        bbText,
      });
    })(),
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
