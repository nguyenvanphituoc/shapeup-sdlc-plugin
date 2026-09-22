#!/usr/bin/env node
// RESUME STATE — the fast-forward derivation, as a script rather than as a string.
//
// WHY THIS FILE EXISTS (observed, not theorized).
//
// `shapeup-run.js` derives "which phase do I resume at" from disk on every launch — that
// derivation is what retires the whole class of handoff where a fresh session rebuilds a pipeline
// already on disk. Until this file existed, it lived inside the workflow script as a
// `node --input-type=module -e "…"` blob passed to a courier agent. Three consequences, all of
// them realised:
//
//   1. IT COULD NOT BE TESTED. A Workflow script has no `import`, takes `args` as a runtime
//      global, and is executed by the Workflow runtime — there is no seam a fixture can reach.
//      So the derivation shipped unverified, and the kill/resume probe found it re-dispatching a
//      COMPLETED ORIENT phase: three orient
//      artifacts rewritten, a spike added, the discovery ledger and two task files mutated.
//      The cause was one branch reading stored `status` instead of ORIENT's own artifacts,
//      while WIRE and MAP SCOPES read artifacts and fast-forwarded correctly.
//   2. IT MATCHED NO PERMISSION GRANT. An inline `node -e` matches no rule in `permissions.allow`
//      and passes only at the safety classifier's discretion. As a named script it is covered by
//      the per-script rules the installer writes (`bin/lib/grant.mjs`).
//   3. TWO WRITES HAD NO READER. `setRunStatus` and the substrate pointer were the only
//      call sites in the workflow whose return value was discarded — and they are the only two
//      whose failure went unnoticed for two entire runs. `status` never left `orienting` across
//      46 dispatched agents, and `.shapeup/active-scope` still named scope 1 while scope 2 was
//      being built, which is the pointer `hooks/sandbox-guard.mjs` reads to decide which
//      substrate a worker may write. A courier write whose result nobody reads back is
//      indistinguishable from one that succeeded. Both writes live here now, both refuse
//      silently-wrong outcomes (a missing ledger, a status line that matched nothing), and both
//      report a non-zero exit the caller is required to act on.
//
// WHAT THIS FILE DOES NOT DECIDE. It reports facts; the workflow decides phases. `next_phase` is
// offered as a derived convenience (and is what the fixture asserts over), but every underlying
// boolean travels too, so a caller is never forced to trust a summary it cannot check.
//
// WHY `--require` EXISTS (the same lesson, one layer up).
//
// Making the RESUME decision read artifacts left the COMPLETION decision reading
// nothing at all: shapeup-run.js dispatched a phase, ingested its result, and moved to the next
// gate without ever re-asking the predicate. A worker that returns `status: "escalated"` with
// `artifacts: []` — a legitimate outcome its own contract defines — satisfied that. So a phase
// that wrote no artifact was recorded as complete, the artifact-gated fast-forward then correctly
// found nothing on the next launch, re-dispatched it, and the worker escalated again: an
// unbounded loop, invisible inside one leg, which is why several runs and a status review never
// saw it.
//
// `--require <phase>` is the completion check, and it is deliberately the SAME derivation the
// fast-forward uses — not a second predicate that can drift from it. Two predicates that can
// disagree about "is this phase done" is the defect class itself.
//
// USAGE
//   node harness probe resume --slug <slug> [--cwd <dir>]              # derive, print ResumeState
//   node harness probe resume --slug <slug> --require <phase>          # post-condition: exit 6 if unmet
//   node harness probe resume --slug <slug> --set-status <status>      # write harness-run.md status
//
// Exit: 0 ok · 2 malformed argv (nothing ran) · 3 the target the operation needs is not on disk ·
//       6 the required phase's artifact is NOT on disk (the phase did not complete).

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { splitFrontmatter, uncoerce } from "../lib/contract.mjs";
import { globToRegExp } from "../verify/spec.mjs";
import {
  intake, harnessRun, wiringMap, projectProfile, scopesDir, resultsDir, ordersDir,
  orientDir, activeOrder, usecasesDir, breadboard, receipt, readReceipt, requirements,
} from "../lib/paths.mjs";
import { evalVerdict } from "./eval.mjs";

/** The run-state values `references/protocol.md` (Part 4 — State) defines. A typo'd status is a rejection,
 *  not a write — the whole point of this file is that a write nobody validates is a write nobody
 *  can trust. `aborted` is the terminal counterpart `escalated` already was: a gate
 *  resolving "abort", or a hard stop, ends the run the same way an operator-declared escalation
 *  does — neither resumes on relaunch — so both are TERMINAL_STATUSES below. */
export const RUN_STATUSES = ["orienting", "mapping", "building", "evaluating", "shipped", "escalated", "aborted"];

/**
 * The statuses a run does not come back from. `closeRun` refuses every other member of
 * {@link RUN_STATUSES} — `orienting`/`mapping`/`building`/`evaluating` are mid-flight, and writing
 * a close over one of those would stamp `closed_at` on a run a relaunch is still meant to resume.
 */
export const TERMINAL_STATUSES = ["shipped", "aborted", "escalated"];

/**
 * The RunReturn union (`kernel/schemas/domain.schema.json` `$defs/RunReturn.properties.status.enum`)
 * mapped to what closing the run means for each arm — the derivation `closeIfTerminal`
 * (`skills/tech-lead/workflows/shapeup-run.js`) now reads instead of a hand-typed
 * `status !== "aborted" && status !== "shipped"` pair that referenced {@link TERMINAL_STATUSES}
 * zero times and so could not see when a new arm went unhandled.
 *
 * A lookup answers one of three ways, and the distinction is load-bearing for what this map must
 * catch: an arm ABSENT from this object (never listed as a key) returns `undefined` — an arm the
 * schema carries that nobody has mapped, which a caller must treat as a defect, never as "fine to
 * skip". An arm mapped to a terminal status closes the run as that status. An arm mapped to `null`
 * is EXPLICITLY non-terminal — `paused` resumes on relaunch and `ok` is one inner round finishing,
 * not the run — so it is a key with a falsy value, not an omission a reader could mistake for "not
 * decided yet".
 *
 * `gate_h` → `escalated`: the breaker that tripped (`outer`/`inner`/`deadline`) travels in
 * `close_cause`, never as a new member of {@link TERMINAL_STATUSES} or {@link RUN_STATUSES} — a
 * circuit breaker tripping is not a new way a run ends, it is the reason an existing one
 * (`escalated`) fires this time.
 *
 * @type {Object<string, (string|null)>}
 */
export const RUN_RETURN_CLOSE = {
  shipped: "shipped",
  aborted: "aborted",
  gate_h: "escalated",
  paused: null,
  ok: null,
};

/**
 * Resolve one RunReturn arm to a close outcome and, when the arm is terminal, perform the close —
 * the single call `closeIfTerminal` makes instead of deciding locally which arms are terminal.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} arm - A `RunReturn.status` value.
 * @param {(string|null)} [cause] - Why the run ended there; only used when `arm` is terminal.
 * @returns {({ok:true, arm:string, terminal:false, reason:string} |
 *   {ok:false, arm:string, reason:string} |
 *   ({ok:boolean, arm:string, terminal:true} & ReturnType<typeof closeRun>))} `terminal:false` when
 *   `arm` maps to `null` (nothing closed, not an error). `ok:false` with no `terminal` field when
 *   `arm` is not a key of {@link RUN_RETURN_CLOSE} at all — a schema arm this map has not been
 *   taught, which must never be silently treated as non-terminal. Otherwise the {@link closeRun}
 *   outcome, tagged with the arm that produced it.
 */
export function closeArm(cwd, slug, arm, cause = null) {
  if (!Object.hasOwn(RUN_RETURN_CLOSE, arm)) {
    return { ok: false, arm, reason: `closeArm: "${arm}" is not a RunReturn arm this kernel maps — known arms: ${Object.keys(RUN_RETURN_CLOSE).join(", ")}` };
  }
  const status = RUN_RETURN_CLOSE[arm];
  if (!status) {
    return { ok: true, arm, terminal: false, reason: `"${arm}" is explicitly non-terminal — no close` };
  }
  return { ...closeRun(cwd, slug, { status, cause }), arm, terminal: true };
}

/** ORIENT's four artifacts (skills/orient/SKILL.md §Outputs): three by exact name, plus a spike
 *  whose filename carries the area it spiked (`spike-<area>.md`, or `spike-not-needed.md` when
 *  the risk scan came back rank 0 — both count, because both are ORIENT having finished). */
export const ORIENT_REQUIRED = ["code-surface.md", "discovered-seed.md", "hill-signal.md"];
export const ORIENT_SPIKE = /^spike-.+\.md$/;

/**
 * Parse a leading `---` frontmatter block into a flat object, through the ONE library that reads
 * this file form (`lib/contract.mjs`).
 *
 * It used to be a private scalar-only regex — every value came back a string, including a
 * `key: [a, b]` list. That is why `eval_dimensions` was pinned: the ledger could carry the set the
 * PO asked for and the `Array.isArray(hr.eval_dimensions)` branch below could never be true, so the
 * fallback fired on every read and the run graded spec-conformance whatever the file said. A second
 * parser for a format that already has one is the defect; the dialects diverge silently and the
 * reader that loses a value looks identical to a file that never carried it.
 *
 * @param {string} text - Whole file contents.
 * @returns {Object<string,*>} Frontmatter keys, coerced: `[a, b]` → string[], `~` → null,
 *   digits → number, true/false → boolean, everything else the unquoted string.
 */
export function parseFrontmatter(text) {
  return splitFrontmatter(text).meta;
}

/**
 * Has ORIENT actually produced its artifacts? This is the predicate the fast-forward's ORIENT
 * branch was missing — the comment above that branch has always described it, and until now the
 * code read a stored status field instead.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {boolean} True when all three named artifacts and at least one spike file exist.
 */
/**
 * Group the scopes into dependency WAVES: every scope in a wave can be built at the same time,
 * and no wave contains a scope that depends on one still in flight.
 *
 * WHY THIS EXISTS, measured rather than reasoned. BUILD chunked the scopes by a fixed width over
 * whatever order the directory listing gave — alphabetical. On the criterion-1 run that put
 * `cli-integration` second, in the first wave, alongside the `foundation` and command scopes its own
 * contract says it consumes ("replaces foundation's bin/todo.js placeholder", "routes to each command
 * scope's module"). It burned all three attempts at 0/2 fixtures in round 1 and its leg died in round
 * 2, so `bin/todo.js` stayed a two-line placeholder and four individually T0-green command modules
 * were unreachable from the entry point. Five of six scopes went green; the sixth was the one that
 * had to go last, and it was scheduled second by alphabet.
 *
 * THE ORDER LIVES IN THE SAME TIER AS THE THING IT ORDERS. Each scope contract declares
 * `depends_on: [scope_id, …]`, and scope A follows scope B when A names B. This used to be derived
 * instead — contract `tasks` → the board's task `depends_on` → back to the owning scope — which
 * read an ordering off the LOCAL board while the contracts it ordered were COMMITTED. On a fresh
 * clone the board is absent, every scope's task list resolved to nothing, and the whole relation
 * collapsed to "no edges": the scheduler degraded to the unscheduled fan-out this exists to
 * replace, and reported nothing, because an empty relation is the same value as no relation.
 * `scope_id` is the stable cross-machine key, so an edge between two of them survives the clone
 * that the two-hop join through renumbering task ids never could.
 *
 * NON-REGRESSION IS THE DEFAULT. Any missing or unreadable input — no contract declaring
 * `depends_on`, an id naming a scope that is not here, a dependency cycle — falls back to one wave
 * containing everything, which is exactly the pre-scheduler behavior. A scheduler that refuses to
 * run is worse than one that runs unscheduled.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {Array<{scope_id:string, path:string}>} scopes - The scopes, in their existing order.
 * @returns {string[][]} Waves of resolved scope paths, dependencies first. Order within a wave is
 *   the input order, so the result is deterministic.
 */
export function scopeWaves(cwd, slug, scopes) {
  const all = scopes.map((s) => s.path);
  if (scopes.length < 2) return all.length ? [all] : [];
  const deps = scopeDepGraph(scopes);
  if (!deps) return [all];

  // Kahn, one wave per level. A cycle cannot stall the build: the remainder ships as one wave.
  const done = new Set();
  const waves = [];
  while (done.size < scopes.length) {
    const ready = scopes.filter((s) => !done.has(s.scope_id)
      && [...deps.get(s.scope_id)].every((d) => done.has(d)));
    if (!ready.length) {
      waves.push(scopes.filter((s) => !done.has(s.scope_id)).map((s) => s.path));
      break;
    }
    waves.push(ready.map((s) => s.path));
    for (const s of ready) done.add(s.scope_id);
  }
  return waves;
}

/**
 * The dependency relation `scopeWaves` levels — parsed once, so the two answers cannot disagree.
 *
 * @param {Array<{scope_id:string, path:string}>} scopes - The scopes, in their existing order.
 * @returns {(Map<string,Set<string>>|null)} scope_id → the scope_ids it waits for, or null when the
 *   contracts carry no usable relation at all (none declares `depends_on`, or every id it names is
 *   a scope that is not in this run).
 */
function scopeDepGraph(scopes) {
  const present = new Set(scopes.map((s) => s.scope_id));
  const deps = new Map(scopes.map((s) => [s.scope_id, new Set()]));
  let sawEdge = false;
  for (const s of scopes) {
    let declared;
    try { declared = parseFrontmatter(readFileSync(s.path, "utf8")).depends_on; } catch { continue; }
    if (!Array.isArray(declared)) continue;
    for (const d of declared) {
      const id = String(d).trim();
      // An id naming a scope that is not in this run is DROPPED, not an error: a contract may
      // legitimately name a scope superseded or cut since it was written, and a scheduler that
      // stalls on a stale edge is worse than one that ignores it. spec-lint reports the dangling
      // id — this is the scheduling path, and it fails open.
      if (id && id !== s.scope_id && present.has(id)) { deps.get(s.scope_id).add(id); sawEdge = true; }
    }
  }
  return sawEdge ? deps : null;
}

/**
 * The SAME relation as {@link scopeWaves}, as edges rather than levels.
 *
 * WHY BOTH SHAPES SHIP. A level says when it is definitely safe to start a scope; an edge says when
 * it BECAME safe, and the two differ by however long the slowest sibling in the previous level takes.
 * A build that releases per level holds `cli-integration` until the last command scope lands even
 * when the only scope it consumes went green first. Levels remain the ORDER the fan-out considers
 * scopes in; edges are what release them.
 *
 * ADDITIVE, in the same sense `scope_waves` is: a consumer that ignores this field can rebuild the
 * level-release points from `scope_waves` alone, which is exactly the previous behaviour.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {Array<{scope_id:string, path:string}>} scopes - The scopes, in their existing order.
 * @returns {string[][]} `[dependant_path, dependency_path]` pairs, resolved paths on both ends so a
 *   consumer resolves ids the one way it already resolves `scope_files`. Empty when no relation is
 *   derivable — never a partial or invented one.
 */
/**
 * Pairs of scopes that must not BUILD AT THE SAME TIME, because both may write the same path.
 *
 * WHY THIS IS A SCHEDULING FACT AND NOT A LINT. `shared_substrate` is the declared escape hatch from
 * the disjointness rule: the spec lint passes an overlap both contracts declare, and the sandbox
 * guard permits that path to every live order that names it. Every layer is individually correct and
 * the join is wrong — concurrent writers to one declared-shared entry point lose each other's work,
 * with every check green. An overlap that is NOT declared shared never reaches BUILD (the lint reds
 * it and the run stops at the board review), so what this returns is precisely the set the escape
 * hatch created.
 *
 * It is an EXCLUSION, not a dependency: neither scope has to go first, they only have to not
 * overlap. The consumer orients each pair by build position, which is what keeps the constraint from
 * ever forming a cycle with a real dependency edge.
 *
 * ADDITIVE, like the two fields above it: a consumer that ignores it schedules exactly as before.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {Array<{scope_id:string, path:string}>} scopes - The scopes, in their existing order.
 * @returns {string[][]} Unordered `[pathA, pathB]` pairs. Empty when nothing can collide.
 */
export function scopeExclusions(cwd, slug, scopes) {
  if (scopes.length < 2) return [];
  const globsOf = (s) => {
    try {
      const fm = parseFrontmatter(readFileSync(s.path, "utf8"));
      return [...(fm.allowed_file_substrate || []), ...(fm.shared_substrate || [])].map((g) => String(g).trim()).filter(Boolean);
    } catch { return []; }
  };
  const globs = new Map(scopes.map((s) => [s.scope_id, globsOf(s)]));
  // Two globs MEET when either matches the other read as a literal path. It is an approximation of
  // "these two patterns can name the same file", and it is deliberately the generous one: a false
  // meet costs two scopes their overlap in time, a missed meet costs one of them its work.
  const meet = (a, b) => a === b || globToRegExp(a).test(b) || globToRegExp(b).test(a);
  const out = [];
  for (let i = 0; i < scopes.length; i++) {
    for (let j = i + 1; j < scopes.length; j++) {
      const A = globs.get(scopes[i].scope_id) || [], B = globs.get(scopes[j].scope_id) || [];
      if (A.some((a) => B.some((b) => meet(a, b)))) out.push([scopes[i].path, scopes[j].path]);
    }
  }
  return out;
}

export function scopeDeps(cwd, slug, scopes) {
  if (scopes.length < 2) return [];
  const deps = scopeDepGraph(scopes);
  if (!deps) return [];
  const pathOf = new Map(scopes.map((s) => [s.scope_id, s.path]));
  const out = [];
  for (const s of scopes) {
    for (const d of deps.get(s.scope_id) || []) {
      if (pathOf.has(d)) out.push([s.path, pathOf.get(d)]);
    }
  }
  return out;
}

export function hasOrientArtifacts(cwd, slug) {
  const dir = orientDir(cwd, slug);
  if (!existsSync(dir)) return false;
  let files;
  try { files = readdirSync(dir); } catch { return false; }
  const present = new Set(files);
  return ORIENT_REQUIRED.every((f) => present.has(f)) && files.some((f) => ORIENT_SPIKE.test(f));
}

/**
 * The use-case directory this run's spec tree lands in. The ledger may name a non-default
 * `spec_folder` (`harness init run --spec-folder`), so honour it when present and fall back to the
 * registry path otherwise — never a spelled-out root (test #45).
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string|null} specFolder - The ledger's `spec_folder`, if it names one.
 * @returns {string} Absolute path to `usecases/`.
 */
export function usecasesPath(cwd, slug, specFolder) {
  return specFolder ? resolve(cwd, specFolder, "usecases") : usecasesDir(cwd, slug);
}

/**
 * Has ANALYZE actually produced the spec tree? `_index.md` alone is a tree with no use cases in
 * it, and a wiring map is written one entry PER use case — so the index does not count.
 *
 * This predicate is why ANALYZE is in the phase chain at all. WIRE was dispatched before it ran, so
 * `usecases/` did not exist, so `solution-architect` had nothing to wire and escalated — honestly,
 * and identically on every relaunch (skills/solution-architect/SKILL.md:43-44, :108).
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string|null} specFolder - The ledger's `spec_folder`, if it names one.
 * @returns {boolean} True when at least one use case (not the index) is on disk.
 */
export function hasSpecTree(cwd, slug, specFolder) {
  const dir = usecasesPath(cwd, slug, specFolder);
  if (!existsSync(dir)) return false;
  let files;
  try { files = readdirSync(dir); } catch { return false; }
  return files.some((f) => f.endsWith(".md") && f !== "_index.md");
}

/**
 * Each dispatched phase and the artifact that IS its completion. One table, read by the resume
 * decision (`nextPhase`) and by the post-condition check (`--require`) alike — see the banner.
 */
export const PHASE_ARTIFACT = {
  orient: { fact: "has_orient_artifacts", artifact: "orient/{code-surface,discovered-seed,hill-signal}.md + spike-*.md" },
  analyze: { fact: "has_spec_tree", artifact: "spec/usecases/*.md" },
  wire: { fact: "has_wiring_map", artifact: "wiring-map.md" },
  "map-scopes": { fact: "scope_files", artifact: "scopes/*.md" },
};
export const PHASES = Object.keys(PHASE_ARTIFACT);

/**
 * Is this phase's artifact on disk? The ONE reading of "complete" in this pipeline.
 *
 * @param {object} state - A derived ResumeState.
 * @param {string} phase - One of {@link PHASES}.
 * @returns {boolean} True when the phase's artifact exists.
 */
export function phaseSatisfied(state, phase) {
  const v = state[PHASE_ARTIFACT[phase].fact];
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

/**
 * The first phase whose artifacts are incomplete — the design doc's §4 fast-forward, stated once
 * so the workflow and the fixture cannot disagree about it.
 *
 * ⟐ ANALYZE sits between ORIENT and WIRE. The pipeline used to dispatch
 * WIRE first, which is the position solution-architect's own input contract excludes — it reads
 * `usecases/`, and `analyze` is what writes them.
 *
 * @param {object} f - Facts (a derived ResumeState, or the subset the phase predicates read).
 * @returns {"orient"|"analyze"|"wire"|"map-scopes"|"build"} The phase to resume at.
 */
export function nextPhase(f) {
  for (const p of PHASES) if (!phaseSatisfied(f, p)) return p;
  return "build";
}

/**
 * Derive every path/status fact the outer pipeline needs, from files alone.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {object} The ResumeState record (domain.schema.json $defs/ResumeState).
 */
export function deriveResumeState(cwd, slug) {
  const hrPath = harnessRun(cwd, slug);
  const hr = existsSync(hrPath) ? parseFrontmatter(readFileSync(hrPath, "utf8")) : {};

  // Resolved contract PATHS, not bare filenames: harness compile and harness verify t0 both resolve
  // `--scope` against cwd, so a bare "SC-x.md" names a file that does not exist, compile-order
  // exits 2, and the attempt loop reads that non-zero exit as the stagnation breaker — a resumed
  // run would falsely trip the inner breaker and hammer-propose every scope instead of continuing.
  const sdir = scopesDir(cwd, slug);
  const scope_files = existsSync(sdir)
    ? readdirSync(sdir).filter((f) => f.endsWith(".md")).sort()
      .map((f) => ({ scope_id: f.replace(/\.md$/, ""), path: join(sdir, f) }))
    : [];

  const resultFiles = existsSync(resultsDir(cwd, slug)) ? readdirSync(resultsDir(cwd, slug)) : [];
  const orderFiles = existsSync(ordersDir(cwd, slug)) ? readdirSync(ordersDir(cwd, slug)) : [];

  const facts = {
    intake_path: intake(cwd, slug),
    // The pitch's other half, staged by `init run` beside the intake. Null when the pitch had no
    // separate breadboard — the planning dispatches then carry no `breadboard` key at all.
    breadboard_path: existsSync(breadboard(cwd, slug)) ? breadboard(cwd, slug) : null,
    // How it was found (flag | sibling | shaping-dir | shared-root | embedded), from the receipt;
    // null when there was none or the receipt cannot be read.
    breadboard_source: readReceipt(receipt(cwd, slug))?.breadboard?.source ?? null,
    spec_folder: hr.spec_folder || null,
    status: hr.status || null,
    lens: hr.lens || null,
    stack: hr.stack || null,
    run_cmd: hr.run_cmd || null,
    app_url: hr.app_url || null,
    eval_dimensions: Array.isArray(hr.eval_dimensions) ? hr.eval_dimensions : ["spec-conformance"],
    orient_dir: `.shapeup/${slug}/orient/`,
    has_orient_artifacts: hasOrientArtifacts(cwd, slug),
    has_spec_tree: hasSpecTree(cwd, slug, hr.spec_folder || null),
    // A PLAIN FACT, DELIBERATELY NOT A PHASE. The requirements registry is dispatched once, before
    // ANALYZE, and the orchestrator guards that one dispatch on this boolean. It is NOT an entry in
    // PHASE_ARTIFACT, and adding it there would be a migration hazard rather than a tidier shape:
    // that map is also `nextPhase()`'s ordered list, so every run recorded before the registry
    // existed would fast-forward to the registry instead of to `build` on its next relaunch.
    has_requirements: existsSync(requirements(cwd, slug)),
    has_wiring_map: existsSync(wiringMap(cwd, slug)),
    project_profile_path: projectProfile(cwd, slug),
    has_project_profile: existsSync(projectProfile(cwd, slug)),
    scope_files,
    // The same scopes, grouped so a wave never contains a scope depending on one still in flight.
    // Additive: a caller that ignores it gets exactly today's behavior.
    scope_waves: scopeWaves(cwd, slug, scope_files),
    // The same relation as edges. A wave says when a scope is definitely safe to start; an edge says
    // when it BECAME safe. A fan-out that releases per wave holds a scope until the slowest member of
    // the previous wave lands, even when the one scope it consumes finished first. Also additive: the
    // wave list alone rebuilds the per-wave release points, which is the previous behaviour.
    scope_deps: scopeDeps(cwd, slug, scope_files),
    // Pairs that may write the same declared-shared path. Not an ordering — an exclusion: they may
    // build in either order, and they may not build at the same time. Concurrent writers to one
    // shared entry point lose each other's work while every check stays green, and the escape hatch
    // that permits the overlap is the same one that makes it invisible to the disjointness lint.
    scope_exclusions: scopeExclusions(cwd, slug, scope_files),
    pending_orders: orderFiles.filter((f) => f.endsWith(".json") && !resultFiles.includes(f)),
    // A round is DONE when it was graded, not when its result file exists. An evaluator that
    // refused the round — no PASS/FAIL, or a scoped verdict citing no T0 artifact — still writes
    // `evaluate-r<N>.json`; counted, the relaunch opened round N+1 over a round nobody judged, with
    // no bugs to route, and rebuilt every scope. Left open, it re-enters round N, skips the scopes
    // already green there, and evaluates again.
    eval_rounds_done: resultFiles
      .filter((f) => /^evaluate-r\d+\.json$/.test(f))
      .map((f) => Number(f.match(/\d+/)[0]))
      .filter((n) => evalVerdict(cwd, slug, n).found),
  };
  return { ...facts, next_phase: nextPhase(facts) };
}

/**
 * Rewrite `harness-run.md`'s status line. Refuses rather than silently no-ops: a ledger that is
 * absent, or that carries no `status:` line to replace, is a fact the run must act on — that
 * silent no-op is exactly what pinned a run at `orienting` for two complete legs.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} status - One of {@link RUN_STATUSES}.
 * @returns {{ok: boolean, path: string, status: string, reason?: string}} Outcome record.
 */
export function setRunStatus(cwd, slug, status) {
  const p = harnessRun(cwd, slug);
  if (!existsSync(p)) {
    return { ok: false, path: p, status, reason: `no harness-run.md for slug "${slug}" — open the run with harness init run (GATE L0.1) before setting its status` };
  }
  const body = readFileSync(p, "utf8");
  if (!/^status:.*$/m.test(body)) {
    return { ok: false, path: p, status, reason: `harness-run.md carries no "status:" line to replace — the ledger's frontmatter is malformed (references/protocol.md)` };
  }
  try {
    writeFileSync(p, body.replace(/^status:.*$/m, `status: ${status}`));
  } catch (e) {
    return { ok: false, path: p, status, reason: `could not write the ledger: ${e.message}` };
  }
  const after = parseFrontmatter(readFileSync(p, "utf8")).status;
  if (after !== status) {
    return { ok: false, path: p, status, reason: `wrote "status: ${status}" but the ledger reads "${after}" — the write did not take` };
  }
  return { ok: true, path: p, status };
}

/**
 * Rewrite `status:`, `closed_at:`, `closed_status:` and `close_cause:` together, in one pass,
 * appending any of the last three that a pre-migration ledger carries no line for yet (the same
 * tolerant-of-old-ledgers discipline `close_cause` itself shipped under).
 *
 * @param {string} body - The ledger's current text.
 * @param {{status:string, closedAt:string, cause:(string|null)}} o - What to write. `cause` is
 *   already normalized prose (newlines collapsed, truncated) — this function only `uncoerce`s it.
 * @returns {string} The rewritten text.
 */
function writeCloseLines(body, { status, closedAt, cause }) {
  const causeLine = `close_cause: ${uncoerce(cause || null)}`;
  const closedStatusLine = `closed_status: ${status}`;
  let out = body
    .replace(/^status:.*$/m, `status: ${status}`)
    .replace(/^closed_at:.*$/m, `closed_at: ${closedAt}`);
  out = /^closed_status:.*$/m.test(out)
    ? out.replace(/^closed_status:.*$/m, closedStatusLine)
    // A ledger written before this field existed carries no line to replace — appended right after
    // `closed_at:`, the one line every TERMINAL_STATUSES write also touches.
    : out.replace(/^closed_at:.*$/m, (m) => `${m}\n${closedStatusLine}`);
  out = /^close_cause:.*$/m.test(out)
    ? out.replace(/^close_cause:.*$/m, causeLine)
    : out.replace(/^closed_at:.*$/m, (m) => `${m}\n${causeLine}`);
  return out;
}

/**
 * Close the run: a terminal status, its cause, and a close timestamp, written together in ONE
 * pass.
 *
 * Measured: after an EVAL worker escalated and the run aborted, `harness-run.md` still read
 * `status: evaluating`, `closed_at: ~`, with no cause recorded anywhere — a live EVAL and a dead
 * one were indistinguishable from the trace alone. Two writers made that possible: `setRunStatus`
 * above replaces the `status:` line and NOTHING ELSE, and `closed_at` was written exactly once, as
 * the literal `~`, by `init run` — nothing ever replaced it. This function is the one call site
 * that closes a run, so a terminal RunReturn cannot leave one of the three facts behind.
 *
 * Refuses rather than silently no-ops, the same discipline as `setRunStatus`: an absent ledger, one
 * missing the lines this writes, or a non-terminal `status` (closing a run still `building` would
 * stamp a live run as done) is a fact to act on, not a write to skip quietly.
 *
 * THE ONCE-ONLY GUARD READS `closed_status`, NEVER `status`. REWORK (round 2): the guard used to key
 * on `before.status`, and `status:` is a LIVE field every phase rewrites via `setRunStatus` —
 * including the product's own ship path, which stamps `status: shipped`
 * (`skills/tech-lead/workflows/shapeup-run.js`'s Ship phase) immediately before this call runs. So a
 * run closed `aborted` at Preflight on one launch, relaunched, and carried through to a `shipped`
 * RunReturn on a later one had its `status:` line rewritten to `shipped` by that ordinary phase
 * traffic BEFORE `closeIfTerminal` ever called this function — the guard read `before.status ===
 * "shipped"`, matched the very close it was about to perform, and treated a run that was actually
 * closed `aborted` as already closed `shipped`: `ok:true`, an "idempotent no-op" that silently kept
 * the abort's own `closed_at`/`close_cause` under a `status:` line now reading `shipped`. `closed_status`
 * is written ONLY here, exactly once per distinct close-writing call, so nothing between two calls to
 * this function can move it — it is the one field that actually answers "has this run been closed,
 * and to what" regardless of how many times `status:` has been rewritten since.
 *
 * WHAT A SECOND CLOSE MEANS, decided explicitly rather than left implicit. `run_id` is reused across
 * relaunches by design (AGENTS.md), so "the run's close" and "this launch's own close" are two
 * different facts a single `closed_at`/`close_cause` pair cannot both hold:
 *   - The IDENTICAL status and the IDENTICAL cause is the ordinary case a retried or duplicated call
 *     produces (the same `withWarnings` call, or a relaunch that re-executes an already-applied
 *     close) — a true no-op, `ok:true`, nothing rewritten.
 *   - The SAME terminal status but a DIFFERENT cause is a SECOND, real close — most often a later
 *     relaunch aborting again for its own reason, or shipping again after an earlier ship's close
 *     record was never superseded. Discarding it (the pre-rework behavior) silently drops the later
 *     launch's own reason with no trace of the loss. It is recorded instead: this call's cause
 *     becomes the ledger's `close_cause`, folded together with the prior cause it is superseding —
 *     the earlier fact survives inside the new line rather than the ledger simply losing it — and the
 *     return carries `superseded:true` so a caller (`closeIfTerminal`) can flag the trace as degraded
 *     rather than reporting a clean success.
 *   - A DIFFERENT terminal status altogether (aborted vs. shipped) is refused outright — flipping the
 *     actual OUTCOME of a run after the fact is not a fact a later launch gets to silently overwrite,
 *     so the original `closed_status`/`closed_at`/`close_cause` are left completely untouched and
 *     handed back to the caller.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {{status:string, cause:(string|null)}} o - The terminal status (one of
 *   {@link TERMINAL_STATUSES}) and why the run ended there. `cause` travels through `uncoerce` (the
 *   one dialect `harness-run.md`'s frontmatter is read and written in), so free prose — quotes and
 *   colons included — round-trips as one frontmatter line; an embedded newline is collapsed to a
 *   space first, because this dialect is line-based and could not carry one either way.
 * @returns {{ok:boolean, path:string, status:string, closed_at?:string, cause?:(string|null),
 *   reason?:string, closed_status?:string, superseded?:boolean, decision?:string,
 *   prior_cause?:(string|null), prior_closed_at?:string}} Outcome. A refused overwrite (already
 *   closed with a DIFFERENT terminal status) carries `closed_status`/`closed_at`/`cause` naming what
 *   is actually on disk. A successful supersede (same status, different cause) carries
 *   `superseded:true`, `decision:"superseded"` (the one-token signal the courier boundary in
 *   `shapeup-run.js` relays verbatim — see its own `cmd()` banner) and the prior close it folded in.
 */
export function closeRun(cwd, slug, { status, cause = null } = {}) {
  const p = harnessRun(cwd, slug);
  if (!TERMINAL_STATUSES.includes(status)) {
    return { ok: false, path: p, status, reason: `closeRun: "${status}" is not terminal — expected one of ${TERMINAL_STATUSES.join(" | ")}` };
  }
  if (!existsSync(p)) {
    return { ok: false, path: p, status, reason: `no harness-run.md for slug "${slug}" — open the run with harness init run (GATE L0.1) before closing it` };
  }
  let body = readFileSync(p, "utf8");
  if (!/^status:.*$/m.test(body) || !/^closed_at:.*$/m.test(body)) {
    return { ok: false, path: p, status, reason: `harness-run.md carries no "status:"/"closed_at:" line to replace — the ledger's frontmatter is malformed (references/protocol.md)` };
  }

  // Truncated, not elided: a cause this long has already done its job in the run's own log — the
  // ledger line is a pointer back to it, not the full transcript. Newlines are collapsed to spaces
  // FIRST — this dialect is line-based, so a raw embedded newline would split one field into a value
  // line and a stray, unparsed one.
  const normCause = String(cause ?? "").replace(/\r?\n/g, " ").trim().slice(0, 4000) || null;

  const before = parseFrontmatter(body);
  const priorClosedStatus = before.closed_status && before.closed_status !== "~" ? before.closed_status : null;
  const priorClosedAt = before.closed_at && before.closed_at !== "~" ? before.closed_at : null;
  const priorCause = before.close_cause && before.close_cause !== "~" ? before.close_cause : null;

  if (priorClosedStatus && priorClosedAt) {
    if (priorClosedStatus === status && normCause === priorCause) {
      // The identical fact, restated — a retried or duplicated call costs nothing.
      return { ok: true, path: p, status, closed_at: priorClosedAt, cause: priorCause, decision: "idempotent", reason: `already closed as "${status}" at ${priorClosedAt} — idempotent no-op` };
    }
    if (priorClosedStatus !== status) {
      // A DIFFERENT terminal status over an already-closed run — refused outright, the original
      // close left completely untouched so the caller can see what it was refused permission to
      // destroy, rather than losing it silently.
      return {
        ok: false, path: p, status,
        reason: `closeRun: this run is already closed as "${priorClosedStatus}" at ${priorClosedAt} (cause: ${JSON.stringify(priorCause)}) — refusing to overwrite it with "${status}". A terminal close is a once-only fact; the first cause is not destroyed.`,
        closed_status: priorClosedStatus, closed_at: priorClosedAt, cause: priorCause,
      };
    }
    // SAME terminal status, a DIFFERENT cause — a second, real close (see the function banner's
    // "what a second close means"). Superseded, not discarded: the prior cause is folded into the
    // new line rather than lost, and the return says so explicitly.
    const closedAt = new Date().toISOString();
    const foldedCause = `${normCause || "no reason recorded"} — supersedes an earlier close recorded ${priorClosedAt} (cause: ${JSON.stringify(priorCause)})`.slice(0, 4000);
    body = writeCloseLines(body, { status, closedAt, cause: foldedCause });
    try { writeFileSync(p, body); } catch (e) {
      return { ok: false, path: p, status, reason: `could not write the ledger: ${e.message}` };
    }
    const afterSup = parseFrontmatter(readFileSync(p, "utf8"));
    if (afterSup.status !== status || !afterSup.closed_at || afterSup.closed_at === "~") {
      return { ok: false, path: p, status, reason: `wrote the superseding close but the ledger reads back status="${afterSup.status}" closed_at="${afterSup.closed_at}" — the write did not take` };
    }
    return {
      ok: true, path: p, status, closed_at: afterSup.closed_at, cause: afterSup.close_cause ?? null,
      superseded: true, decision: "superseded", prior_cause: priorCause, prior_closed_at: priorClosedAt,
    };
  }

  const closedAt = new Date().toISOString();
  body = writeCloseLines(body, { status, closedAt, cause: normCause });
  try { writeFileSync(p, body); } catch (e) {
    return { ok: false, path: p, status, reason: `could not write the ledger: ${e.message}` };
  }
  const after = parseFrontmatter(readFileSync(p, "utf8"));
  if (after.status !== status || !after.closed_at || after.closed_at === "~") {
    return { ok: false, path: p, status, reason: `wrote the close but the ledger reads back status="${after.status}" closed_at="${after.closed_at}" — the write did not take` };
  }
  return { ok: true, path: p, status, closed_at: after.closed_at, cause: after.close_cause ?? null, decision: "closed" };
}

/**
 * Point the substrate pointer at the order about to be executed.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} orderPath - Path to the active order.
 * @returns {{ok: boolean, path: string, slug: string, order_path: string, reason?: string}} Outcome.
 */
export function writeActiveOrder(cwd, slug, orderPath) {
  const p = activeOrder(cwd);
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify({ slug, order_path: orderPath }, null, 2)}\n`);
  } catch (e) {
    return { ok: false, path: p, slug, order_path: orderPath, reason: `could not write the active-order pointer: ${e.message}` };
  }
  let readBack;
  try { readBack = JSON.parse(readFileSync(p, "utf8")); } catch { readBack = null; }
  if (readBack?.order_path !== orderPath || readBack?.slug !== slug) {
    return { ok: false, path: p, slug, order_path: orderPath, reason: `pointer read back as ${JSON.stringify(readBack)}` };
  }
  return { ok: true, path: p, slug, order_path: orderPath };
}

/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs probe resume --slug <slug> [--cwd <dir>] " +
         "[--require <phase> | --set-status <status> | --set-active-order <path> | " +
         "--close <status> | --close-arm <RunReturn.status> [--cause <text>]]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
  require: { type: "enum", values: PHASES },
  "set-status": { type: "enum", values: RUN_STATUSES },
  "set-active-order": { type: "str" },
  // The one call site that stamps a terminal status, its cause and closed_at together.
  close: { type: "enum", values: TERMINAL_STATUSES },
  // Not `--close`: the caller (shapeup-run.js's closeIfTerminal) hands over a RunReturn arm, never
  // a status it decided was terminal itself — RUN_RETURN_CLOSE/closeArm above make that call.
  "close-arm": { type: "str" },
  cause: { type: "str" },
};

/**
 * Derive the run's resume state, or set one of the run pointers.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();

  const ops = [args.require && "--require", args.setStatus && "--set-status", args.setActiveOrder && "--set-active-order", args.close && "--close", args.closeArm && "--close-arm"].filter(Boolean);
  if (ops.length > 1) {
    process.stderr.write(JSON.stringify({ error: "conflicting_flags", flags: ops, expected: "one operation per invocation" }) + "\n");
    process.exit(2);
  }
  if (args.cause !== undefined && !args.close && !args.closeArm) {
    process.stderr.write(JSON.stringify({ error: "conflicting_flags", flags: ["--cause"], expected: "--cause is only meaningful with --close or --close-arm" }) + "\n");
    process.exit(2);
  }

  // The post-condition. It prints the SAME ResumeState the derivation prints — plus which phase was
  // asked about and whether its artifact is there — so a caller that wants to act on the facts
  // rather than on the exit code never has to make a second call.
  if (args.require) {
    const state = deriveResumeState(cwd, args.slug);
    const satisfied = phaseSatisfied(state, args.require);
    console.log(JSON.stringify({
      ...state,
      required_phase: args.require,
      required_artifact: PHASE_ARTIFACT[args.require].artifact,
      satisfied,
    }));
    process.exit(satisfied ? 0 : 6);
  }

  if (args.setStatus) {
    const r = setRunStatus(cwd, args.slug, args.setStatus);
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 3);
  }

  if (args.setActiveOrder) {
    const r = writeActiveOrder(cwd, args.slug, args.setActiveOrder);
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 3);
  }

  if (args.close) {
    const r = closeRun(cwd, args.slug, { status: args.close, cause: args.cause ?? null });
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 3);
  }

  // The arm-derived close: the caller hands a RunReturn arm and this kernel decides — via
  // RUN_RETURN_CLOSE/closeArm above — whether it is terminal and, if so, what status it closes as.
  // Exit 0 for both a real close AND a correctly-declined non-terminal arm (`terminal:false`) —
  // neither is an error the caller (shapeup-run.js's closeIfTerminal) should treat as failed; only
  // an arm this map does not recognize at all, or a close `closeRun` itself refuses, exits non-zero.
  if (args.closeArm) {
    const r = closeArm(cwd, args.slug, args.closeArm, args.cause ?? null);
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 3);
  }

  console.log(JSON.stringify(deriveResumeState(cwd, args.slug)));
  process.exit(0);
}

