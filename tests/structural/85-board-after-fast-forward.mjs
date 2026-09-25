// ANALYZE has two outputs in two tiers: the spec tree (committed) and the board (per-machine,
// gitignored). A fast-forward that asked only about the committed half walked every later run on a
// machine — and every run in a fresh checkout — into a build with a spec and no board: GATE L2
// crossed `proceed` over 0/0 tasks, the evaluator could read no `covers:` clause, and the
// requirements projection printed "no evidence" for a round whose static criteria all passed.
import { mkdtempSync, existsSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const WORKFLOW = join(ROOT, "skills/tech-lead/workflows/shapeup-run.js");

  section("137. A committed spec with no board is not a finished ANALYZE — the board is regenerated, and L2 refuses 0/0");

  const ws = mkdtempSync(join(tmpdir(), "board-ff-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    if (opened.status !== 0) { fail(`could not open a run: ${opened.stderr.slice(0, 200)}`); return; }
    // ORIENT's artifacts (the phase before ANALYZE), then the committed half as a clone would have it.
    const { ORIENT_REQUIRED } = await import(join(ROOT, "kernel/probe/resume.mjs"));
    mkdirSync(join(ws, ".shapeup/f/orient"), { recursive: true });
    for (const f of [...ORIENT_REQUIRED, "spike-cart.md"]) writeFileSync(join(ws, ".shapeup/f/orient", f), "# orient\n");
    const rs0 = JSON.parse(kernel("probe", "resume", "--slug", "f").stdout);
    const ucDir = join(ws, rs0.spec_folder || "shapeup/f/spec", "usecases");
    mkdirSync(ucDir, { recursive: true });
    writeFileSync(join(ucDir, "UC-01-add-badge.md"), "# UC-01\n");

    const rs1 = JSON.parse(kernel("probe", "resume", "--slug", "f").stdout);
    if (rs1.has_spec_tree === true && rs1.has_board === false && rs1.next_phase === "analyze") {
      ok("probe resume reports the tree present, the board absent, and resumes AT analyze — not past it");
    } else fail(`probe resume over a committed tree and no board: ${JSON.stringify({ has_spec_tree: rs1.has_spec_tree, has_board: rs1.has_board, next_phase: rs1.next_phase })}`);
    const req1 = kernel("probe", "resume", "--slug", "f", "--require", "analyze");
    if (req1.status === 6) ok("`--require analyze` exits 6 over a tree with no board — the phase is not attestable on the committed half alone");
    else fail(`--require analyze exited ${req1.status} over a tree with no board — a fast-forward would build over nothing`);

    // --- GATE L2 refuses proceed from a preset over an empty board -----------------------------
    const l2empty = spawnSync("node", [KERNEL, "gate", "--resolve", "L2", "--slug", "f", "--preset", "ci"], { cwd: ws, encoding: "utf8" });
    const j2 = (() => { try { return JSON.parse(l2empty.stdout); } catch { return null; } })();
    if (j2?.decision === "ask" && j2?.refused === "proceed" && j2?.board_tasks === 0) ok("gate --resolve L2 --preset ci over an empty board narrows `proceed` to `ask` (refused: proceed, board_tasks: 0)");
    else fail(`L2 over an empty board resolved ${JSON.stringify(j2)} — a hundred percent of nothing crossed the gate`);

    // --- the board-only operation compiles, addressed to the analyzer, with the spec frozen -------
    const compiled = kernel("compile", "--operation", "board", "--slug", "f");
    const orderPath = join(ws, ".shapeup/f/orders/board.json");
    if (compiled.status === 0 && existsSync(orderPath)) {
      const o = JSON.parse(readFileSync(orderPath, "utf8"));
      const allowed = o.substrate?.allowed || [], frozen = o.substrate?.frozen || [];
      if (o.worker === "ba-pitch-analyzer" && allowed.some((g) => /tasks\/\*\*$/.test(g)) && !allowed.some((g) => /spec/.test(g)) && frozen.some((g) => /usecases/.test(g))) {
        ok("`compile --operation board` addresses ba-pitch-analyzer, allows tasks/** only, and freezes the use cases");
      } else fail(`the board order's contract is wrong: worker=${o.worker} allowed=${JSON.stringify(allowed)} frozen=${JSON.stringify(frozen)}`);
    } else fail(`compile --operation board failed (exit ${compiled.status}): ${(compiled.stderr || compiled.stdout).slice(0, 300)}`);

    // --- with a board, the phase attests and L2 proceeds ----------------------------------------
    mkdirSync(join(ws, ".shapeup/f/tasks"), { recursive: true });
    writeFileSync(join(ws, ".shapeup/f/tasks/TASK-001.md"), "---\nid: TASK-001\nstatus: pending\nscope_id: sc-a\n---\n\n# task\n");
    const rs2 = JSON.parse(kernel("probe", "resume", "--slug", "f").stdout);
    const req2 = kernel("probe", "resume", "--slug", "f", "--require", "analyze");
    if (rs2.has_board === true && req2.status === 0 && rs2.next_phase !== "analyze") ok("with a board on disk the phase attests (exit 0) and the derivation moves past analyze");
    else fail(`with a board: has_board=${rs2.has_board} require=${req2.status} next_phase=${rs2.next_phase}`);
    const l2full = spawnSync("node", [KERNEL, "gate", "--resolve", "L2", "--slug", "f", "--preset", "ci"], { cwd: ws, encoding: "utf8" });
    const j3 = (() => { try { return JSON.parse(l2full.stdout); } catch { return null; } })();
    if (j3?.decision === "proceed") ok("gate --resolve L2 --preset ci over a real board still proceeds — the refusal is about evidence, not about presets");
    else fail(`L2 over a real board resolved ${JSON.stringify(j3)}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // --- the schema, the router, and the workflow agree about the operation ----------------------
  const { OP_OWNER } = await import(join(ROOT, "kernel/compile.mjs"));
  const schema = JSON.parse(readFileSync(join(ROOT, "kernel/schemas/domain.schema.json"), "utf8"));
  if (schema.$defs.Operation.enum.includes("board") && OP_OWNER.board === "ba-pitch-analyzer") ok("the Operation enum carries `board` and OP_OWNER routes it to ba-pitch-analyzer");
  else fail("`board` is missing from the Operation enum or OP_OWNER — the order would fail its own schema or compile nothing");
  const src = readFileSync(WORKFLOW, "utf8");
  if (/else if \(!rs\.has_board\) \{/.test(src) && /operation: "board"/.test(src) && /requirePhase\("ANALYZE", "analyze", "Analyze", "board"\)/.test(src)) {
    ok("the workflow's ANALYZE phase has a board-only branch: tree on disk, no board → dispatch `board`, then attest the phase against the board order");
  } else fail("the workflow still fast-forwards ANALYZE on the spec tree alone");
  if (/spec tree and board already on disk/.test(src)) ok("the ANALYZE fast-forward names both halves");
  else fail("the ANALYZE fast-forward message still names the spec tree alone");
}
