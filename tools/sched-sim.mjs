#!/usr/bin/env node
// BUILD SCHEDULER SIMULATION — makespan and peak concurrency, chunked waves vs the sliding window.
//
// Repo-only (tools/ never ships). It exists because "the new scheduler should be faster" is an
// assertion, and this repo's standing rule is that a number belongs to a run. The scheduling
// decision is pure — no dispatch, no clock, no randomness — so it can be measured exactly, for free,
// on a virtual clock, against the SHIPPED source rather than a copy of it.
//
// Read the output as ratios, not as seconds. A "unit" is one leg's wall-clock; what the table shows
// is how much of the workload's critical path each scheduler manages to hit.
//
//   node tools/sched-sim.mjs [--json]

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScheduler, runVirtual, fakeLauncher, chunkedSchedule } from "../tests/lib/scheduler-region.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { scopeEdges, scheduleScopes } = loadScheduler(ROOT);

/**
 * Turn a workload spec into the three things both schedulers consume: the scope objects, the waves
 * the kernel would derive (Kahn, one level per iteration — the same algorithm `scopeWaves` runs),
 * and the edge list `probe resume` would emit.
 *
 * @param {Object<string,{ms:number, deps?:string[], dies?:boolean, drops?:boolean}>} spec - Scopes.
 * @returns {{scopes:Array, waves:Array[], rawDeps:string[][], critical:number}}
 */
function build(spec) {
  const ids = Object.keys(spec);
  const scopes = ids.map((id) => ({ scope_id: id, path: `scopes/${id}.md` }));
  const deps = new Map(ids.map((id) => [id, new Set(spec[id].deps || [])]));

  const waves = [];
  const done = new Set();
  while (done.size < ids.length) {
    const ready = scopes.filter((s) => !done.has(s.scope_id) && [...deps.get(s.scope_id)].every((d) => done.has(d)));
    if (!ready.length) { waves.push(scopes.filter((s) => !done.has(s.scope_id))); break; }
    waves.push(ready);
    for (const s of ready) done.add(s.scope_id);
  }

  const rawDeps = [];
  for (const id of ids) for (const d of deps.get(id)) rawDeps.push([`scopes/${id}.md`, `scopes/${d}.md`]);

  // The critical path: the best any scheduler could do at unbounded width. The floor the table's
  // "window" column is really being compared against.
  const memo = new Map();
  const longest = (id) => {
    if (memo.has(id)) return memo.get(id);
    const v = spec[id].ms + Math.max(0, ...[...deps.get(id)].map(longest));
    memo.set(id, v);
    return v;
  };
  return { scopes, waves, rawDeps, critical: Math.max(...ids.map(longest)) };
}

/**
 * Run one workload through both schedulers.
 *
 * @param {{name:string, dial:number, spec:object}} w - The workload.
 * @returns {Promise<object>} One row of the comparison table.
 */
async function measure(w, ramp = 0) {
  const { scopes, waves, rawDeps, critical } = build(w.spec);
  const edges = scopeEdges(rawDeps, waves, scopes);
  const order = waves.flat();

  const chunked = await runVirtual(async (sleep, now) => {
    const f = fakeLauncher(sleep, now, w.spec, { ramp });
    const settled = await chunkedSchedule(waves, w.dial, f.launch);
    return { peak: f.maxConcurrent(), order: f.order(), settled: settled.length, trace: f.trace };
  });
  const window = await runVirtual(async (sleep, now) => {
    const f = fakeLauncher(sleep, now, w.spec, { ramp });
    const settled = await scheduleScopes(order, edges, w.dial, f.launch);
    return { peak: f.maxConcurrent(), order: f.order(), settled: settled.length, trace: f.trace };
  });

  return {
    workload: w.name,
    dial: w.dial,
    scopes: scopes.length,
    critical_path: critical,
    chunked_makespan: chunked.elapsed,
    window_makespan: window.elapsed,
    saved_pct: chunked.elapsed ? Math.round(((chunked.elapsed - window.elapsed) / chunked.elapsed) * 1000) / 10 : 0,
    chunked_peak: chunked.result.peak,
    window_peak: window.result.peak,
    chunked_order: chunked.result.order.join(","),
    window_order: window.result.order.join(","),
    settled: `${chunked.result.settled}/${window.result.settled}`,
  };
}

// The workloads. Every one is either a shape a real run produced or a shape that isolates one of the
// two barriers, and each says which.
const S = (ms, deps = [], extra = {}) => ({ ms, deps, ...extra });

const WORKLOADS = [
  {
    // THE CHUNK BARRIER, isolated. Six independent scopes, dial 4: chunked runs 4, waits, runs 2.
    name: "W1 wide wave, narrow dial (6 indep, even legs)",
    dial: 4,
    spec: { a: S(10), b: S(10), c: S(10), d: S(10), e: S(10), f: S(10) },
  },
  {
    // The same shape with ONE slow leg. The chunked loop pays the slow leg's whole duration before
    // it will start anything else; the window starts the tail the moment a fast leg lands.
    name: "W2 one slow leg among fast (6 indep, dial 4)",
    dial: 4,
    spec: { slow: S(100), b: S(10), c: S(10), d: S(10), e: S(10), f: S(10) },
  },
  {
    // A pure chain. Nothing to win — the critical path IS the workload. Included because a scheduler
    // that "wins" here is cheating on a dependency edge.
    name: "W3 dependency chain (a→b→c→d)",
    dial: 4,
    spec: { a: S(10), b: S(10, ["a"]), c: S(10, ["b"]), d: S(10, ["c"]) },
  },
  {
    // THE WAVE BARRIER, isolated. `x` consumes only `fast`. Wave-release holds it for the slow leg.
    name: "W4 late release (x needs only the fast leg)",
    dial: 4,
    spec: { slow: S(100), fast: S(10), x: S(10, ["fast"]) },
  },
  {
    // The todo-cli shape that cost criterion 1 a run: foundation → four commands → cli-integration.
    name: "W5 todo-cli shape (1→4→1, uneven commands)",
    dial: 4,
    spec: {
      foundation: S(20),
      "add-todo": S(30, ["foundation"]),
      "complete-todo": S(10, ["foundation"]),
      "list-todos": S(10, ["foundation"]),
      "remove-todo": S(10, ["foundation"]),
      "cli-integration": S(20, ["add-todo", "complete-todo", "list-todos", "remove-todo"]),
    },
  },
  {
    // The same, at the dial an operator drops to when a worker archetype is not parallel-safe.
    name: "W6 todo-cli shape at dial 2",
    dial: 2,
    spec: {
      foundation: S(20),
      "add-todo": S(30, ["foundation"]),
      "complete-todo": S(10, ["foundation"]),
      "list-todos": S(10, ["foundation"]),
      "remove-todo": S(10, ["foundation"]),
      "cli-integration": S(20, ["add-todo", "complete-todo", "list-todos", "remove-todo"]),
    },
  },
  {
    // The sample project: two independent modules, one integrating CLI. Both barriers are genuine
    // here — reported so the zero shows up in the table rather than being left out of it.
    name: "W7 phase3-envlint shape (2→1)",
    dial: 4,
    spec: { parse: S(20), rules: S(20), cli: S(20, ["parse", "rules"]) },
  },
  {
    // A dead leg mid-round. The interesting number is not the makespan, it is that both schedulers
    // still settle every scope.
    name: "W8 a leg dies (6 indep, dial 4)",
    dial: 4,
    spec: { a: S(10), b: S(10, [], { dies: true }), c: S(10), d: S(10), e: S(10), f: S(10) },
  },
  {
    // The chunk penalty is a function of DURATION VARIANCE INSIDE A GROUP, and these two bound it.
    // One slow leg drags one group.
    name: "W9 8 indep, one 4x leg (dial 4)",
    dial: 4,
    spec: { slow: S(40), b: S(10), c: S(10), d: S(10), e: S(10), f: S(10), g: S(10), h: S(10) },
  },
  {
    // The worst case, and it is not exotic: a slow leg in EVERY group. The chunked loop pays each
    // one end to end; the window pays them concurrently. An attempt ratchet that stops at attempt 1
    // for some scopes and burns three for others produces exactly this spread.
    name: "W10 8 indep, a slow leg per group (dial 4)",
    dial: 4,
    spec: { s1: S(50), b: S(1), c: S(1), d: S(1), s2: S(50), f: S(1), g: S(1), h: S(1) },
  },
  {
    // The sequential lane. Must be identical in BOTH makespan and order.
    name: "W11 dial of 1 (todo-cli shape)",
    dial: 1,
    spec: {
      foundation: S(20),
      "add-todo": S(30, ["foundation"]),
      "complete-todo": S(10, ["foundation"]),
      "list-todos": S(10, ["foundation"]),
      "remove-todo": S(10, ["foundation"]),
      "cli-integration": S(20, ["add-todo", "complete-todo", "list-todos", "remove-todo"]),
    },
  },
];

// A leg's dispatch is not free and legs do not start together. RAMP is a serialised per-dispatch
// cost, and 5 units against 10–50-unit legs is roughly the ratio an archived run showed: four legs
// of one wave started across 54 s inside a 376 s build span.
const RAMP = Number((process.argv.find((a) => a.startsWith("--ramp=")) || "").split("=")[1] || 5);

const rows = [];
for (const w of WORKLOADS) rows.push(await measure(w, 0));
const ramped = [];
for (const w of WORKLOADS) ramped.push(await measure(w, RAMP));

const table = (rs, title) => {
  const cols = ["workload", "dial", "critical_path", "chunked_makespan", "window_makespan", "saved_pct", "chunked_peak", "window_peak", "settled"];
  const head = ["workload", "dial", "crit", "chunked", "window", "saved %", "peak(c)", "peak(w)", "settled"];
  const width = cols.map((c, i) => Math.max(head[i].length, ...rs.map((r) => String(r[c]).length)));
  const line = (cells) => cells.map((v, i) => String(v).padEnd(width[i])).join("  ");
  console.log(`\n${title}`);
  console.log(line(head));
  console.log(width.map((w) => "-".repeat(w)).join("  "));
  for (const r of rs) console.log(line(cols.map((c) => r[c])));
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ instant: rows, ramped, ramp: RAMP }, null, 2));
} else {
  table(rows, "A · legs start the moment a slot opens (the optimistic model)");
  table(ramped, `B · legs take a turn on a serialised dispatch path costing ${RAMP} units (the measured one)`);
  console.log("\nDispatch order (chunked | window), model A:");
  for (const r of rows) {
    const same = r.chunked_order === r.window_order ? "  = " : "  ≠ ";
    console.log(`${same}${r.workload}\n      chunked: ${r.chunked_order}\n      window : ${r.window_order}`);
  }
}
