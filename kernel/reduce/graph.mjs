// graph — the run graph: one typed, append-only edge list per feature.
//
// WHAT IT IS FOR. The harness has always been graph-shaped and never a graph: orders produce
// results, results produce verdicts, verdicts cite T0 artifacts, scopes cover requirements, trials
// supersede trials. All of it was real and all of it was scattered across markdown and JSON, so
// "trace this verdict back to the objective" meant grepping four files, and a relaunch re-derived
// the whole run state by walking directories. This file makes the same facts one queryable thing.
//
// TWO FAMILIES, DELIBERATELY NOT COLLAPSED (they answer different questions and change at different
// rates):
//   WORK LINEAGE — Run, Order, Result, Verdict, Trial. "What happened, and what produced it."
//   DOMAIN       — Scope, UseCase, Requirement, Seam. "What exists, and how it relates."
// An edge may cross the families (a Scope COVERS a Requirement; an Order is DERIVED_FROM a Scope);
// a node never belongs to both.
//
// THE GRAPH IS DERIVED, NEVER AUTHORED. Every node here is projected from an artifact already on
// disk, so the graph can be deleted and rebuilt byte-identically, and a run that predates it is
// backfilled by the same code path that maintains it. That is what makes it safe to treat as the
// read model: it cannot drift from the artifacts, because it has no independent existence.
//
// SINGLE WRITER. `harness reduce graph` is the only thing that appends. It lives under `reduce/`
// rather than `lib/` to say so in the file layout — `probe` imports it read-only.
//
// APPEND-ONLY, and idempotent. Re-running over an unchanged tree appends nothing; re-running after
// new artifacts land appends only what is new. A node that reappears with new attributes is
// appended again and the LAST line wins on read, so the file is a log and the projection is a fold.

import { existsSync, readdirSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import {
  localRoot, receipt as receiptPath, ordersDir, resultsDir, verdictsDir, trials as trialsPath,
  scopesDir, usecasesDir, requirements as requirementsPath, wiringMap as wiringMapPath,
} from "../lib/paths.mjs";
import { readAllContracts, readContract, SCOPE_CONTRACT, WIRING_MAP } from "../lib/contract.mjs";
import { runIdFromReceipt } from "../lib/paths.mjs";

/** The graph's home — one file per feature, beside the run trace it projects. */
export const graphPath = (cwd, slug) => join(localRoot(cwd, slug), "graph.jsonl");

/** Node types, by family. A type outside these sets is a bug, not an extension point. */
export const WORK_NODES = ["Run", "Order", "Result", "Verdict", "Trial"];
export const DOMAIN_NODES = ["Scope", "UseCase", "Requirement", "Seam"];

/** Edge types. Each names a direction that is meaningful to read backwards. */
export const EDGES = ["PRODUCED", "EVALUATES", "SUPERSEDES", "COVERS", "DEPENDS_ON", "DERIVED_FROM"];

/**
 * Read the graph as a log and fold it into nodes and edges.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{nodes: Map<string,object>, edges: Map<string,object>, lines: number}} The folded graph;
 *   `lines` counts what was read, so a caller can tell an empty graph from an absent one.
 */
export function readGraph(cwd, slug) {
  const nodes = new Map(), edges = new Map();
  const p = graphPath(cwd, slug);
  let lines = 0;
  if (!existsSync(p)) return { nodes, edges, lines };
  for (const line of readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }   // a torn line proves nothing; skip it
    lines++;
    if (row.k === "node" && row.id) nodes.set(row.id, { ...(nodes.get(row.id) || {}), ...row });
    else if (row.k === "edge" && row.from && row.to && row.t) edges.set(`${row.from}|${row.t}|${row.to}`, row);
  }
  return { nodes, edges, lines };
}

/** Read a JSON file without throwing. @param {string} p Path. @returns {*} Parsed value or null. */
function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/** Every `## Heading`-anchored id in a requirements or use-case document. */
function idsIn(text, re) {
  return [...new Set([...String(text || "").matchAll(re)].map((m) => m[1]))];
}

/**
 * Project every artifact on disk for one run into nodes and edges.
 *
 * Pure: reads the tree, returns the graph it implies, writes nothing. That is what lets the same
 * function serve both the incremental append and the backfill of a run recorded before this file
 * existed — there is no second code path to keep in step.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{nodes: object[], edges: object[]}} Everything the artifacts imply, in a stable order.
 */
export function project(cwd, slug) {
  const nodes = [], edges = [];
  const node = (id, t, attrs = {}) => nodes.push({ k: "node", id, t, ...attrs });
  const edge = (from, t, to) => edges.push({ k: "edge", from, t, to });

  const root = localRoot(cwd, slug);
  const receipt = readJson(receiptPath(cwd, slug));
  const runId = runIdFromReceipt(receipt);
  const runNode = runId ? `run:${runId}` : null;

  // ---- work lineage --------------------------------------------------------------------------
  if (runNode) {
    node(runNode, "Run", {
      run_id: runId, slug,
      started_at: receipt?.started_at ?? null,
      intake_sha256: receipt?.intake_sha256 ?? null,
      auto_level: receipt?.config?.auto_level ?? null,
    });
  }

  const oDir = ordersDir(cwd, slug);
  const rDir = resultsDir(cwd, slug);
  const orderByFile = new Map();
  if (existsSync(oDir)) {
    for (const f of readdirSync(oDir).filter((x) => x.endsWith(".json")).sort()) {
      const o = readJson(join(oDir, f));
      if (!o?.order_id) continue;
      const id = `order:${o.order_id}`;
      orderByFile.set(f, { id, order: o });
      node(id, "Order", {
        order_id: o.order_id, worker: o.worker ?? null, operation: o.operation ?? null,
        round: o.round ?? null, attempt: o.attempt ?? null,
        scope_id: o.payload?.scope_contract?.scope_id ?? o.payload?.scope_id ?? null,
        run_id: o.run_id ?? runId ?? null,
      });
      if (runNode) edge(runNode, "PRODUCED", id);
      const scopeId = o.payload?.scope_contract?.scope_id ?? o.payload?.scope_id ?? null;
      if (scopeId) edge(id, "DERIVED_FROM", `scope:${slug}:${scopeId}`);
    }
  }

  if (existsSync(rDir)) {
    for (const f of readdirSync(rDir).filter((x) => x.endsWith(".json")).sort()) {
      const r = readJson(join(rDir, f));
      if (!r?.order_id) continue;
      const id = `result:${r.order_id}`;
      node(id, "Result", {
        order_id: r.order_id, status: r.status ?? null,
        artifacts: Array.isArray(r.artifacts) ? r.artifacts.length : 0,
        discoveries: Array.isArray(r.discoveries) ? r.discoveries.length : 0,
      });
      edge(`order:${r.order_id}`, "PRODUCED", id);
    }
  }

  // T0 verdicts — the artifact the evaluator is required to cite, and the reason the lineage half
  // of this graph is worth having: a verdict node is the anchor of every "show me the evidence".
  const vDir = verdictsDir(cwd, slug);
  if (existsSync(vDir)) {
    for (const f of readdirSync(vDir).filter((x) => x.endsWith(".json")).sort()) {
      const v = readJson(join(vDir, f));
      if (!v) continue;
      const id = `verdict:${slug}:${basename(f, ".json")}`;
      node(id, "Verdict", {
        artifact: f, overall: v.overall ?? null, regression: !!v.regression,
        round: v.round ?? null, attempt: v.attempt ?? null, scope_id: v.scope_id ?? null,
        run_id: v.run_id ?? runId ?? null,
      });
      if (v.scope_id) edge(id, "EVALUATES", `scope:${slug}:${v.scope_id}`);
      if (v.round != null && v.attempt != null && v.scope_id) {
        edge(`order:${slug}/${v.scope_id}-r${v.round}-a${v.attempt}`, "PRODUCED", id);
      }
    }
  }

  // Trials — the ratchet's own history, with a real parent link already in the row.
  const tPath = trialsPath(cwd, slug);
  if (existsSync(tPath)) {
    for (const line of readFileSync(tPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const t = readJson0(line);
      if (!t?.trial) continue;
      // THE SCOPE IS PART OF THE KEY, because the ordinal alone is not unique. A trial ordinal
      // counts within its scope, so `trial:<slug>:1` names one row per scope and every one of them
      // collapsed onto a single node — the Map this graph is read back into keeps the last writer,
      // so a scope's whole execution record vanished silently. Measured: four scopes' trials
      // projected to two nodes. `--trace` is supposed to reach "the execution record"; it reached
      // whichever scope happened to be written last. `baseline_trial` is chosen from the same
      // scope's prior rows, so the SUPERSEDES edge resolves inside the same partition.
      const trialKey = (n) => `trial:${slug}:${t.scope_id ? `${t.scope_id}:` : ""}${n}`;
      const id = trialKey(t.trial);
      node(id, "Trial", {
        trial: t.trial, round: t.round ?? null, attempt: t.attempt ?? null,
        scope_id: t.scope_id ?? null, status: t.status ?? null, artifact: t.artifact ?? null,
        sha256: t.sha256 ?? null, run_id: t.run_id ?? runId ?? null,
      });
      if (t.baseline_trial) edge(id, "SUPERSEDES", trialKey(t.baseline_trial));
      if (t.artifact) edge(id, "EVALUATES", `verdict:${slug}:${basename(String(t.artifact), ".json")}`);
    }
  }

  // ---- domain --------------------------------------------------------------------------------
  const sDir = scopesDir(cwd, slug);
  if (existsSync(sDir)) {
    for (const { contract } of readAllContracts(sDir, SCOPE_CONTRACT)) {
      if (!contract?.scope_id) continue;
      const id = `scope:${slug}:${contract.scope_id}`;
      node(id, "Scope", {
        scope_id: contract.scope_id, title: contract.title ?? null,
        substrate: (contract.allowed_file_substrate || []).length,
      });
      for (const req of contract.covers || []) edge(id, "COVERS", `req:${slug}:${req}`);
    }
  }

  const uDir = usecasesDir(cwd, slug);
  if (existsSync(uDir)) {
    for (const f of readdirSync(uDir).filter((x) => x.endsWith(".md") && x !== "_index.md").sort()) {
      const ucId = basename(f, ".md");
      node(`uc:${slug}:${ucId}`, "UseCase", { use_case: ucId, file: f });
    }
  }

  const reqPath = requirementsPath(cwd, slug);
  if (existsSync(reqPath)) {
    for (const r of idsIn(readFileSync(reqPath, "utf8"), /^\s*[-*|]?\s*\**\s*(REQ-[A-Z0-9-]+)/gm)) {
      node(`req:${slug}:${r}`, "Requirement", { req_id: r });
    }
  }

  // The wiring map is literally a graph written as a table: per use case, engine → seam →
  // entry-point call site → affordance. Reading it back as edges is the whole reason it is a table.
  const wPath = wiringMapPath(cwd, slug);
  if (existsSync(wPath)) {
    const found = readContract(wPath, WIRING_MAP);
    for (const row of found?.contract?.wiring || found?.contract?.rows || []) {
      const uc = row.use_case || row.uc;
      const seam = row.seam;
      if (!uc || !seam) continue;
      const seamId = `seam:${slug}:${seam}`;
      node(seamId, "Seam", { seam, engine: row.engine ?? null, entry_point: row.entry_point ?? null });
      edge(`uc:${slug}:${uc}`, "DEPENDS_ON", seamId);
    }
  }

  return { nodes, edges };
}

/** JSON.parse for one line, without throwing. @param {string} l Line. @returns {*} Parsed or null. */
function readJson0(l) {
  try { return JSON.parse(l); } catch { return null; }
}

/**
 * Append everything the artifacts imply that the graph does not already carry.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{path: string, nodes_added: number, edges_added: number, nodes_total: number, edges_total: number, backfilled: boolean}}
 *   `backfilled` is true when the graph did not exist before this call — the migration case, which
 *   is the same code path as the steady-state one.
 */
export function appendGraph(cwd, slug) {
  const p = graphPath(cwd, slug);
  const before = readGraph(cwd, slug);
  const backfilled = before.lines === 0;
  const { nodes, edges } = project(cwd, slug);

  const out = [];
  for (const n of nodes) {
    const prev = before.nodes.get(n.id);
    // Append only when something actually changed — the file is a log, and a log that repeats
    // itself on every run stops being readable long before it stops being correct.
    if (!prev || JSON.stringify({ ...prev, k: undefined }) !== JSON.stringify({ ...n, k: undefined })) out.push(n);
  }
  for (const e of edges) {
    if (!before.edges.has(`${e.from}|${e.t}|${e.to}`)) out.push(e);
  }

  if (out.length) {
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  const after = readGraph(cwd, slug);
  return {
    path: p,
    nodes_added: out.filter((r) => r.k === "node").length,
    edges_added: out.filter((r) => r.k === "edge").length,
    nodes_total: after.nodes.size,
    edges_total: after.edges.size,
    backfilled,
  };
}

/**
 * The bounded subgraph a relaunch needs — the fast-forward as a query rather than a directory walk.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {object} Counts and ids only. Deliberately small: the point of the graph is that the
 *   orchestrator's working set is a subgraph, not a re-read of all state.
 */
export function runSubgraph(cwd, slug) {
  const { nodes, edges, lines } = readGraph(cwd, slug);
  const of = (t) => [...nodes.values()].filter((n) => n.t === t);
  const orders = of("Order"), results = of("Result"), verdicts = of("Verdict");
  const resultIds = new Set(results.map((r) => r.order_id));
  const greenByRound = {};
  for (const v of verdicts) {
    if (v.overall !== "green" || v.round == null || !v.scope_id) continue;
    (greenByRound[v.round] ||= new Set()).add(v.scope_id);
  }
  return {
    graph_lines: lines,
    run: of("Run")[0]?.run_id ?? null,
    scopes: of("Scope").map((s) => s.scope_id).sort(),
    use_cases: of("UseCase").map((u) => u.use_case).sort(),
    requirements: of("Requirement").map((r) => r.req_id).sort(),
    seams: of("Seam").map((s) => s.seam).sort(),
    orders: orders.length,
    pending_orders: orders.filter((o) => !resultIds.has(o.order_id)).map((o) => o.order_id).sort(),
    rounds_with_green: Object.keys(greenByRound).map(Number).sort((a, b) => a - b),
    green_scopes_by_round: Object.fromEntries(Object.entries(greenByRound).map(([r, s]) => [r, [...s].sort()])),
    trials: of("Trial").length,
    edges: edges.size,
  };
}

/**
 * Walk backwards from one node, following every edge that points at it or away from it.
 *
 * This is the reliability invariant made executable: pick a verdict, walk to the order that
 * produced it, the scope it evaluates, the requirements that scope covers, and the trials that
 * superseded it — in one query, over one file, instead of a grep across four.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} startId - The node to trace from.
 * @param {number} [depth=4] - How many hops to follow.
 * @returns {{start: string, found: boolean, path: object[]}} Each hop as `{from, t, to, node}`. A
 *   hop whose far node carries `missing: true` is a dangling edge — the artifact it names is not on
 *   disk. That is reported rather than dropped: an edge to nothing is a fact about the run.
 */
export function trace(cwd, slug, startId, depth = 4) {
  const { nodes, edges } = readGraph(cwd, slug);
  if (!nodes.has(startId)) return { start: startId, found: false, path: [] };
  const seen = new Set([startId]);
  let frontier = [startId];
  const path = [];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next = [];
    for (const e of edges.values()) {
      for (const [near, far] of [[e.from, e.to], [e.to, e.from]]) {
        if (!frontier.includes(near) || seen.has(far)) continue;
        seen.add(far);
        next.push(far);
        path.push({ from: e.from, t: e.t, to: e.to, node: nodes.get(far) ?? { id: far, t: "?", missing: true } });
      }
    }
    frontier = next;
  }
  return { start: startId, found: true, path };
}

export const ARGV_SPEC = {
  usage: "harness.mjs reduce graph --slug <slug> [--cwd <dir>] [--subgraph run] [--trace <node-id>] [--depth N]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
  subgraph: { type: "enum", values: ["run"] },
  trace: { type: "str" },
  depth: { type: "int", min: 1, max: 12, default: 4 },
};

/**
 * Append everything the artifacts imply, then optionally answer a query over the result.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0; prints the append report, or the requested query, as JSON.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const report = appendGraph(cwd, args.slug);
  if (args.trace) { console.log(JSON.stringify(trace(cwd, args.slug, args.trace, args.depth), null, 2)); process.exit(0); }
  if (args.subgraph) { console.log(JSON.stringify(runSubgraph(cwd, args.slug), null, 2)); process.exit(0); }
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}
