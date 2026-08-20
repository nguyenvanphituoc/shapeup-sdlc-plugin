// 38 — dispatch is a partition, the build order is acyclic, and derived values stay derived.
//
// WHY THIS EXISTS. Replacing the contract's `tasks[]` id list with a `use_cases[]` anchor fixed the
// tier violation and broke something else on the way past: task ownership stopped being a partition.
//
//   OLD  tasks: [TASK-001]        declared, unique — one task, one scope
//   NEW  use_cases: [UC-01]       a SPEC link, and a use case is routinely built by several scopes
//
// On the corpus's real shape — four scopes over ONE use case — every scope matched every task. That
// is not a corner case; it is what a small project looks like. It does not corrupt anything, because
// the sandbox denies a scope writing outside its substrate, so the cost lands as three denied writes
// and a burnt attempt budget per scope instead. The anchor answers "what is this scope answerable
// for"; it cannot answer "who builds this", and one field was doing both jobs.
//
// WHAT THIS MODULE PROVES:
//   (a) the regression itself: shared use case ⇒ contested task ⇒ SCOPE-PARTITION red
//   (b) an explicit `scope_id` on the LOCAL task restores the partition, in the sanctioned
//       LOCAL→SHARED direction, and a half-stamped board still resolves
//   (c) a `depends_on` cycle is red — the scheduler answers one by silently dropping to a single
//       unordered wave, which is the fan-out the ordering exists to replace
//   (d) `covers[]` is closure-checked, not just shape-checked
//   (e) the scope board carries no `wave` column — waves are Kahn levels of `depends_on` and
//       `probe resume` derives them; a hand-authored copy of a derived value is the exact defect
//       `deriveUnlocks` exists to prevent

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const SLUG = "partdemo";

/** Write a file, creating its directory. @param {string} r Root. @param {string} rel Path. @param {string} b Body. @returns {void} */
const w = (r, rel, b) => { mkdirSync(dirname(join(r, rel)), { recursive: true }); writeFileSync(join(r, rel), b); };

/** A scope contract. @param {string} id Scope id. @param {string[]} ucs Use cases. @param {string[]} deps depends_on. @returns {string} Markdown. */
const scope = (id, ucs, deps = []) => [
  "---", `scope_id: ${id}`, "topology_type: LAYER_CAKE", `use_cases: [${ucs.join(", ")}]`,
  `depends_on: [${deps.join(", ")}]`,
  `allowed_file_substrate: [src/${id}.js, test/${id}.test.js]`,
  'e2e_verification_fixtures: ["node --test"]', "hill_phase: UPHILL_UNKNOWN", "---", "", `# ${id}`, "",
].join("\n");

/** A board task. @param {string} id Task id. @param {string} uc UC. @param {string} [sid] scope_id. @returns {string} Markdown. */
const task = (id, uc, sid) => [
  "---", `id: ${id}`, "title: t", "status: ready", "priority: 1", "estimated_hours: 1",
  "type: feature", `use_case_refs: [${uc}]`, ...(sid ? [`scope_id: ${sid}`] : []),
  "depends_on: []", "unlocks: []", "---", "", "- [ ] does the thing", "",
].join("\n");

/**
 * A fixture tree: a complete spec plus the given scopes and tasks.
 * @param {{scopes:Array<string[]>, tasks:Array<string[]>}} parts - scope() and task() argument tuples.
 * @returns {string} The fixture root.
 */
function tree({ scopes, tasks }) {
  const cwd = mkdtempSync(join(tmpdir(), "struct-partition-"));
  w(cwd, `shapeup/${SLUG}/spec/domain-model.md`, "# Domain model\n");
  w(cwd, `shapeup/${SLUG}/spec/usecases/UC-01.md`, "---\nid: UC-01\n---\n\n# UC-01\n\n## Steps\n1. [INV-01] go\n");
  w(cwd, `shapeup/${SLUG}/spec/usecases/UC-02.md`, "---\nid: UC-02\n---\n\n# UC-02\n\n## Steps\n1. [INV-02] go\n");
  for (const a of scopes) w(cwd, `shapeup/${SLUG}/scopes/${a[0]}.md`, scope(...a));
  for (const a of tasks) w(cwd, `.shapeup/${SLUG}/tasks/${a[0]}.md`, task(...a));
  return cwd;
}

/**
 * Run the partition / ordering / derivation checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("81. Dispatch is a partition, the build order is acyclic, derived values stay derived");
  // =============================================================================

  const { lint } = await import(join(ROOT, "kernel/verify/spec.mjs"));
  const { tasksForScope, scopePartitionConflicts } = await import(join(ROOT, "kernel/lib/contract.mjs"));

  /** Red findings for one rule. @param {string} cwd Root. @param {string} rule Rule. @returns {Array<object>} */
  const reds = (cwd, rule) => lint({ cwd, slug: SLUG }).findings.filter((f) => f.rule === rule && f.level === "red");

  // --- (a) the regression: four scopes, one use case ---------------------------------------------
  {
    const ids = ["alpha", "beta", "gamma", "delta"];
    const cwd = tree({
      scopes: ids.map((i) => [i, ["UC-01"]]),
      tasks: ["TASK-001", "TASK-002", "TASK-003", "TASK-004"].map((t) => [t, "UC-01"]),
    });
    try {
      const f = reds(cwd, "SCOPE-PARTITION");
      if (f.length === 4) {
        ok("four scopes over one use case: every task is reported contested — the shape the corpus actually has");
      } else {
        fail(`expected 4 SCOPE-PARTITION reds (one per contested task), got ${f.length}. ` +
          "Unreported, each of the four scopes is dispatched all four tasks and has three of its four " +
          "writes denied by the sandbox, burning its attempt budget on work it was never meant to do.");
      }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (b) scope_id restores the partition, and a half-stamped board still resolves --------------
  {
    const cwd = tree({
      scopes: [["alpha", ["UC-01"]], ["beta", ["UC-01"]]],
      tasks: [["TASK-001", "UC-01", "alpha"], ["TASK-002", "UC-01", "beta"]],
    });
    try {
      if (!reds(cwd, "SCOPE-PARTITION").length) ok("an explicit scope_id on the LOCAL task resolves the contest — the volatile side names the stable one");
      else fail("stamping scope_id on every task did not clear SCOPE-PARTITION");
    } finally { rmSync(cwd, { recursive: true, force: true }); }

    const board = [
      { id: "TASK-001", use_case_refs: ["UC-01"], scope_id: "alpha" },
      { id: "TASK-002", use_case_refs: ["UC-01"] },  // not yet stamped
    ];
    const mine = tasksForScope(board, { scope_id: "alpha", use_cases: ["UC-01"] }).map((t) => t.id);
    if (mine.includes("TASK-001") && mine.includes("TASK-002")) {
      ok("a partly-stamped board still resolves: assigned tasks go to their scope, unassigned ones fall back to the UC join");
    } else fail(`a half-migrated board dropped work: alpha got ${JSON.stringify(mine)}, expected both`);

    // and the disjoint cut needs no stamping at all — non-regression
    const clean = scopePartitionConflicts(
      [{ id: "T1", use_case_refs: ["UC-01"] }, { id: "T2", use_case_refs: ["UC-02"] }],
      [{ scope_id: "a", use_cases: ["UC-01"] }, { scope_id: "b", use_cases: ["UC-02"] }],
    );
    if (!clean.length) ok("a cut where each scope owns its own use cases needs no scope_id — the UC join is already a partition");
    else fail(`a disjoint cut was reported contested: ${JSON.stringify(clean)}`);
  }

  // --- (c) a dependency cycle is red -------------------------------------------------------------
  {
    const cwd = tree({
      scopes: [["alpha", ["UC-01"], ["beta"]], ["beta", ["UC-02"], ["alpha"]]],
      tasks: [["TASK-001", "UC-01"], ["TASK-002", "UC-02"]],
    });
    try {
      const f = lint({ cwd, slug: SLUG }).findings.filter((x) => x.rule === "SCOPE-DEPS" && /cycle/i.test(x.detail));
      if (f.length === 1) ok("a depends_on cycle is red — the scheduler answers one by silently collapsing to a single unordered wave");
      else fail(`expected exactly 1 cycle finding, got ${f.length}: ${JSON.stringify(f.map((x) => x.detail.slice(0, 60)))}`);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (d) covers[] is closure-checked ------------------------------------------------------------
  {
    const cwd = tree({ scopes: [["alpha", ["UC-01"]]], tasks: [["TASK-001", "UC-01"]] });
    try {
      w(cwd, `shapeup/${SLUG}/requirements.md`, "| REQ-1 | a clause | pitch | covered | |\n");
      w(cwd, `shapeup/${SLUG}/scopes/alpha.md`,
        readFileSync(join(cwd, `shapeup/${SLUG}/scopes/alpha.md`), "utf8").replace("depends_on: []", "depends_on: []\ncovers: [REQ-99]"));
      const f = reds(cwd, "SCOPE-COVERS");
      if (f.length) ok("a covers[] entry naming a REQ that is not in the registry is red — shape alone let a scope claim coverage of nothing");
      else fail("covers: [REQ-99] against a registry holding only REQ-1 produced no red — the field traces to nothing and says so to no one");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (e) the board must not restate a derived value --------------------------------------------
  {
    const skill = readFileSync(join(ROOT, "skills/scope-architect/SKILL.md"), "utf8");
    const boardRow = skill.split(/\r?\n/).find((l) => /^\s*\|\s*scope_id\s*\|/.test(l)) || "";
    if (boardRow && !/\bwave\b/.test(boardRow)) {
      ok("the scope board's columns carry no `wave` — waves are Kahn levels of depends_on and probe resume derives them");
    } else {
      fail(`the scope-board column spec is ${JSON.stringify(boardRow.trim())}. A hand-authored 'wave' beside a ` +
        "derived one is the hand-authored-`unlocks` drift this repo already removed once with deriveUnlocks.");
    }
  }
}
