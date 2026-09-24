// The single writer is asked, not assumed. A run dispatched five legs, five results landed, three
// leg rows were written — and nothing noticed, because the leg ledger was read in one place, behind
// the checks that decide a scope is green, and appeared in neither the run graph nor the export.
// This module pins the three answers: `probe leg` can be asked about any order by name and about
// the whole run; the graph carries a Leg node with an INGESTED edge so a result nobody applied is a
// one-hop query; the export carries the leg table; and the run loop asks before any early return.
import { mkdtempSync, existsSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const WORKFLOW = join(ROOT, "skills/tech-lead/workflows/shapeup-run.js");

  section("136. The single writer is asked — by order, across the run, in the graph, in the export, and before any early return");

  const ws = mkdtempSync(join(tmpdir(), "single-writer-"));
  try {
    const git = (args) => spawnSync("git", args, { cwd: ws, encoding: "utf8" });
    git(["init", "-q", "-b", "main"]); git(["config", "user.email", "p@example.invalid"]); git(["config", "user.name", "p"]);
    git(["commit", "-q", "--allow-empty", "-m", "base"]);
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    const compiled = kernel("compile", "--slug", "f", "--operation", "analyze");
    if (opened.status !== 0 || compiled.status !== 0) {
      fail(`could not open a run and compile a planning order (init=${opened.status} compile=${compiled.status}): ${(opened.stderr || compiled.stderr || "").slice(0, 300)}`);
      return;
    }
    const orderPath = join(ws, ".shapeup/f/orders/analyze.json");
    const orderId = JSON.parse(readFileSync(orderPath, "utf8")).order_id;
    mkdirSync(join(ws, ".shapeup/f/results"), { recursive: true });
    writeFileSync(join(ws, ".shapeup/f/results/analyze.json"), JSON.stringify({ schema_version: 1, order_id: orderId, worker: "ba-pitch-analyzer", status: "done", discoveries: [] }));

    // --- probe leg, by order and across the run -------------------------------------------------
    const byOrder = kernel("probe", "leg", "--slug", "f", "--order", "analyze");
    const j1 = (() => { try { return JSON.parse(byOrder.stdout); } catch { return null; } })();
    if (byOrder.status === 1 && j1?.found && j1.has_result && !j1.applied) ok("`probe leg --order analyze` reports a planning result on disk that nothing applied (exit 1)");
    else fail(`probe leg --order did not report the unapplied planning result: exit ${byOrder.status} ${byOrder.stdout.slice(0, 200)}`);

    const open1 = kernel("probe", "leg", "--slug", "f", "--open");
    const j2 = (() => { try { return JSON.parse(open1.stdout); } catch { return null; } })();
    if (open1.status === 1 && j2?.open_total === 1 && j2.open_ids?.[0] === orderId) ok("`probe leg --open` lists that result as the run's one open leg");
    else fail(`probe leg --open did not list the open leg: exit ${open1.status} ${open1.stdout.slice(0, 200)}`);

    // Now let the single writer run — the real ingest — and ask again.
    const ingested = kernel("reduce", "ingest", "--order", orderPath, "--no-receipt-check");
    if (ingested.status !== 0) { fail(`reduce ingest refused the fixture result (exit ${ingested.status}): ${(ingested.stderr || ingested.stdout).slice(0, 300)}`); return; }
    const byOrder2 = kernel("probe", "leg", "--slug", "f", "--order", "analyze");
    const open2 = kernel("probe", "leg", "--slug", "f", "--open");
    if (byOrder2.status === 0 && open2.status === 0) ok("after `reduce ingest`, the same order reads applied and the run has no open leg (both exit 0)");
    else fail(`after ingest the probes still report an open leg: order=${byOrder2.status} open=${open2.status} ${open2.stdout.slice(0, 200)}`);

    // --- the graph: a Leg node, an INGESTED edge, and the one-hop question ------------------------
    // A second order whose result lands and is never applied — the shape the live run had.
    const compiled2 = kernel("compile", "--slug", "f", "--operation", "wire");
    if (compiled2.status !== 0) { fail(`could not compile a second order: ${compiled2.stderr.slice(0, 200)}`); return; }
    const wireId = JSON.parse(readFileSync(join(ws, ".shapeup/f/orders/wire.json"), "utf8")).order_id;
    writeFileSync(join(ws, ".shapeup/f/results/wire.json"), JSON.stringify({ schema_version: 1, order_id: wireId, worker: "solution-architect", status: "done" }));

    const { project, appendGraph, runSubgraph, WORK_NODES, EDGES } = await import(join(ROOT, "kernel/reduce/graph.mjs"));
    if (WORK_NODES.includes("Leg") && EDGES.includes("INGESTED")) ok("the graph vocabulary declares the Leg node and the INGESTED edge");
    else fail(`the graph vocabulary lacks Leg/INGESTED: ${WORK_NODES.join(",")} / ${EDGES.join(",")}`);
    const { nodes, edges } = project(ws, "f");
    const legNode = nodes.find((n) => n.t === "Leg" && n.order_id === orderId);
    const ingestedEdge = edges.find((e) => e.t === "INGESTED" && e.from === `result:${orderId}` && e.to === `leg:${orderId}`);
    if (legNode && ingestedEdge) ok("the projection emits a Leg node for the applied order and an INGESTED edge from its Result");
    else fail(`no Leg node / INGESTED edge for ${orderId}: nodes=${nodes.filter((n) => n.t === "Leg").length} edges=${edges.filter((e) => e.t === "INGESTED").length}`);
    const wireEdge = edges.find((e) => e.t === "INGESTED" && e.from === `result:${wireId}`);
    if (!wireEdge) ok("the projection emits NO INGESTED edge for the result nothing applied — the absence is the fact");
    else fail("an INGESTED edge was emitted for a result with no leg row");

    appendGraph(ws, "f");
    const sub = runSubgraph(ws, "f");
    if (Array.isArray(sub.unapplied_results) && sub.unapplied_results.length === 1 && sub.unapplied_results[0] === wireId) {
      ok("`--subgraph run` names the one result the single writer never applied (unapplied_results)");
    } else fail(`unapplied_results is wrong: ${JSON.stringify(sub.unapplied_results)} (expected [${wireId}])`);

    // --- the export: a leg table ---------------------------------------------------------------
    const { TABLES } = await import(join(ROOT, "kernel/report/facts.mjs"));
    if (TABLES.includes("leg")) ok("TABLES declares the leg table");
    else fail("TABLES does not declare a leg table — the export cannot say whether a result was ever read");
    const { collectRun } = await import(join(ROOT, "kernel/report/export.mjs"));
    const collected = collectRun(ws, "f");
    const legRows = collected?.tables?.leg || [];
    if (legRows.length === 1 && legRows[0].order_id === orderId && legRows[0].run_id === collected.run_id) {
      ok("collectRun projects the leg ledger as one keyed row per applied order");
    } else fail(`the export's leg table is wrong: ${JSON.stringify(legRows).slice(0, 300)}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // --- the run loop: asked before any early return, in planning and build, and honest at the close
  const src = readFileSync(WORKFLOW, "utf8");
  if (/async function requireLeg\(/.test(src) && /if \(r\.exit_code === 0\) return await requireLeg\(gate, phaseKey, phaseName\);/.test(src)) {
    ok("requirePhase asks the single writer (requireLeg) once the artifact check passes — a planning phase cannot complete with its result unread");
  } else fail("requirePhase does not ask the leg ledger — a planning result nothing applied still passes its post-condition");
  if (/probe leg --slug \$\{slug\} --order "\$\{phaseKey\}"/.test(src) && /late-ingest:\$\{phaseKey\}/.test(src)) ok("the planning leg check names the order by phase and repairs it with the same late ingest the build round uses");
  else fail("the planning leg check does not query by order or does not attempt the late ingest");
  if (!/breaker: "inner"/.test(src)) ok('the run loop no longer returns `breaker: "inner"` — a word the protocol defines as the per-scope attempt budget');
  else fail('the run loop still returns `breaker: "inner"` for a round that merely stalled');
  const stalled = src.indexOf('stalled: "no_green"');
  const census = src.indexOf("probe attempts --slug");
  if (census !== -1 && stalled !== -1 && census < stalled && /breaker: tripped\.length \? "attempt_budget" : "none"/.test(src)) {
    ok("a stalled round consults `probe attempts` for every queued scope and names `attempt_budget` only when the census says a scope tripped");
  } else fail("the stalled-round return does not consult the attested census before naming a breaker");
  if (/unapplied_results=\$\{ret\.unapplied_results\.length\}/.test(src) && /stalled=\$\{ret\.stalled\}/.test(src)) ok("the close cause names unapplied results and the stall, instead of folding them into a breaker");
  else fail("the close cause does not carry unapplied_results / stalled");
}
