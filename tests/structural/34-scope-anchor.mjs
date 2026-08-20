// 34 — the scope contract anchors into the COMMITTED spec, never into the LOCAL board.
//
// WHAT WAS WRONG, and it was the contract's ONLY link to the work it describes. A scope contract
// lives in `shapeup/<slug>/scopes/` — committed, reviewed in a PR, cloned with the repo. The field
// it used to carry to say what it builds was `tasks: [TASK-004]`, and task ids belong to
// `.shapeup/<slug>/tasks/` — gitignored, regenerated per machine, renumbered on every regeneration.
// Every committed contract in the repo's own trace corpus carried one; none carried any committed
// anchor at all.
//
// Nothing caught it, and the rule for it already existed. `spec-lint`'s TIER-DIRECTION reds exactly
// this — "a committed doc linking the LOCAL board … cite the UC or scope_id instead" — but it walks
// wikilinks inside `spec/`, and a contract lives in `scopes/` and holds its pointer in frontmatter,
// so neither half of the rule could see it. Measured before this module existed: a contract naming
// `TASK-004`, with no board anywhere in the tree, linted 0 red / 0 warn, and `compile` then wrote a
// build order carrying NO tasks and exited 0. A dispatch with nothing in it is indistinguishable
// from a dispatch with nothing to do.
//
// WHAT THIS MODULE PROVES, against the shipped code rather than a restatement of it:
//   (a) a contract carrying a task id is RED — the legacy shape cannot pass quietly
//   (b) a contract with no `use_cases` is RED — the anchor is required, not optional
//   (c) a `use_cases` naming a UC that is not on disk is RED — the anchor has to resolve
//   (d) an anchored contract + a board is joined correctly, and the join is the one function both
//       `compile` and `reduce board` call, so the two cannot disagree about a scope's tasks
//   (e) `compile` selects tasks through that anchor — the end-to-end replacement for the id list
//   (f) `depends_on` naming a scope that is not in the run is RED (the scheduler drops it silently)
//
// Its own module because no existing test drives the contract's spec anchor at all: every prior
// fixture treated `tasks` as inert filler the generic frontmatter parser happened to carry.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const SLUG = "anchordemo";

/** Write a file, creating its directory. @param {string} root Base. @param {string} rel Relative path. @param {string} body Contents. @returns {void} */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

/**
 * A fixture tree whose COMMITTED half is complete on its own — the state a fresh clone is in.
 * @param {{scopes:Object<string,string>, tasks?:Object<string,string>}} parts - Contract bodies by
 *   scope id, and optional board task bodies by file name.
 * @returns {string} The fixture root.
 */
function tree({ scopes, tasks = {} }) {
  const cwd = mkdtempSync(join(tmpdir(), "struct-scope-anchor-"));
  w(cwd, `shapeup/${SLUG}/spec/domain-model.md`, "# Domain model\n\n## Entities\n- Todo\n");
  w(cwd, `shapeup/${SLUG}/spec/usecases/UC-AddTodo.md`, "---\nid: UC-AddTodo\n---\n\n# UC-AddTodo\n\n## Steps\n1. [INV-01] text is non-empty\n");
  w(cwd, `shapeup/${SLUG}/spec/usecases/UC-Store.md`, "---\nid: UC-Store\n---\n\n# UC-Store\n\n## Steps\n1. [INV-02] the store round-trips\n");
  for (const [id, body] of Object.entries(scopes)) w(cwd, `shapeup/${SLUG}/scopes/${id}.md`, body);
  for (const [name, body] of Object.entries(tasks)) w(cwd, `.shapeup/${SLUG}/tasks/${name}`, body);
  return cwd;
}

/** A contract body. @param {string} id Scope id. @param {string} fm Extra frontmatter lines. @returns {string} Markdown. */
const contract = (id, fm) => [
  "---", `scope_id: ${id}`, "topology_type: LAYER_CAKE", fm,
  // Two layers, so the slice passes PA1 — this module is about the anchor, not the substrate.
  `allowed_file_substrate: [src/commands/${id}.js, test/commands/${id}.test.js]`,
  'e2e_verification_fixtures: ["node --test test/x.test.js"]',
  "hill_phase: UPHILL_UNKNOWN", "---", "", `# Scope: ${id}`, "", "## Why this slice", "", "One flow.", "",
].join("\n");

/** A board task body. @param {string} id Task id. @param {string} uc UC it anchors to. @param {string} status Status. @returns {string} Markdown. */
const task = (id, uc, status) => [
  "---", `id: ${id}`, "title: t", `status: ${status}`, "priority: 1", "estimated_hours: 1",
  `use_case_refs: [${uc}]`, "depends_on: []", "unlocks: []", "---", "", "- [ ] does the thing", "",
].join("\n");

/**
 * Run the scope-anchor checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("34. The scope contract anchors into the committed spec, not into the local board");
  // =============================================================================

  const { lint } = await import(join(ROOT, "kernel/verify/spec.mjs"));
  const { tasksForScope, ucId } = await import(join(ROOT, "kernel/lib/contract.mjs"));

  /** Rules fired by lint() for a fixture. @param {string} cwd Fixture root. @returns {Array<object>} Findings. */
  const findings = (cwd) => lint({ cwd, slug: SLUG }).findings;
  /** Did a rule fire at red? @param {Array<object>} f Findings. @param {string} rule Rule name. @returns {boolean} */
  const red = (f, rule) => f.some((x) => x.rule === rule && x.level === "red");

  // --- (a) the legacy shape: a committed contract naming a machine-local task id ----------------
  {
    const cwd = tree({ scopes: { "add-todo": contract("add-todo", "tasks: [TASK-004]") } });
    try {
      const f = findings(cwd);
      if (red(f, "TIER-DIRECTION")) ok("a committed contract naming a LOCAL task id is red under TIER-DIRECTION — the shape that linted clean while pointing at a gitignored tier");
      else fail(`a contract carrying "tasks: [TASK-004]" produced no TIER-DIRECTION red: ${JSON.stringify(f.map((x) => x.rule))}. ` +
        "That is the pre-fix state exactly — the id resolves on the machine that wrote it and nowhere else, with every check green.");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (b) no anchor at all ---------------------------------------------------------------------
  {
    const cwd = tree({ scopes: { "add-todo": contract("add-todo", "business_goal: add a todo") } });
    try {
      if (red(findings(cwd), "SCOPE-ANCHOR")) ok("a contract with no use_cases is red under SCOPE-ANCHOR — the anchor is required, the same way UC-ANCHOR requires one of every task");
      else fail("a contract declaring no use_cases produced no SCOPE-ANCHOR red — nothing can then say which tasks, requirements or affordances the scope is answerable for");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (c) an anchor that does not resolve ------------------------------------------------------
  {
    const cwd = tree({ scopes: { "add-todo": contract("add-todo", "use_cases: [UC-Nope]") } });
    try {
      if (red(findings(cwd), "SCOPE-ANCHOR")) ok("a use_cases entry with no usecases/UC-*.md on disk is red — an anchor that does not resolve is not an anchor");
      else fail("a contract anchored to a non-existent UC linted clean — a dangling committed link is the defect this rule exists for");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (d) the anchored contract, and the ONE join both readers use -----------------------------
  {
    const cwd = tree({
      scopes: {
        "add-todo": contract("add-todo", "use_cases: [UC-AddTodo]\ndepends_on: [foundation]\ncovers: [REQ-1]"),
        foundation: contract("foundation", "use_cases: [UC-Store]"),
      },
      tasks: {
        "TASK-004-add.md": task("TASK-004", "UC-AddTodo", "ready"),
        "TASK-001-store.md": task("TASK-001", "UC-Store", "done"),
      },
    });
    try {
      const f = findings(cwd);
      if (!f.some((x) => x.level === "red")) ok("an anchored, order-declaring contract set lints clean");
      else fail(`the corrected shape still reds: ${JSON.stringify(f.filter((x) => x.level === "red").map((x) => `${x.rule}:${x.detail.slice(0, 60)}`))}`);

      const board = [
        { id: "TASK-004", status: "ready", use_case_refs: ["UC-AddTodo"] },
        { id: "TASK-001", status: "done", use_case_refs: ["[[usecases/UC-Store]]"] },
      ];
      const mine = tasksForScope(board, { use_cases: ["UC-AddTodo"] }).map((t) => t.id);
      if (JSON.stringify(mine) === '["TASK-004"]') ok("tasksForScope joins a scope to its board tasks through the committed UC — the relation is re-derived, never stored");
      else fail(`the UC join selected ${JSON.stringify(mine)}, expected ["TASK-004"]`);

      // The wikilink form must normalise identically on both sides, or a join silently drops a task
      // both artifacts agree on.
      const wiki = tasksForScope(board, { use_cases: ["UC-Store"] }).map((t) => t.id);
      if (JSON.stringify(wiki) === '["TASK-001"]' && ucId("[[usecases/UC-Store]]") === "UC-Store") {
        ok("`UC-x`, `[[UC-x]]` and `[[usecases/UC-x]]` all normalise to one id — the two sides of the join cannot disagree about a UC they both hold");
      } else fail(`the wikilink form did not normalise: join=${JSON.stringify(wiki)} ucId=${JSON.stringify(ucId("[[usecases/UC-Store]]"))}`);

      // A scope with no anchor contributes NOTHING to the join, rather than silently matching all.
      if (tasksForScope(board, {}).length === 0) ok("an unanchored scope joins to no tasks — 'no anchor' and 'no tasks' stay different answers");
      else fail("an unanchored scope matched board tasks — an empty anchor must never read as a wildcard");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (e) compile selects through the anchor, end to end ---------------------------------------
  {
    const cwd = tree({
      scopes: { "add-todo": contract("add-todo", "use_cases: [UC-AddTodo]") },
      tasks: {
        "TASK-004-add.md": task("TASK-004", "UC-AddTodo", "ready"),
        "TASK-001-store.md": task("TASK-001", "UC-Store", "ready"),
      },
    });
    try {
      // Driven through the CLI, because that is the surface the orchestrator invokes.
      const { execFileSync } = await import("node:child_process");
      execFileSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "compile",
        "--scope", `shapeup/${SLUG}/scopes/add-todo.md`, "--cwd", cwd, "--round", "1", "--attempt", "1",
      ], { stdio: "pipe" });
      const order = JSON.parse(readFileSync(join(cwd, `.shapeup/${SLUG}/orders/add-todo-r1-a1.json`), "utf8"));
      const ids = (order.payload.tasks || []).map((t) => t.id);
      const carriesTaskIds = Array.isArray(order.payload.scope_contract?.tasks);
      if (JSON.stringify(ids) === '["TASK-004"]' && !carriesTaskIds) {
        ok("compile selects the scope's tasks through its committed UC anchor, and the embedded contract carries no task-id list at all");
      } else {
        fail(`compile produced payload.tasks=${JSON.stringify(ids)} (expected ["TASK-004"]) with contract.tasks ` +
          `${carriesTaskIds ? "still present" : "absent"} — before the anchor existed this same call wrote an order with NO tasks and exited 0`);
      }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }

  // --- (f) a build-order edge that names a scope which is not here ------------------------------
  {
    const cwd = tree({ scopes: { "add-todo": contract("add-todo", "use_cases: [UC-AddTodo]\ndepends_on: [ghost]") } });
    try {
      if (red(findings(cwd), "SCOPE-DEPS")) ok("depends_on naming a scope that is not in the run is red — the scheduler fails open and drops the edge, so the report has to come from here");
      else fail("a dangling depends_on id linted clean — the scope would build before a dependency nothing scheduled");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
}
