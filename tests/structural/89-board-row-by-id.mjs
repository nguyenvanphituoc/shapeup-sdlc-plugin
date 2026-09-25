// ingest matched an index row by the task id appearing anywhere in the line. A finished task's id
// sits in every dependent's `Depends On` column, so ticking the dependency ticked the dependent:
// a task the executor reported `skipped` showed ✅ done, its file still said `ready`, and the census
// read the index. Measured on a live consumer run.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  section("141. A board row is matched by its id cell, and a skipped task reads skipped");

  const { updateBoardRow, rowIs } = await import(join(ROOT, "kernel/reduce/ingest.mjs"));
  const index = [
    "| ID | Title | Package | Status | Priority | Depends On | Est. |",
    "|----|-------|---------|--------|----------|------------|------|",
    "| [[TASK-002\\|TASK-002]] | Port + adapter | app | ⬜ ready | 1 | — | 1h |",
    "| [[TASK-005\\|TASK-005]] | Local unit tests | app | ⬜ ready | 3 | TASK-002 | 0.5h |",
    "| TASK-006 | Integration test | app | 🚫 blocked | 4 | TASK-002, TASK-005 | 1h |",
  ].join("\n");
  if (rowIs(index.split("\n")[2], "TASK-002") && !rowIs(index.split("\n")[3], "TASK-002") && rowIs(index.split("\n")[4], "TASK-006")) ok("rowIs matches the id cell only — a Depends On mention is not the row");
  else fail("rowIs matches a row that merely mentions the id");
  const ticked = updateBoardRow(index, "TASK-002", "done").split("\n");
  if (/✅ done/.test(ticked[2]) && /⬜ ready/.test(ticked[3]) && /🚫 blocked/.test(ticked[4])) ok("ticking TASK-002 done leaves TASK-005 (which depends on it) at ready and TASK-006 blocked");
  else fail(`ticking TASK-002 disturbed its dependents:\n${ticked.slice(2).join("\n")}`);
  const skipped = updateBoardRow(index, "TASK-005", "skipped").split("\n");
  if (/⏭ skipped/.test(skipped[3]) && /⬜ ready/.test(skipped[2])) ok("a skipped task renders ⏭ skipped on its own row only");
  else fail(`skipped did not render:\n${skipped.slice(2).join("\n")}`);

  // Through the real ingest: a result that reports one task done and its dependent skipped.
  const ws = mkdtempSync(join(tmpdir(), "board-row-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    const compiled = kernel("compile", "--operation", "execute", "--worker", "task-executor", "--slug", "f");
    if (opened.status !== 0 || compiled.status !== 0) { fail(`fixture: init=${opened.status} compile=${compiled.status}`); return; }
    const orderId = JSON.parse(readFileSync(join(ws, ".shapeup/f/orders/execute.json"), "utf8")).order_id;
    const tasks = join(ws, ".shapeup/f/tasks");
    mkdirSync(tasks, { recursive: true });
    writeFileSync(join(tasks, "_index.md"), index + "\n");
    for (const [id, deps] of [["TASK-002", "[]"], ["TASK-005", "[TASK-002]"], ["TASK-006", "[TASK-002, TASK-005]"]]) {
      writeFileSync(join(tasks, `${id}.md`), `---\ntype: task\nid: ${id}\nstatus: ${id === "TASK-006" ? "blocked" : "ready"}\ndepends_on: ${deps}\n---\n\n# ${id}\n\n- [ ] AC one\n`);
    }
    mkdirSync(join(ws, ".shapeup/f/results"), { recursive: true });
    writeFileSync(join(ws, ".shapeup/f/results/execute.json"), JSON.stringify({ schema_version: 1, order_id: orderId, worker: "task-executor", status: "escalated",
      task_results: [{ task_id: "TASK-002", status: "done", ac_results: [{ ac: "AC one", result: "pass" }] }, { task_id: "TASK-005", status: "skipped", ac_results: [], notes: "substrate denies the test files" }] }));
    const ing = kernel("reduce", "ingest", "--order", join(ws, ".shapeup/f/orders/execute.json"), "--no-receipt-check");
    if (ing.status !== 0) { fail(`reduce ingest refused the fixture (exit ${ing.status}): ${(ing.stderr || ing.stdout).slice(0, 300)}`); return; }
    const idx = readFileSync(join(tasks, "_index.md"), "utf8").split("\n");
    const t5 = readFileSync(join(tasks, "TASK-005.md"), "utf8");
    if (/TASK-002.*✅ done/.test(idx[2]) && /TASK-005.*⏭ skipped/.test(idx[3]) && /^status: skipped$/m.test(t5)) ok("through the real ingest: TASK-002 done, TASK-005 skipped on the index AND in its file — not ✅ by contagion");
    else fail(`ingest rendered the board wrong:\n${idx.slice(2).join("\n")}\nTASK-005 status: ${(t5.match(/^status:.*$/m) || ["?"])[0]}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
