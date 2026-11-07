// 25 — THE BUILD SCHEDULE, EXECUTED RATHER THAN PATTERN-MATCHED.
//
// WHY THIS MODULE EXISTS.
//
// Which scopes may open at a given moment is a PURE decision — no dispatch, no filesystem, no clock, no
// randomness — which makes it the one part of the build loop that can be proved for free. It lives in
// `kernel/lib/schedule.mjs`, and `probe next` asks it which scopes are releasable. This module RUNS it, on
// a virtual clock, against fixtures with known dependency edges and known per-leg durations: every check
// below is a fact about a schedule that actually happened, not about how the source is written.
//
// The simulator is the loop's own protocol and nothing more: at time t ask `releasable`, start what comes
// back, advance to the next completion, mark that scope settled, ask again.
//
// WHAT EACH CHECK IS DEFENDING, in one line each:
//   (a) the schedule is there and loads — an absence is a failure, never a skip
//   (b) a scope never starts beside a scope it consumes           ← the run this cost
//   (c) no scope is dropped, whatever the edge data looks like
//   (d) a cyclic edge set does not hang — it is the one input that turns a scheduler silent
//   (e) the dial is a real cap AND is really reached
//   (f) a dial of 1 is the sequential lane, in order, exactly
//   (i) a scope is released on ITS OWN dependency, not on the slowest member of the previous wave
//   (j) the kernel's edges are used only when they agree with the kernel's waves
//   (k) two scopes that may write one declared-shared path never build at the same time
//   (l) the ceiling reported before dispatching is the peak that actually happens
//
// RETIRED WITH THE RUN SCRIPT, and why. (g) "a dead builder is a spent attempt and does not narrow the
// window" and (h) "a dropped leg is named, never a bare null" were properties of the script's own launcher
// closure. Neither survives as a scheduling fact: an attempt is spent when the attested channels say so
// (`probe attempts`, pinned by section 73) and a sub-agent that dies runs the step's `on_fail_close`
// (pinned by the state-machine suite's rows for a dead dispatch). The repeated-scope-id half of (c) went
// the same way: a scope id is a contract's file name, unique in a directory by construction.

import { scheduleFor, releasable, scopeEdges, withExclusions, releaseCeiling, idOf } from "../../kernel/lib/schedule.mjs";

/** Build the scope list, the kernel's waves, edge list and exclusion pairs from a spec. */
function fixture(spec, order, pairs = []) {
  const ids = order || Object.keys(spec);
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
  return {
    scopes, waves, rawDeps, order: waves.flat(), pairs,
    facts: { scope_files: scopes, scope_waves: waves.map((w) => w.map((s) => s.path)), scope_deps: rawDeps, scope_exclusions: pairs },
  };
}

/** The loop's protocol on a virtual clock. `ramp` staggers legs started at one instant, as real dispatch does. */
function simulate(sched, plan, dial, { ramp = 0 } = {}) {
  let t = 0, guard = 0, peak = 0;
  const inFlight = new Map(), settled = [], trace = [], order = [];
  for (;;) {
    const rel = releasable(sched, { settled: new Set(settled), inFlight: new Set(inFlight.keys()) }, dial);
    rel.forEach((s, i) => {
      const start = t + ramp * i, end = start + plan[s.scope_id].ms;
      inFlight.set(s.scope_id, end); trace.push({ scope_id: s.scope_id, start, end }); order.push(s.scope_id);
    });
    peak = Math.max(peak, inFlight.size);
    if (!inFlight.size) break;
    t = Math.min(...inFlight.values());
    for (const [id, end] of [...inFlight]) if (end <= t) { inFlight.delete(id); settled.push(id); }
    if (++guard > 1000) throw new Error("the schedule never settled");
  }
  return { settled, trace, peak, order, elapsed: t };
}

/** The loop this design replaced, for the barrier comparison: scopes stepped a wave at a time, in dial-wide groups. */
function waveStepped(waves, plan, dial, ramp = 0) {
  let t = 0;
  const width = Math.max(1, dial);
  for (const w of waves) {
    for (let i = 0; i < w.length; i += width) t += Math.max(...w.slice(i, i + width).map((s, j) => j * ramp + plan[s.scope_id].ms));
  }
  return t;
}

/** Every place a leg started before a leg it depends on had finished. */
function edgeViolations(trace, edges) {
  const byId = new Map(trace.map((r) => [r.scope_id, r]));
  const bad = [];
  for (const [to, froms] of edges) {
    for (const from of froms) {
      const a = byId.get(to), b = byId.get(from);
      if (a && b && a.start < b.end) bad.push(`${to} started at t=${a.start}, but ${from} it depends on did not end until t=${b.end}`);
    }
  }
  return bad;
}

/**
 * Run the build-schedule checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ok, fail, section } = ctx;

  // =============================================================================
  section("69. BUILD’s schedule — the order scopes open in, on a virtual clock, through `releasable`");
  // =============================================================================

  // --- (a) ----------------------------------------------------------------------------------------
  if ([scheduleFor, releasable, scopeEdges, withExclusions, releaseCeiling, idOf].every((f) => typeof f === "function")) {
    ok("kernel/lib/schedule.mjs defines scheduleFor + releasable + scopeEdges + withExclusions + releaseCeiling — every check below runs the shipped module, not a copy");
  } else { fail("kernel/lib/schedule.mjs is missing part of the schedule's surface"); return; }

  // --- (b) A DEPENDENCY EDGE IS NEVER VIOLATED -------------------------------------------------
  // Measured on a live run: scopes chunked by a fixed width over alphabetical order put `cli-integration` —
  // the scope that replaces the placeholder entry point and routes to every command scope's module —
  // beside the scopes it consumes. It burned all three attempts at 0/2 fixtures. One scheduling decision
  // produced 19 EVAL failures. The dependant is ALPHABETICALLY FIRST, so an implementation that merely
  // sorts is caught, and the dial is WIDER than the workload, so nothing but the release rule can hold a
  // scope back. Run twice: the second hands the schedule the RAW order, dependant first, because a body
  // that resolves its dependencies in one construction pass silently loses every edge declared later.
  {
    const spec = { "aaa-wiring": { ms: 10, deps: ["mmm-feature"] }, "mmm-feature": { ms: 10, deps: ["zzz-core"] }, "zzz-core": { ms: 10, deps: [] } };
    const f = fixture(spec, ["aaa-wiring", "mmm-feature", "zzz-core"]);
    const sched = scheduleFor(f.facts, 8);
    const problems = [];
    for (const [how, order] of [["wave order", sched.order], ["reversed item order, dependant first", f.scopes]]) {
      const r = simulate({ order, edges: sched.edges }, spec, 8);
      const bad = edgeViolations(r.trace, sched.edges);
      if (bad.length) problems.push(`${how}: ${bad.join("; ")}`);
      if (r.settled.length !== 3) problems.push(`${how}: ${r.settled.length}/3 scopes settled`);
    }
    if (!problems.length) ok("a scope is never started before a scope it consumes has settled — at a dial of 8, with the dependant declared alphabetically first, and whether or not the item list arrives in dependency order");
    else fail(`the BUILD schedule released a scope early:\n    ${problems.join("\n    ")}`);
  }

  // --- (c) NO SCOPE IS DROPPED, whatever the edge data looks like --------------------------------
  {
    const spec = { a: { ms: 5 }, b: { ms: 5 }, c: { ms: 5 } };
    const f = fixture(spec);
    const junk = [["scopes/a.md", "scopes/a.md"], ["scopes/a.md", "scopes/nope.md"], ["scopes/ghost.md", "scopes/b.md"], ["scopes/b.md"], "not-an-array"];
    const sched = scheduleFor({ ...f.facts, scope_deps: junk }, 2);
    const r = simulate(sched, spec, 2);
    if (JSON.stringify([...r.settled].sort()) === JSON.stringify(["a", "b", "c"])) ok("a malformed edge list drops edges, never scopes — every scope settles exactly once");
    else fail(`malformed edges: settled ${JSON.stringify(r.settled)}, expected a,b,c`);
    const unreadable = scheduleFor({ scope_files: f.scopes, scope_waves: [["scopes/a.md"]], scope_deps: [], scope_exclusions: [] }, 4);
    if (unreadable.order.length === 3) ok("waves that account for fewer scopes than the round holds fall back to one wave — no scope is lost to a partial grouping");
    else fail(`a partial wave list lost scopes: ${unreadable.order.map((s) => s.scope_id)}`);
  }

  // --- (d) A CYCLIC EDGE SET DOES NOT HANG ---------------------------------------------------------
  {
    const spec = { a: { ms: 5 }, b: { ms: 5 } };
    const f = fixture(spec);
    const cyclic = [["scopes/a.md", "scopes/b.md"], ["scopes/b.md", "scopes/a.md"]];
    let settled = 0, detail = "";
    try { settled = simulate(scheduleFor({ ...f.facts, scope_deps: cyclic }, 2), spec, 2).settled.length; } catch (e) { detail = e.message; }
    if (settled === 2) ok("a cyclic dependency edge set is refused and the round still builds every scope — a cycle costs the per-edge release, never the run");
    else fail(`a cyclic edge set stalled the BUILD schedule (${detail || `${settled}/2 settled`}); a hang has no diagnostic and looks exactly like a slow worker`);
  }

  // --- (e) THE DIAL IS A REAL CAP, AND IS REALLY REACHED ---------------------------------------------
  {
    const spec = Object.fromEntries("abcdefgh".split("").map((id) => [id, { ms: 10 }]));
    const f = fixture(spec);
    const problems = [];
    for (const width of [1, 2, 3, 4, 5]) {
      const r = simulate(scheduleFor(f.facts, width), spec, width);
      if (r.peak > width) problems.push(`dial ${width}: ${r.peak} legs ran at once`);
      if (r.peak < width) problems.push(`dial ${width}: never exceeded ${r.peak} concurrent legs over 8 independent scopes`);
    }
    for (const junk of [0, -3, NaN]) {
      const r = simulate(scheduleFor(f.facts, junk), spec, junk);
      if (r.peak !== 1) problems.push(`dial ${String(junk)} produced ${r.peak} concurrent legs instead of flooring at 1`);
      if (r.settled.length !== 8) problems.push(`dial ${String(junk)} settled ${r.settled.length}/8 scopes`);
    }
    // An omitted dial is the documented default (4), not a floor: the launch record omits it unless typed.
    const dflt = simulate(scheduleFor(f.facts, undefined), spec, undefined);
    if (dflt.peak !== 4) problems.push(`an omitted dial peaked at ${dflt.peak}, expected the documented default of 4`);
    if (!problems.length) ok("the dial is honoured exactly at 1–5 over 8 independent scopes, a junk dial floors at 1 rather than running unbounded, and an omitted dial is the default of 4");
    else fail(`the concurrency dial is not what it says:\n    ${problems.join("\n    ")}`);
  }

  // --- (f) A DIAL OF 1 IS THE SEQUENTIAL LANE, IN ORDER, EXACTLY -----------------------------------------
  {
    const spec = {
      foundation: { ms: 20 }, "add-todo": { ms: 30, deps: ["foundation"] }, "complete-todo": { ms: 10, deps: ["foundation"] },
      "list-todos": { ms: 10, deps: ["foundation"] }, "remove-todo": { ms: 10, deps: ["foundation"] },
      "cli-integration": { ms: 20, deps: ["add-todo", "complete-todo", "list-todos", "remove-todo"] },
    };
    const f = fixture(spec);
    const mine = simulate(scheduleFor(f.facts, 1), spec, 1);
    const before = f.order.map((s) => s.scope_id);
    const sum = Object.values(spec).reduce((a, s) => a + s.ms, 0);
    if (mine.order.join(",") === before.join(",") && mine.elapsed === sum) ok(`a dial of 1 reproduces the sequential lane exactly — same dispatch order (${mine.order.join(" → ")}) and same makespan (${mine.elapsed})`);
    else fail(`a dial of 1 is not the sequential lane: order ${mine.order.join(",")} vs ${before.join(",")}; makespan ${mine.elapsed} vs ${sum}`);
  }

  // --- (i) A SCOPE IS RELEASED ON ITS OWN DEPENDENCY — measured against the wave-stepped loop ---------------
  // Two workloads: one where a wave barrier is paid (must be strictly faster) and one where the dependency is
  // genuine (must not be slower), each under two dispatch models. Legs measurably do NOT start together, so the
  // ramped model — a barrier re-pays the ramp on its far side — is the demanding direction for the claim.
  {
    const paid = { s1: { ms: 50 }, b: { ms: 1 }, c: { ms: 1 }, d: { ms: 1 }, s2: { ms: 50 }, f: { ms: 1 }, g: { ms: 1 }, h: { ms: 1 } };
    const genuine = { parse: { ms: 20 }, rules: { ms: 20 }, cli: { ms: 20, deps: ["parse", "rules"] } };
    const rows = [];
    for (const ramp of [0, 5]) {
      for (const [name, spec, strict] of [["a slow leg in every group", paid, true], ["a genuine dependency", genuine, false]]) {
        const f = fixture(spec);
        const mine = simulate(scheduleFor(f.facts, 4), spec, 4, { ramp }).elapsed;
        rows.push({ name: `${name} (ramp ${ramp})`, strict, mine, before: waveStepped(f.waves, spec, 4, ramp) });
      }
    }
    const regressions = rows.filter((r) => (r.strict ? r.mine >= r.before : r.mine > r.before));
    if (!regressions.length) ok(`releasing on a scope's own dependency beats the wave-stepped loop wherever a barrier was paid and never loses where the dependency is genuine — ${rows.map((r) => `${r.before}→${r.mine}`).join(", ")} ticks across both dispatch models`);
    else fail(`a barrier is back in the release rule:\n    ${regressions.map((r) => `${r.name}: ${r.before} ticks wave-stepped, ${r.mine} now`).join("\n    ")}`);
  }

  // --- (k) TWO SCOPES THAT MAY WRITE THE SAME PATH NEVER BUILD AT THE SAME TIME -----------------------------
  // Three concurrent writers to one declared-shared entry point lost work in TWENTY OF TWENTY trials, and nothing
  // notices: the surviving copy passes its fixtures, the sandbox guard permitted every write, and the
  // disjointness lint passed because the overlap was declared. The join is the defect, and the join only exists in
  // the schedule. Four properties: an excluded pair never overlaps; scopes that do not collide still fan out;
  // an exclusion beside a real dependency edge does not deadlock; absent or malformed pairs mean today's scheduling.
  {
    const spec = { foundation: { ms: 10 }, "add-todo": { ms: 20, deps: ["foundation"] }, "list-todos": { ms: 20, deps: ["foundation"] }, "cli-integration": { ms: 20, deps: ["foundation"] } };
    const pairs = [["scopes/add-todo.md", "scopes/cli-integration.md"], ["scopes/list-todos.md", "scopes/cli-integration.md"], ["scopes/add-todo.md", "scopes/list-todos.md"]];
    const f = fixture(spec, undefined, pairs);
    const sched = scheduleFor(f.facts, 4);
    const r = simulate(sched, spec, 4);
    const at = new Map(r.trace.map((t) => [t.scope_id, t]));
    const overlaps = [];
    for (const [a, b] of pairs.map((p) => p.map(idOf))) {
      const A = at.get(a), B = at.get(b);
      if (A && B && A.start < B.end && B.start < A.end) overlaps.push(`${a} [${A.start},${A.end}] overlaps ${b} [${B.start},${B.end}]`);
    }
    const wide = { a: { ms: 10 }, b: { ms: 10 }, c: { ms: 10 }, d: { ms: 10 } };
    const fw = fixture(wide);
    const one = scheduleFor({ ...fw.facts, scope_exclusions: [["scopes/a.md", "scopes/b.md"]] }, 4);
    const rw = simulate(one, wide, 4);
    const none = scheduleFor({ ...fw.facts, scope_exclusions: undefined }, 4);
    const junk = scheduleFor({ ...fw.facts, scope_exclusions: [["scopes/ghost.md", "scopes/a.md"], ["scopes/a.md"], 7] }, 4);
    const rn = simulate(none, wide, 4);
    // A PAIR WRITTEN DEPENDANT-FIRST, BETWEEN TWO SCOPES THAT ALSO HAVE A DEPENDENCY EDGE — the deadlock: an
    // exclusion oriented by the pair's own order points FORWARD, meets the dependency edge pointing back, and
    // the two scopes wait for each other with no error, no log line and no artifact.
    const chainSpec = { core: { ms: 10 }, wire: { ms: 10, deps: ["core"] } };
    const fc = fixture(chainSpec);
    const reversed = withExclusions(scopeEdges(fc.rawDeps, fc.waves, fc.scopes), [["scopes/wire.md", "scopes/core.md"]], fc.order);
    let chainOk = false, chainWhy = "";
    try {
      const rc = simulate({ order: fc.order, edges: reversed.edges }, chainSpec, 4);
      chainOk = rc.settled.length === 2 && !edgeViolations(rc.trace, reversed.edges).length;
      if (!chainOk) chainWhy = `${rc.settled.length}/2 settled`;
    } catch (e) { chainWhy = e.message; }
    const problems = [];
    if (sched.added !== 3) problems.push(`${sched.added} exclusion edge(s) landed, expected 3`);
    if (!chainOk) problems.push(`a pair written dependant-first deadlocked or lost a scope (${chainWhy})`);
    if (reversed.added !== 0) problems.push(`an exclusion between two scopes that already have a dependency edge added ${reversed.added} redundant edge(s)`);
    if (overlaps.length) problems.push(`excluded scopes ran concurrently:\n      ${overlaps.join("\n      ")}`);
    if (r.settled.length !== 4) problems.push(`${r.settled.length}/4 scopes settled under exclusions`);
    if (rw.peak !== 3) problems.push(`one excluded pair among four scopes dropped peak concurrency to ${rw.peak}, expected 3 — an exclusion is a pair, not a global lock`);
    if (none.added !== 0 || junk.added !== 0) problems.push(`absent/malformed pairs produced ${none.added}/${junk.added} edges, expected 0/0`);
    if (rn.peak !== 4) problems.push(`with no exclusions the window reached ${rn.peak}, expected the full dial of 4`);
    if (!problems.length) ok(`two scopes that may write the same declared-shared path are never open at once (3 pair(s) serialised, ${r.elapsed} ticks, no overlap), scopes that do not collide still fan out to the full dial, and absent or malformed pairs schedule exactly as before`);
    else fail(`the co-scheduling exclusion is not enforced:\n    ${problems.join("\n    ")}`);
  }

  // --- (l) THE REPORTED CEILING IS THE PEAK THAT ACTUALLY HAPPENS --------------------------------------------
  // The run says how many scopes CAN be open at once before dispatching anything, because that number and the
  // dial are different facts: a peak below the ceiling is a dispatch limit, a ceiling below the dial is the scope
  // cut. Asserted both ways on three graphs, including the pathological one — a feature whose entry point sits in
  // every scope's substrate has a ceiling of ONE, which is the honest answer and not a bug.
  {
    const cases = [
      ["nothing shared, four independent scopes", { a: { ms: 10 }, b: { ms: 10 }, c: { ms: 10 }, d: { ms: 10 } }, [], 4],
      ["a chain — nothing may ever overlap", { a: { ms: 10 }, b: { ms: 10, deps: ["a"] }, c: { ms: 10, deps: ["b"] } }, [], 1],
      ["every scope writes the entry point (a clique)", {
        foundation: { ms: 10 }, "add-todo": { ms: 10, deps: ["foundation"] }, "list-todos": { ms: 10, deps: ["foundation"] },
        "cli-integration": { ms: 10, deps: ["add-todo", "list-todos"] },
      }, "all", 1],
    ];
    const problems = [];
    for (const [name, spec, pairSpec, want] of cases) {
      const ids = Object.keys(spec);
      const pairs = pairSpec === "all" ? ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [`scopes/${a}.md`, `scopes/${b}.md`])) : pairSpec;
      const f = fixture(spec, undefined, pairs);
      const sched = scheduleFor(f.facts, 8);
      const r = simulate(sched, spec, 8);
      if (sched.ceiling !== want) problems.push(`${name}: ceiling reported ${sched.ceiling}, expected ${want}`);
      if (r.peak > sched.ceiling) problems.push(`${name}: ${r.peak} legs ran at once against a reported ceiling of ${sched.ceiling}`);
      if (r.peak < sched.ceiling) problems.push(`${name}: the schedule never reached its own reported ceiling (${r.peak} of ${sched.ceiling}) at an unbounded dial`);
      if (r.settled.length !== ids.length) problems.push(`${name}: ${r.settled.length}/${ids.length} settled`);
    }
    if (!problems.length) ok("the concurrency ceiling reported before dispatching is exactly the peak the schedule reaches — 4 when nothing is shared, 1 for a chain, and 1 when every scope writes the entry point, which is a scope-cutting fact and not a bug");
    else fail(`the reported concurrency ceiling is not what happens:\n    ${problems.join("\n    ")}`);
  }

  // --- (j) THE KERNEL'S EDGES ARE USED ONLY WHEN THEY AGREE WITH THE KERNEL'S WAVES -------------------------------
  // `scope_waves` and `scope_deps` are two projections of one graph the kernel parsed once, so each validates the
  // other: an edge list that does not re-derive the wave order has lost or invented an edge in transit, and the safe
  // reading of a lost edge is the wave it came from — never a scope released early on data already shown wrong.
  {
    const spec = { slow: { ms: 100 }, fast: { ms: 10 }, x: { ms: 10, deps: ["fast"] } };
    const f = fixture(spec);
    const startOfX = (deps) => simulate(scheduleFor({ ...f.facts, scope_deps: deps }, 4), spec, 4).trace.find((t) => t.scope_id === "x").start;
    const faithful = startOfX(f.rawDeps);
    const fallback = startOfX([["scopes/x.md", "scopes/nope.md"]]);
    const withJunk = startOfX([...f.rawDeps, ["scopes/x.md", "scopes/x.md"], ["scopes/ghost.md", "scopes/fast.md"]]);
    if (faithful === 10 && fallback === 100 && withJunk === 10) ok("a faithful edge list releases a scope when its own dependency lands (t=10, not t=100); a single junk row is dropped on its own; and an edge list that does not re-derive the wave order falls back to wave release rather than trusting data already shown to be wrong");
    else fail(`the edge/wave cross-check is not doing its job: faithful x at t=${faithful} (expected 10), with a junk row at t=${withJunk} (expected 10), mangled at t=${fallback} (expected the wave release, 100)`);
  }
}
