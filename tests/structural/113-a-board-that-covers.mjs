// A BOARD WITH NO COVERS CLAUSE CROSSED EVERY GATE.
//
// Two bars answer "is this requirement planned". L1b is satisfied by a scope contract's own covers
// list; the requirements matrix reads only the acceptance criteria's `(covers: REQ-…)` clauses. One
// run's board carried thirty such clauses and the next carried none, from the same instruction, and
// the second run's matrix read "no evidence" under every requirement. A board with none, while a
// registry exists, now sends its writer back once; one that still has none continues with a state
// warning, because the matrix is advisory and never blocks a ship.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the board-covers checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { boardCoversProblem } = await import(join(ROOT, "kernel/probe/requirements.mjs"));

  section("167. A board with no covers clause, beside a registry, sends its writer back once and then warns");

  const d = mkdtempSync(join(tmpdir(), "covers-"));
  const put = (rel, text) => { const p = join(d, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
  const task = (id, ac) => put(`.shapeup/demo/tasks/${id}-x.md`, ["---", `id: ${id}`, "type: task", "feature: demo", `title: "${id}"`,
    "status: todo", "use_case_refs: [UC-01]", "---", "", "## Acceptance Criteria", `- [ ] ${ac}`, ""].join("\n"));
  const check = () => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "probe", "requirements", "--slug", "demo", "--board-check", "--cwd", d], { encoding: "utf8" });
  try {
    task("TASK-001", "the list renders");
    task("TASK-002", "the filter ignores diacritics");
    if (boardCoversProblem(d, "demo") === null) ok("no registry: nothing to cover, nothing refused");
    else fail("a board with no registry beside it was refused");

    put("shapeup/demo/requirements.md", ["---", 'feature: "[[demo]]"', "registry: true", "---", "", "# Requirements Registry", "",
      "| REQ-id | Clause (verbatim) | Source | Status | Note |", "|---|---|---|---|---|",
      '| REQ-1 | "the list renders" | intake.md § Success | covered | |', '| REQ-2 | "the filter ignores diacritics" | intake.md § Success | covered | |', ""].join("\n"));
    const none = boardCoversProblem(d, "demo");
    const c0 = check(); let o0 = {}; try { o0 = JSON.parse(c0.stdout); } catch { /* reported below */ }
    if (/2 tasks carry no/.test(none || "") && /registry holds 2/.test(none) && c0.status === 1 && o0.ok === false) {
      ok("a registry and a board with no covers clause: refused, by the function and by --board-check");
    } else fail(`no-covers board: ${none}; cli exit ${c0.status} ${c0.stdout}`);

    task("TASK-001", "the list renders (covers: REQ-1)");
    const c1 = check();
    if (boardCoversProblem(d, "demo") === null && c1.status === 0) ok("one covers clause anywhere on the board is enough — the gate asks for the join, not full coverage");
    else fail(`board with one clause: exit ${c1.status} ${c1.stdout}`);

    rmSync(join(d, ".shapeup/demo/tasks"), { recursive: true, force: true });
    if (boardCoversProblem(d, "demo") === null) ok("no board yet is not this check's to refuse");
    else fail("an empty board was refused for missing covers");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }

  const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
  const sent = (op) => new RegExp(`boardSentBack\\(\\(note\\) => worker\\(\\{\\s*skill: "ba-pitch-analyzer", operation: "${op}"`).test(wf);
  if (sent("analyze") && sent("board")) ok("both board writers — analyze and the board-only regeneration — go through the send-back");
  else fail(`a board writer bypasses the covers send-back: analyze=${sent("analyze")} board=${sent("board")}`);
  if (/probe requirements --slug \$\{slug\} --board-check/.test(wf) && /stateWarnings\.push\(msg\);\s*\}\s*return out;/.test(wf)) ok("a board still without covers after the send-back continues with a state warning, never an abort");
  else fail("the covers send-back no longer ends in a warning");
}
