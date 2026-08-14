// Structural test module: the run graph — the read model, and the properties that make it safe.
//
// A graph is only trustworthy as a read model if it cannot disagree with the artifacts it claims to
// describe. Three properties give that, and each has an obvious way to lose it:
//
//   DERIVED     — delete the graph, rebuild it, get the same fold. Lose this the moment anything
//                 writes a node the artifacts do not imply, and the graph becomes a second source
//                 of truth that drifts silently.
//   IDEMPOTENT  — appending over an unchanged tree appends nothing. Lose this and the log grows
//                 without bound and every read gets slower and less legible.
//   BACKFILLED  — a tree recorded before the graph existed produces a complete graph on first
//                 touch, through the SAME code path. A separate migration path is a second
//                 implementation of the projection, and the two will diverge.
//
// The last section is the one-line test from the architecture review made executable: pick a
// verdict and reach the objective, the plan, the artifact, the source and the execution record in
// ONE query. Before the graph that sentence was true in spirit and false in practice — "trace"
// meant grepping four files.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SLUG = "graphdemo";

/**
 * Plant a complete run trace: a receipt, one non-build order with its result, a scope contract with
 * `covers:`, a requirements file, a green T0 verdict, and two trials with a real parent link.
 * @param {string} root - The workspace to plant into.
 * @returns {string} The same root, for chaining.
 */
function plant(root) {
  const local = join(root, ".shapeup", SLUG);
  const shared = join(root, "shapeup", SLUG);
  mkdirSync(join(local, "orders"), { recursive: true });
  mkdirSync(join(local, "results"), { recursive: true });
  mkdirSync(join(local, "t0", "verdicts"), { recursive: true });
  mkdirSync(join(shared, "scopes"), { recursive: true });
  mkdirSync(join(shared, "spec", "usecases"), { recursive: true });

  writeFileSync(join(local, "receipt.json"), JSON.stringify({
    schema_version: 1, slug: SLUG, started_at: "2026-08-14T10:00:00.000Z",
    intake_sha256: "deadbeef", config: { auto_level: "unattended" },
  }));
  writeFileSync(join(local, "orders", "sc-01-r1-a1.json"), JSON.stringify({
    schema_version: 1, order_id: `${SLUG}/sc-01-r1-a1`, worker: "task-executor",
    operation: "execute", round: 1, attempt: 1,
    payload: { feature: SLUG, scope_contract: { scope_id: "sc-01" } },
  }));
  writeFileSync(join(local, "results", "sc-01-r1-a1.json"), JSON.stringify({
    schema_version: 1, order_id: `${SLUG}/sc-01-r1-a1`, status: "complete", artifacts: ["a.ts"], discoveries: [],
  }));
  writeFileSync(join(local, "t0", "verdicts", "r1-a1-t1.json"), JSON.stringify({
    scope_id: "sc-01", round: 1, attempt: 1, overall: "green", regression: false,
  }));
  writeFileSync(join(local, "t0", "trials.jsonl"),
    JSON.stringify({ schema_version: 1, trial: 1, round: 1, attempt: 1, scope_id: "sc-01", status: "kept", artifact: "verdicts/r1-a1-t1.json", baseline_trial: null }) + "\n" +
    JSON.stringify({ schema_version: 1, trial: 2, round: 1, attempt: 2, scope_id: "sc-01", status: "kept", artifact: "verdicts/r1-a2-t1.json", baseline_trial: 1 }) + "\n");
  writeFileSync(join(shared, "scopes", "sc-01.md"),
    "---\nschema_version: 1\nscope_id: sc-01\ntitle: Health endpoint\ncovers: [REQ-1, REQ-2]\n---\n\n# sc-01\n");
  writeFileSync(join(shared, "requirements.md"),
    "# Requirements\n\n- **REQ-1** the endpoint answers 200\n- **REQ-2** it reports the build sha\n");
  writeFileSync(join(shared, "spec", "usecases", "UC-01.md"), "# UC-01\n");
  return root;
}

/**
 * Run the run-graph checks.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section bodies finish.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("20. The run graph is derived, idempotent, and backfills a tree that predates it");
  // =============================================================================
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GRAPH = join(ROOT, "kernel/reduce/graph.mjs");
  if (!existsSync(GRAPH)) { fail("kernel/reduce/graph.mjs is missing — there is no read model"); return; }

  const { readGraph, project, appendGraph, runSubgraph, trace, WORK_NODES, DOMAIN_NODES, graphPath } =
    await import(`file://${GRAPH}`);

  const ws = mkdtempSync(join(tmpdir(), "struct-graph-"));
  try {
    plant(ws);

    // --- (a) BACKFILL: no graph on disk, and the first touch produces a complete one -----------
    const first = appendGraph(ws, SLUG);
    if (first.backfilled) ok("the first append reports `backfilled` — a v1 tree is migrated by the same code path that maintains a v2 one");
    else fail("appendGraph did not report a backfill over a tree with no graph — the migration is a separate path that can drift");
    if (first.nodes_added > 0 && first.edges_added > 0) ok(`backfill projected ${first.nodes_added} node(s) and ${first.edges_added} edge(s) from artifacts alone`);
    else fail(`backfill produced ${first.nodes_added} nodes / ${first.edges_added} edges over a complete run trace — the projection is not reading the artifacts`);

    // --- (b) IDEMPOTENT: nothing new on disk, nothing new in the log ---------------------------
    const second = appendGraph(ws, SLUG);
    if (second.nodes_added === 0 && second.edges_added === 0) ok("a second append over an unchanged tree adds nothing — the log does not grow on every run");
    else fail(`a second append added ${second.nodes_added} node(s) and ${second.edges_added} edge(s) over an unchanged tree — the graph repeats itself`);

    // --- (c) DERIVED: delete it, rebuild it, get the same graph --------------------------------
    const before = readGraph(ws, SLUG);
    rmSync(graphPath(ws, SLUG));
    appendGraph(ws, SLUG);
    const after = readGraph(ws, SLUG);
    const sameNodes = JSON.stringify([...before.nodes.keys()].sort()) === JSON.stringify([...after.nodes.keys()].sort());
    const sameEdges = JSON.stringify([...before.edges.keys()].sort()) === JSON.stringify([...after.edges.keys()].sort());
    if (sameNodes && sameEdges) ok("deleting the graph and rebuilding it yields the identical fold — it has no independent existence to drift with");
    else fail("a rebuilt graph differs from the original — something is authoring nodes the artifacts do not imply");

    // --- (d) the two families stay un-collapsed ------------------------------------------------
    const types = new Set([...after.nodes.values()].map((n) => n.t));
    const work = WORK_NODES.filter((t) => types.has(t));
    const domain = DOMAIN_NODES.filter((t) => types.has(t));
    if (work.length >= 3 && domain.length >= 2) ok(`both families are populated and separate (work: ${work.join(", ")} · domain: ${domain.join(", ")})`);
    else fail(`the graph carries work=[${work}] domain=[${domain}] — one family is missing, so the "commit DAG ≠ knowledge graph" split is nominal`);
    const strays = [...types].filter((t) => !WORK_NODES.includes(t) && !DOMAIN_NODES.includes(t));
    if (strays.length === 0) ok("every node carries a declared type — no untyped nodes leaked in");
    else fail(`undeclared node type(s) in the graph: ${strays.join(", ")}`);

    // --- (e) a torn line proves nothing and must not take the graph down -----------------------
    appendFileSync(graphPath(ws, SLUG), '{"k":"node","id":"torn"\n');
    const torn = readGraph(ws, SLUG);
    if (torn.nodes.size === after.nodes.size) ok("a torn line is skipped, not fatal, and adds no node — a half-written append cannot corrupt the read model");
    else fail("a torn line changed the fold — an interrupted append would corrupt the graph");

    // --- (f) the bounded query, which is what replaces the directory walk ----------------------
    const sub = runSubgraph(ws, SLUG);
    if (sub.green_scopes_by_round?.["1"]?.includes("sc-01")) ok("the run subgraph answers which scopes are green in which round — the fast-forward as a query");
    else fail(`the run subgraph did not report sc-01 green in round 1: ${JSON.stringify(sub.green_scopes_by_round)}`);
    if (sub.pending_orders.length === 0) ok("an order with its result on disk is not reported pending (the query folds both sides)");
    else fail(`the subgraph reports ${sub.pending_orders.join(", ")} pending although the result is on disk`);

    // --- (g) THE ONE-LINE TEST, executable ------------------------------------------------------
    // "Every important output can be traced to an objective, a plan, an artifact, a source, an
    // evaluator decision, and a bounded execution record." One query, from one verdict.
    const t = trace(ws, SLUG, `verdict:${SLUG}:r1-a1-t1`, 4);
    if (!t.found) {
      fail("the verdict node is not in the graph — there is nothing to trace from");
    } else {
      const reached = new Set(t.path.map((h) => h.node?.t).filter(Boolean));
      const want = { objective: "Run", plan: "Scope", source: "Requirement", record: "Trial" };
      const missing = Object.entries(want).filter(([, type]) => !reached.has(type));
      if (missing.length === 0) {
        ok(`one query from a verdict reaches ${Object.values(want).join(", ")} — the reliability invariant is an edge walk, not a grep`);
      } else {
        fail(`tracing a verdict reached [${[...reached].join(", ")}] and never reached ${missing.map(([k, v]) => `${k} (${v})`).join(", ")} — the invariant is still prose`);
      }
      if (t.path.some((h) => h.t === "SUPERSEDES")) ok("the trace follows SUPERSEDES — which trial replaced which is in the graph, not only in a row");
      else fail("no SUPERSEDES edge on the trace — the ratchet's lineage did not reach the graph");
    }

    // --- (h) the graph is reachable through the one entry point --------------------------------
    const cli = spawnSync(process.execPath, [KERNEL, "reduce", "graph", "--slug", SLUG, "--cwd", ws, "--subgraph", "run"],
      { encoding: "utf8", timeout: 30_000 });
    let out = null;
    try { out = JSON.parse(cli.stdout); } catch { /* asserted below */ }
    if (cli.status === 0 && out?.scopes?.includes("sc-01")) ok("`harness reduce graph --subgraph run` answers from the kernel's single entry point");
    else fail(`the graph query is not reachable through the kernel: exit ${cli.status}, ${String(cli.stdout).slice(0, 120)}`);

    // --- (i) the projection is pure — asking for it writes nothing -----------------------------
    const sizeBefore = readFileSync(graphPath(ws, SLUG), "utf8").length;
    project(ws, SLUG);
    if (readFileSync(graphPath(ws, SLUG), "utf8").length === sizeBefore) ok("project() writes nothing — only `reduce graph` appends, so the single-writer rule holds for the graph too");
    else fail("project() changed the graph on disk — the read path is writing");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
