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
import { splitFrontmatter } from "../lib/contract.mjs";
import {
  intake, harnessRun, wiringMap, projectProfile, scopesDir, resultsDir, ordersDir,
  orientDir, activeScope, activeOrder, usecasesDir, tasksDir,
} from "../lib/paths.mjs";

/** The run-state values `references/state.md` defines. A typo'd status is a rejection,
 *  not a write — the whole point of this file is that a write nobody validates is a write nobody
 *  can trust. */
export const RUN_STATUSES = ["orienting", "mapping", "building", "evaluating", "shipped", "escalated"];

/** ORIENT's four artifacts (skills/orient/SKILL.md §Outputs): three by exact name, plus a spike
 *  whose filename carries the area it spiked (`spike-<area>.md`, or `spike-not-needed.md` when
 *  the risk scan came back rank 0 — both count, because both are ORIENT having finished). */
export const ORIENT_REQUIRED = ["code-surface.md", "discovered-seed.md", "hill-signal.md"];
export const ORIENT_SPIKE = /^spike-.+\.md$/;

/**
 * Parse a leading `---` frontmatter block into a flat object, through the ONE library that reads
 * this file form (`lib/contract-md.mjs`).
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
 * THE ORDER IS DERIVED, NEVER DECLARED. Each scope contract names its `tasks`, and each task file
 * carries `depends_on`. Scope A follows scope B when any task of A depends on a task of B. Nothing
 * new is authored, and nothing here can disagree with the board — the fan-out was discarding an
 * ordering its own inputs already hand it.
 *
 * NON-REGRESSION IS THE DEFAULT. Any missing or unreadable input — no board, no `tasks` in a
 * contract, a dependency cycle — falls back to one wave containing everything, which is exactly
 * today's behavior. A scheduler that refuses to run is worse than one that runs unscheduled.
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

  // task id → the scope that owns it, from each contract's `tasks` frontmatter list.
  const owner = new Map();
  for (const s of scopes) {
    let tasks = [];
    try { tasks = parseFrontmatter(readFileSync(s.path, "utf8")).tasks; } catch { tasks = []; }
    if (!Array.isArray(tasks)) continue;
    for (const t of tasks) owner.set(String(t).trim(), s.scope_id);
  }
  if (!owner.size) return [all];

  // scope → the scopes it depends on, via its tasks' `depends_on`.
  const deps = new Map(scopes.map((s) => [s.scope_id, new Set()]));
  let sawEdge = false;
  const tdir = tasksDir(cwd, slug);
  let taskFiles = [];
  try { taskFiles = readdirSync(tdir).filter((f) => /^TASK-[\w.-]+\.md$/i.test(f)); } catch { return [all]; }
  for (const f of taskFiles) {
    let fm;
    try { fm = parseFrontmatter(readFileSync(join(tdir, f), "utf8")); } catch { continue; }
    const mine = owner.get(String(fm.id ?? "").trim());
    if (!mine || !Array.isArray(fm.depends_on)) continue;
    for (const d of fm.depends_on) {
      const from = owner.get(String(d).trim());
      if (from && from !== mine) { deps.get(mine).add(from); sawEdge = true; }
    }
  }
  if (!sawEdge) return [all];

  // Kahn, one wave per level. A cycle cannot stall the build: the remainder ships as one wave.
  const byId = new Map(scopes.map((s) => [s.scope_id, s]));
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
    has_wiring_map: existsSync(wiringMap(cwd, slug)),
    project_profile_path: projectProfile(cwd, slug),
    has_project_profile: existsSync(projectProfile(cwd, slug)),
    scope_files,
    // The same scopes, grouped so a wave never contains a scope depending on one still in flight.
    // Additive: a caller that ignores it gets exactly today's behavior.
    scope_waves: scopeWaves(cwd, slug, scope_files),
    pending_orders: orderFiles.filter((f) => f.endsWith(".json") && !resultFiles.includes(f)),
    eval_rounds_done: resultFiles
      .filter((f) => /^evaluate-r\d+\.json$/.test(f))
      .map((f) => Number(f.match(/\d+/)[0])),
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
    return { ok: false, path: p, status, reason: `harness-run.md carries no "status:" line to replace — the ledger's frontmatter is malformed (references/state.md)` };
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
  usage: "harness.mjs probe resume --slug <slug> [--cwd <dir>] [--require <phase> | --set-status <status> | --set-active-order <path>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
  require: { type: "enum", values: PHASES },
  "set-status": { type: "enum", values: RUN_STATUSES },
  "set-active-order": { type: "str" },
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

  const ops = [args.require && "--require", args.setStatus && "--set-status", args.setActiveOrder && "--set-active-order"].filter(Boolean);
  if (ops.length > 1) {
    process.stderr.write(JSON.stringify({ error: "conflicting_flags", flags: ops, expected: "one operation per invocation" }) + "\n");
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

  console.log(JSON.stringify(deriveResumeState(cwd, args.slug)));
  process.exit(0);
}

