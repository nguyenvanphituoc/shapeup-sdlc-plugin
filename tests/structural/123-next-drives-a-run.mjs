// Structural test module: `probe next` driven end to end, with every command a step carries run for real.
// Section: 176.
//
// WHY THIS MODULE EXISTS.
//
// Section 122 plants a tree per branch and asks what comes next. It cannot say whether the commands
// a step hands out are ones the kernel will accept: a `compile` line with a payload key the order
// schema refuses, a `gate --answer` the resolver does not know, a close cause the ledger will not
// take. Those are the seams between this verb and the rest of the kernel, and a state machine that
// names a command nothing accepts is a run that stops at its first dispatch.
//
// So this module plays the loop. It takes a run that planning already finished (the archived one
// under `traces/`, copied into a scratch project), asks `probe next`, and does exactly what the step
// says — running its `compile`, `ingest`, `gate` and `close` commands through the real kernel — with
// one substitution: where the loop would spawn a sub-agent, a few lines here write the artifacts and
// the WorkResult that worker would have written. That is the only fiction. It is NOT a real run: no
// model ran, no code was built, and a green here proves the seams hold, not that a run ships.

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, mkdtempSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const SLUG = "envlint";

/**
 * Run the end-to-end driver checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("176. `probe next` driven end to end — every command a step hands out is one the kernel accepts");

  const ARCHIVE = join(ROOT, "traces/phase3/fanout-arm-shipped");
  if (!existsSync(join(ARCHIVE, "shapeup-committed", SLUG))) { ok("the archived planned run is absent — nothing to replay (skipped, not failed)"); return; }

  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const ws = mkdtempSync(join(tmpdir(), "struct-drive-"));
  try {
    // ---- a project whose planning is already done --------------------------------------------------
    const open = spawnSync("node", [KERNEL, "init", "run", "--slug", SLUG, "--intake-text", "Lint .env files against a schema", "--auto-level", "interactive", "--cwd", ws], { encoding: "utf8" });
    const args = spawnSync("node", [KERNEL, "init", "run-args", "--slug", SLUG, "--auto-level", "interactive", "--exec-model", "sonnet", "--eval-model", "sonnet",
      "--max-rounds", "2", "--attempts", "3", "--plugin-root", ROOT, "--cwd", ws], { encoding: "utf8" });
    if (open.status !== 0 || args.status !== 0) { fail(`could not open the driver run: ${open.stderr}${args.stderr}`); return; }
    cpSync(join(ARCHIVE, "shapeup-committed", SLUG), join(ws, "shapeup", SLUG), { recursive: true });
    for (const d of ["tasks"]) cpSync(join(ARCHIVE, "shapeup-local", SLUG, d), join(ws, ".shapeup", SLUG, d), { recursive: true });
    rmSync(join(ws, "shapeup", SLUG, "REPORT.md"), { force: true });
    // The archived contracts predate two lint rules: a committed file may not name a board task id, and a
    // scope anchors into the spec by use case. Re-anchor them the way those rules ask, so what is left red
    // is red for a reason that belongs to this run and not to the age of the archive.
    const reanchor = (dir) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) { reanchor(p); continue; }
        if (!/\.md$/.test(f.name)) continue;
        writeFileSync(p, readFileSync(p, "utf8").replace(/^tasks: \[[^\]]*\]$/m, "use_cases: [UC-01]").replace(/\bTASK-\d+/g, "the task").replace(/\.shapeup\//g, "the local run trace/"));
      }
    };
    reanchor(join(ws, "shapeup", SLUG));
    const OWNER = { "TASK-001": "parsing-engine", "TASK-002": "rules-engine", "TASK-003": "cli-composition-root", "TASK-004": "test-surface-suite" };
    for (const f of readdirSync(join(ws, ".shapeup", SLUG, "tasks")).filter((x) => /^TASK-\d+/.test(x))) {
      const p = join(ws, ".shapeup", SLUG, "tasks", f);
      const id = f.match(/^TASK-\d+/)[0];
      const text = readFileSync(p, "utf8");
      if (OWNER[id] && !/^scope_id:/m.test(text)) writeFileSync(p, text.replace(/^(id:.*)$/m, `$1\nscope_id: ${OWNER[id]}`));
    }
    const runId = JSON.parse(readFileSync(join(ws, ".shapeup", SLUG, "receipt.json"), "utf8")).run_id;
    const local = (...p) => join(ws, ".shapeup", SLUG, ...p);
    const write = (p, t) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, typeof t === "string" ? t : JSON.stringify(t)); };

    const sh = (command) => spawnSync("sh", ["-c", command], { encoding: "utf8", cwd: ws });
    const nextStep = (extra = "") => {
      const r = spawnSync("node", [KERNEL, "probe", "next", "--slug", SLUG, "--cwd", ws, ...extra.split(" ").filter(Boolean)], { encoding: "utf8" });
      try { return JSON.parse(r.stdout); } catch { return { kind: "unparseable", raw: `${r.stdout}${r.stderr}` }; }
    };

    // ---- what the sub-agent would have written ----------------------------------------------------------
    const receipt = (order) => { mkdirSync(local("receipts"), { recursive: true }); appendFileSync(local("receipts", "dispatch.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), run_id: runId, order_id: order.order_id, skill_invoked: order.worker }) + "\n"); };
    const respond = (orderPath, body) => {
      const order = JSON.parse(readFileSync(orderPath, "utf8"));
      receipt(order);
      write(join(local("results"), `${orderPath.split("/").pop()}`), { schema_version: 1, order_id: order.order_id, worker: order.worker, status: "done", ...body });
      return order;
    };
    const { surfaceRows } = await import(join(ROOT, "kernel/probe/eval.mjs"));
    const { coveringAcs } = await import(join(ROOT, "kernel/probe/requirements.mjs"));
    const { readBoard } = await import(join(ROOT, "kernel/compile.mjs"));
    const fakeWorker = (step) => {
      const order = JSON.parse(readFileSync(step.order_path, "utf8"));
      switch (step.operation) {
        case "orient":
          for (const f of ["code-surface.md", "discovered-seed.md", "hill-signal.md", "spike-not-needed.md"]) write(local("orient", f), "x\n");
          return respond(step.order_path, { artifacts: [] });
        case "coverage":
          write(join(ws, "shapeup", SLUG, "requirements.md"), "# requirements\n");
          return respond(step.order_path, {});
        case "evaluate": {
          const dims = order.payload?.dimensions || [];
          const verdicts = join(local("t0", "verdicts"));
          const cites = readdirSync(verdicts).filter((f) => f.endsWith(".json")).map((f) => {
            const p = join(verdicts, f); const b = JSON.parse(readFileSync(p, "utf8"));
            return { scope_id: b.scope_id, path: p.replace(`${ws}/`, ""), sha256: createHash("sha256").update(readFileSync(p, "utf8")).digest("hex") };
          });
          const covers = [...coveringAcs(readBoard(ws, SLUG)).keys()];
          const rows = surfaceRows(ws, SLUG);
          const criteria = [
            ...rows.map((r) => ({ criterion: `${r} holds`, verdict: "PASS", evidence: "ran it, exit 0", traces_to: covers.slice(0, 1), dimension: dims[0] })),
            ...dims.map((d) => ({ criterion: `${d} holds`, verdict: "PASS", evidence: "checked", traces_to: covers.slice(0, 1), dimension: d })),
          ];
          if (!criteria.length) criteria.push({ criterion: "it works", verdict: "PASS", evidence: "ran it", traces_to: covers.slice(0, 1) });
          return respond(step.order_path, { verdict: { overall: "PASS", criteria, t0_citations: cites } });
        }
        case "hunt":
          write(join(local("qa"), "hunt-report.md"), "# hunt\n\ncharters: 1/1\n");
          return respond(step.order_path, { artifacts: [".shapeup/envlint/qa/hunt-report.md"] });
        case "hammer":
          write(local("reports", "hammer-census.json"), { schema_version: 1, order_id: order.order_id, verdict: "ship-now", cut_list: [], ship_blocking: [], breaker: null, baseline: "x" });
          return respond(step.order_path, {});
        default:
          return respond(step.order_path, {});
      }
    };
    let trial = 0;
    const fakeBuild = (item, round) => {
      const compiled = sh(item.compile);
      if (compiled.status !== 0) return { error: `compile exited ${compiled.status}: ${compiled.stderr || compiled.stdout}` };
      write(local("t0", "verdicts", `r${round}-a1-t${++trial}.json`), { scope_id: item.scope_id, round, attempt: 1, overall: "green", run_id: runId });
      respond(item.order_path, { task_results: [] });
      return {};
    };

    // ---- the loop ------------------------------------------------------------------------------------------
    const DECISION = { L1a: "proceed", "L1a.5": "proceed", L1b: "proceed", L2: "proceed", L3: "loop", QA: "run", H: "accept-cut-list", L4: "ship" };
    const seen = [];
    let terminal = null, problem = null;
    for (let i = 0; i < 60 && !terminal && !problem; i++) {
      const s = nextStep(i === 0 ? "--restart" : "");
      seen.push(s.step);
      for (const p of s.pre || []) { const r = sh(p.command); if (r.status !== 0 && !p.advisory) { problem = `pre failed in ${s.step}: ${r.stderr || r.stdout}`; } }
      switch (s.kind) {
        case "dispatch": {
          const c = sh(s.compile);
          if (c.status !== 0) { problem = `compile refused at ${s.step}: ${c.stderr || c.stdout}`; break; }
          fakeWorker(s);
          const g = sh(s.ingest);
          if (g.status !== 0) { problem = `ingest refused at ${s.step}: ${g.stderr || g.stdout}`; break; }
          for (const t of s.then || []) sh(t.command);
          break;
        }
        case "build":
          for (const item of s.release) {
            const r = fakeBuild(item, s.round);
            if (r.error) { problem = `${s.step}: ${r.error}`; break; }
            if (!item.ingest) { problem = `${s.step}: the release item for ${item.scope_id} carries no ingest command`; break; }
            const ing = sh(item.ingest);
            if (ing.status !== 0) { problem = `ingest refused at ${s.step}: ${ing.stderr || ing.stdout}`; break; }
          }
          break;
        case "command": {
          const r = sh(s.command);
          if (!(s.ok_exits || [0]).includes(r.status)) problem = `command failed at ${s.step} (exit ${r.status}): ${r.stderr || r.stdout}`;
          for (const t of s.then || []) sh(t.command);
          break;
        }
        case "gate": {
          const r = sh(s.command);
          if (r.status === 4) {
            const a = sh(s.answer_command.replace("<decision>", DECISION[s.gate]));
            if (a.status !== 0) problem = `the live answer was refused at ${s.step} (exit ${a.status}): ${a.stderr || a.stdout}`;
          } else if (r.status !== 0) problem = `gate ${s.gate} resolved with exit ${r.status}: ${r.stdout}${r.stderr}`;
          break;
        }
        case "terminal": {
          const c = sh(s.close_command);
          if (c.status !== 0) problem = `close refused: ${c.stderr || c.stdout}`;
          terminal = s;
          break;
        }
        default:
          problem = `unexpected step ${JSON.stringify(s).slice(0, 200)}`;
      }
    }

    if (problem) { fail(`drive: ${problem} (steps so far: ${seen.join(" → ")})`); return; }
    if (!terminal) { fail(`drive: the run did not end in 60 steps: ${seen.join(" → ")}`); return; }
    ok(`drive: the run ended after ${seen.length} steps: ${seen.join(" → ")}`);

    if (terminal.status === "shipped") ok("drive: the run ended shipped");
    else fail(`drive: the run ended ${terminal.status}: ${terminal.reason}`);
    const gates = readFileSync(local("gates.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const crossed = gates.filter((g) => g.status === "ok").map((g) => g.gate);
    const live = gates.filter((g) => g.status === "ok" && g.gate !== "L0");
    const want = ["L1a", "L1a.5", "L1b", "L2", "L3", "QA", "H", "L4"];
    if (want.every((g) => crossed.includes(g))) ok("drive: every gate was crossed and ledgered, each with a source");
    else fail(`drive: gates crossed ${crossed.join(",")} — missing ${want.filter((g) => !crossed.includes(g)).join(",")}`);
    if (live.length && live.every((g) => g.source === "PO (live)")) ok("drive: every live answer carries the source `PO (live)`");
    else fail("drive: a live answer was ledgered with another source");
    const closed = readFileSync(local("harness-run.md"), "utf8");
    if (/^closed_status:\s*shipped/m.test(closed)) ok("drive: the ledger records the close as shipped");
    else fail("drive: the ledger carries no shipped close");
    const again = nextStep();
    if (again.kind === "done") ok("drive: asked again after the close, the verb says there is nothing to resume");
    else fail(`drive: after the close the verb said ${again.step}, not done`);
  } finally {
    try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
