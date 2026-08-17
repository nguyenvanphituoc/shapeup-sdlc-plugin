// 23 — THE BUILD SCHEDULER, EXECUTED RATHER THAN PATTERN-MATCHED.
//
// WHY THIS MODULE EXISTS.
//
// BUILD's fan-out used to be `for (const group of waves.flatMap((w) => chunk(w, maxParallelScopes)))`
// and the guard on it was a regex asserting that exact spelling. That guard was doing real work — it
// closed a one-token regression, `chunk(waves.flatMap(…))` back to `chunk(scopes, …)`, which is what
// scheduled the wiring scope beside the very scopes it consumes and cost a whole run — but it was
// checking a SHAPE where the invariant is a BEHAVIOUR. A regex passes on a `waves.flatMap` loop
// reading the wrong wave list, and it fails on a scheduler that is strictly better at the thing the
// regex was standing in for.
//
// So the assertion moved down a level: the scheduler is read out of the shipped file and RUN, against
// fixtures with known dependency edges and known per-leg durations, on a virtual clock. Every check
// below is a fact about a schedule that actually happened, not about how the source is written.
//
// The scheduling decision can be tested this way because it is PURE — no dispatch, no filesystem, no
// clock, no randomness. That is a property worth keeping: it is the only part of this pipeline that
// can be proved for free, and the moment it reads a clock it joins the parts that cannot.
//
// WHAT EACH CHECK IS DEFENDING, in one line each:
//   (a) the region is there at all — an absence is a failure, never a skip
//   (b) a scope never starts beside a scope it consumes           ← the run this cost
//   (c) no scope is dropped, whatever the edge data looks like
//   (d) a cyclic edge set does not hang — it is the one input that turns a scheduler silent
//   (e) the dial is a real cap AND is really reached
//   (f) a dial of 1 is the sequential lane, in order, exactly
//   (g) a dead builder is a spent attempt, and does not narrow the window afterwards
//   (h) a dropped leg is named as one, never a bare null nobody can act on
//   (i) the barrier is actually gone — measured against the loop it replaced
//   (j) the kernel's edges are used only when they agree with the kernel's waves

import { loadScheduler, runVirtual, fakeLauncher, chunkedSchedule } from "../lib/scheduler-region.mjs";

/** Build the scope list, the kernel's waves and the kernel's edge list from a spec. */
function fixture(spec, order) {
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
  return { scopes, waves, rawDeps, order: waves.flat() };
}

/** Run a schedule on the virtual clock and report everything a check might want to look at. */
const run1 = (scheduleScopes, items, edges, width, plan) => runVirtual(async (sleep, now) => {
  const f = fakeLauncher(sleep, now, plan);
  const settled = await scheduleScopes(items, edges, width, f.launch);
  return { settled, trace: f.trace, peak: f.maxConcurrent(), order: f.order() };
});

/** Every place a leg started before a leg it depends on had finished. */
function edgeViolations(trace, edges) {
  const byId = new Map(trace.map((r) => [r.scope_id, r]));
  const bad = [];
  for (const [to, froms] of edges) {
    for (const from of froms) {
      const a = byId.get(to), b = byId.get(from);
      if (a && b && b.end !== null && a.start < b.end) {
        bad.push(`${to} started at t=${a.start}, but ${from} it depends on did not end until t=${b.end}`);
      }
    }
  }
  return bad;
}

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("63. BUILD's fan-out — the schedule it actually produces, on a virtual clock");
  // =============================================================================

  // --- (a) the region is present and evaluates -------------------------------------------------
  let scopeEdges, withExclusions, releaseCeiling, scheduleScopes;
  try {
    ({ scopeEdges, withExclusions, releaseCeiling, scheduleScopes } = loadScheduler(ROOT));
    ok("the shipped workflow's scheduler region loads and defines scopeEdges + withExclusions + releaseCeiling + scheduleScopes — every check below runs the shipped bytes, not a copy");
  } catch (e) {
    fail(`the BUILD scheduler cannot be loaded out of the shipped workflow script: ${e.message}`);
    return;
  }

  // --- (b) A DEPENDENCY EDGE IS NEVER VIOLATED -------------------------------------------------
  //
  // WHAT THIS COSTS WHEN IT IS WRONG, measured on a live run. The fan-out chunked scopes by a fixed
  // width over the directory's alphabetical order, which put `cli-integration` — the scope whose own
  // contract says it replaces the placeholder entry point and routes to every command scope's module
  // — SECOND, in the first wave, beside the scopes it consumes. It burned all three attempts at 0/2
  // fixtures in round 1 and its leg died in round 2. One scheduling decision produced 19 EVAL
  // failures.
  //
  // The dependant is ALPHABETICALLY FIRST, so an implementation that merely sorts is caught, and the
  // dial is WIDER than the workload, so nothing but the release rule can be holding a scope back.
  //
  // ⟐ RUN TWICE, AND THE SECOND RUN IS THE ONE THAT NEARLY WENT MISSING. The item list the round
  // loop passes is `waves.flat()`, which is already topological — so a fixture built from it cannot
  // see whether the scheduler depends on that. It does not, and must not: a body that resolves its
  // dependencies' promises in one construction pass silently loses every edge whose dependency is
  // declared later in the list, and that failure has no diagnostic of its own — the edge just stops
  // existing. Putting the defect back proved the first run alone did not catch it, so the second run
  // hands the scheduler the RAW order, dependant first.
  {
    const spec = {
      "aaa-wiring": { ms: 10, deps: ["mmm-feature"] },
      "mmm-feature": { ms: 10, deps: ["zzz-core"] },
      "zzz-core": { ms: 10, deps: [] },
    };
    const f = fixture(spec, ["aaa-wiring", "mmm-feature", "zzz-core"]);
    const edges = scopeEdges(f.rawDeps, f.waves, f.scopes);
    const problems = [];
    for (const [how, items] of [["wave order", f.order], ["reversed item order, dependant first", f.scopes]]) {
      const r = await run1(scheduleScopes, items, edges, 8, spec);
      const bad = edgeViolations(r.result.trace, edges);
      if (bad.length) problems.push(`${how}: ${bad.join("; ")}`);
      if (r.result.trace.length !== 3) problems.push(`${how}: only ${r.result.trace.length}/3 legs ran`);
      if (r.result.settled.length !== 3) problems.push(`${how}: ${r.result.settled.length}/3 scopes settled`);
    }
    if (!problems.length) {
      ok("a scope is never started before a scope it consumes has settled — at a dial of 8, with the dependant "
        + "declared alphabetically first, and whether or not the item list happens to arrive in dependency order");
    } else {
      fail(`the BUILD scheduler released a scope early:\n    ${problems.join("\n    ")}`);
    }
  }

  // --- (c) NO SCOPE IS DROPPED, whatever the edge data looks like ------------------------------
  //
  // `wavesFrom()` falls back to a single wave whenever the grouping does not account for every scope
  // exactly once, on purpose: a scheduler that refuses to run is worse than one that runs
  // unscheduled. The same must hold one layer down — the edge list arrives across a sub-agent
  // boundary, so it can be malformed in every way a JSON array can be.
  {
    const spec = { a: { ms: 5 }, b: { ms: 5 }, c: { ms: 5 } };
    const f = fixture(spec);
    const junk = [
      ["scopes/a.md", "scopes/a.md"],                 // self-edge: an instant deadlock if honoured
      ["scopes/a.md", "scopes/nope.md"],              // names a scope that is not in this round
      ["scopes/ghost.md", "scopes/b.md"],             // dependant is not in this round either
      ["scopes/b.md"],                                // malformed row
      "not-an-array",
    ];
    const edges = scopeEdges(junk, f.waves, f.scopes);
    const r = await run1(scheduleScopes, f.order, edges, 2, spec);
    const ids = r.result.settled.map((x) => x && x.scope_id).sort();

    // And a repeated scope_id is two legs with two records, not one record reported twice. The
    // detector has to be IDENTITY, not shape or count: putting the defect back showed that keying
    // the settled list by id still produces four entries of the right length, because the fourth is
    // the FIRST leg's record handed back a second time while the fourth leg's own result is thrown
    // away. A census that only counts cannot see that; two records that are the same object can.
    const dupItems = [...f.order, f.order[0]];
    const rDup = await run1(scheduleScopes, dupItems, edges, 2, spec);
    const distinctRecords = rDup.result.settled[0] !== rDup.result.settled[rDup.result.settled.length - 1];

    const problems = [];
    if (r.result.settled.length !== 3 || JSON.stringify(ids) !== JSON.stringify(["a", "b", "c"])) {
      problems.push(`malformed edges: settled ${JSON.stringify(ids)}, expected a,b,c`);
    }
    if (rDup.result.settled.length !== 4 || rDup.result.trace.length !== 4 || !distinctRecords) {
      problems.push(`a repeated scope id produced ${rDup.result.settled.length} record(s) from ${rDup.result.trace.length} leg(s) `
        + `(expected 4 and 4), and the repeated positions ${distinctRecords ? "hold" : "DO NOT hold"} distinct records`);
    }
    if (!problems.length) {
      ok("a malformed edge list drops edges, never scopes, and a repeated scope id is two legs and two records — "
        + "every item settles exactly once, so the round's census is complete");
    } else {
      fail(`the BUILD scheduler dropped a scope:\n    ${problems.join("\n    ")}\n`
        + "    A scope missing from the settled list is missing from GATE H's census and from the ledger.");
    }
  }

  // --- (d) A CYCLIC EDGE SET DOES NOT HANG ------------------------------------------------------
  //
  // The failure mode this design newly admits, and the reason it is checked by execution. Two scopes
  // awaiting each other produce NO error, NO log line and NO artifact — the run simply stops, which
  // the list-chunking loop it replaced could not do. `scopeEdges` therefore accepts an edge set only
  // when Kahn peels every node and the levels it implies match the waves the kernel derived.
  {
    const spec = { a: { ms: 5 }, b: { ms: 5 } };
    const f = fixture(spec);
    const cyclic = [["scopes/a.md", "scopes/b.md"], ["scopes/b.md", "scopes/a.md"]];
    const edges = scopeEdges(cyclic, f.waves, f.scopes);
    let completed = false, detail = "";
    try {
      const r = await run1(scheduleScopes, f.order, edges, 2, spec);
      completed = r.result.settled.length === 2;
    } catch (e) { detail = e.message; }
    if (completed) {
      ok("a cyclic dependency edge set is refused and the round still builds every scope — a cycle costs the per-edge release, never the run");
    } else {
      fail(`a cyclic edge set stalled the BUILD schedule (${detail || "no settled result"}). A hang has no diagnostic: `
        + "the run produces no error and no artifact, and looks exactly like a slow worker.");
    }
  }

  // --- (e) THE DIAL IS A REAL CAP, AND IS REALLY REACHED ----------------------------------------
  //
  // Both halves matter and they fail in opposite directions. A cap that is exceeded spends money and
  // concurrency nobody authorised; a cap that is never reached is the fan-out that is not fanning
  // out, which is the defect the whole phase exists to remove and the one that reads as success.
  {
    const spec = Object.fromEntries("abcdefgh".split("").map((id) => [id, { ms: 10 }]));
    const f = fixture(spec);
    const edges = scopeEdges([], f.waves, f.scopes);
    const problems = [];
    for (const width of [1, 2, 3, 4, 5]) {
      const r = await run1(scheduleScopes, f.order, edges, width, spec);
      if (r.result.peak > width) problems.push(`dial ${width}: ${r.result.peak} legs ran at once`);
      if (r.result.peak < width) problems.push(`dial ${width}: never exceeded ${r.result.peak} concurrent legs over 8 independent scopes`);
    }
    // A junk dial must floor at 1 rather than becoming unbounded or zero.
    for (const junk of [0, -3, NaN, undefined]) {
      const r = await run1(scheduleScopes, f.order, edges, junk, spec);
      if (r.result.peak !== 1) problems.push(`dial ${String(junk)} produced ${r.result.peak} concurrent legs instead of flooring at 1`);
      if (r.result.settled.length !== 8) problems.push(`dial ${String(junk)} settled ${r.result.settled.length}/8 scopes`);
    }
    if (!problems.length) {
      ok("maxParallelScopes is honoured exactly at dials 1–5 over 8 independent scopes, and a junk dial floors at 1 rather than running unbounded");
    } else {
      fail(`the concurrency dial is not what it says:\n    ${problems.join("\n    ")}`);
    }
  }

  // --- (f) A DIAL OF 1 IS THE SEQUENTIAL LANE, IN ORDER, EXACTLY --------------------------------
  //
  // The mitigation the plan names for an unsafe worker archetype is "drop maxParallelScopes to 1",
  // which is only a mitigation if 1 means what it meant before. Compared against the loop this
  // replaced, run over the same workload: same dispatch order, same makespan.
  {
    const spec = {
      foundation: { ms: 20 },
      "add-todo": { ms: 30, deps: ["foundation"] },
      "complete-todo": { ms: 10, deps: ["foundation"] },
      "list-todos": { ms: 10, deps: ["foundation"] },
      "remove-todo": { ms: 10, deps: ["foundation"] },
      "cli-integration": { ms: 20, deps: ["add-todo", "complete-todo", "list-todos", "remove-todo"] },
    };
    const f = fixture(spec);
    const edges = scopeEdges(f.rawDeps, f.waves, f.scopes);
    const mine = await run1(scheduleScopes, f.order, edges, 1, spec);
    const before = await runVirtual(async (sleep, now) => {
      const fk = fakeLauncher(sleep, now, spec);
      await chunkedSchedule(f.waves, 1, fk.launch);
      return { order: fk.order() };
    });
    if (mine.result.order.join(",") === before.result.order.join(",") && mine.elapsed === before.elapsed) {
      ok(`a dial of 1 reproduces the sequential lane exactly — same dispatch order (${mine.result.order.join(" → ")}) and same makespan (${mine.elapsed})`);
    } else {
      fail("a dial of 1 no longer reproduces the sequential lane:\n"
        + `    order  before ${before.result.order.join(",")}\n    order  now    ${mine.result.order.join(",")}\n`
        + `    makespan before ${before.elapsed}, now ${mine.elapsed}`);
    }
  }

  // --- (g) A DEAD BUILDER IS A SPENT ATTEMPT, and does not narrow the window --------------------
  //
  // Killing the round over one dead leg would discard every other scope's green work. The second
  // half is the failure mode the promise-per-scope form newly admits: a leg that dies without
  // releasing its slot narrows the window permanently, and the round after it silently runs
  // narrower than the operator paid for.
  {
    const spec = {
      d1: { ms: 5, dies: true }, d2: { ms: 5, dies: true }, d3: { ms: 5, dies: true }, d4: { ms: 5, dies: true },
      a: { ms: 10 }, b: { ms: 10 }, c: { ms: 10 }, e: { ms: 10 },
    };
    const f = fixture(spec);
    const edges = scopeEdges([], f.waves, f.scopes);
    const r = await run1(scheduleScopes, f.order, edges, 4, spec);
    const failed = r.result.settled.filter((x) => x && x.__failed).length;
    const survivors = r.result.settled.filter((x) => x && x.green).length;
    if (r.result.settled.length === 8 && failed === 4 && survivors === 4 && r.result.peak === 4) {
      ok("four dead builders are four spent attempts — every scope still settles, the four survivors are still green, and the window still reaches its full width afterwards");
    } else {
      fail(`a dead builder cost more than its own attempt: settled ${r.result.settled.length}/8, failed ${failed}, `
        + `green ${survivors}, peak concurrency ${r.result.peak} (expected 8/4/4/4). A slot a dead leg never released `
        + "narrows every later round with no diagnostic.");
    }
  }

  // --- (h) A DROPPED LEG IS NAMED, never a bare null nobody can act on --------------------------
  //
  // The runtime reads a stage that returned no value as DROP THIS ITEM and leaves an empty slot in
  // the settled list — measured: `stage1 → null ⇒ stage2 ran 0/3 times, settled = [NULL, NULL, NULL]`.
  // BUILD could not dispatch a single scope for the life of a branch, and the run read exactly like
  // six genuinely hard scopes. The scheduler cannot stop the runtime dropping a leg, but it can
  // refuse to pass the hole on: an empty slot and a dead worker want different repairs.
  {
    const spec = { a: { ms: 5, drops: true }, b: { ms: 5 } };
    const f = fixture(spec);
    const edges = scopeEdges([], f.waves, f.scopes);
    const r = await run1(scheduleScopes, f.order, edges, 2, spec);
    const dropped = r.result.settled[0];
    if (r.result.settled.every((x) => x && typeof x === "object") && dropped.__failed && /dropped/i.test(dropped.__failed)) {
      ok("a leg the runtime dropped comes back as a named __failed record, never as a hole in the settled list");
    } else {
      fail(`a dropped leg reached the round loop as ${JSON.stringify(dropped)}. A null in the settled list is `
        + "indistinguishable from a scope nobody scheduled, which is how a fan-out that never dispatched read as six hard scopes.");
    }
  }

  // --- (i) THE BARRIER IS ACTUALLY GONE — measured, not asserted --------------------------------
  //
  // The reason this is a check and not a note in a report: "the new scheduler should be faster" is
  // an assertion, and a barrier can be re-introduced by an `await` in the wrong place without
  // changing a single name. Two workloads, both against the loop this replaced: one where the
  // barrier is paid (must be strictly faster) and one where it is genuine (must not be slower).
  //
  // ⟐ RUN UNDER BOTH DISPATCH MODELS. Legs measurably do NOT start together — four legs of one
  // archived wave started across 54 s of a 376 s build span — so a comparison that assumes a leg
  // begins the instant its slot opens is comparing two schedulers on a workload neither of them
  // sees. The ramped model is the one calibrated to that measurement, and it is the demanding
  // direction for the claim being made here rather than the flattering one: a barrier re-pays the
  // ramp on the far side of it, so the gap should widen, and a change that only wins under the
  // optimistic model is not a change worth making.
  {
    const paid = { s1: { ms: 50 }, b: { ms: 1 }, c: { ms: 1 }, d: { ms: 1 }, s2: { ms: 50 }, f: { ms: 1 }, g: { ms: 1 }, h: { ms: 1 } };
    const genuine = { parse: { ms: 20 }, rules: { ms: 20 }, cli: { ms: 20, deps: ["parse", "rules"] } };
    const rows = [];
    for (const ramp of [0, 5]) {
      for (const [name, spec, strict] of [["a slow leg in every group", paid, true], ["a genuine dependency", genuine, false]]) {
        const f = fixture(spec);
        const edges = scopeEdges(f.rawDeps, f.waves, f.scopes);
        const mine = await runVirtual(async (sleep, now) => {
          const fk = fakeLauncher(sleep, now, spec, { ramp });
          await scheduleScopes(f.order, edges, 4, fk.launch);
          return {};
        });
        const before = await runVirtual(async (sleep, now) => {
          const fk = fakeLauncher(sleep, now, spec, { ramp });
          await chunkedSchedule(f.waves, 4, fk.launch);
          return {};
        });
        rows.push({ name: `${name} (ramp ${ramp})`, strict, mine: mine.elapsed, before: before.elapsed });
      }
    }
    const regressions = rows.filter((r) => (r.strict ? r.mine >= r.before : r.mine > r.before));
    if (!regressions.length) {
      ok("the window beats the wave-stepped loop wherever a barrier was being paid and never loses where the dependency "
        + `is genuine — ${rows.map((r) => `${r.before}→${r.mine}`).join(", ")} ticks across both dispatch models`);
    } else {
      fail("a barrier is back in BUILD's fan-out:\n    "
        + regressions.map((r) => `${r.name}: ${r.before} ticks before, ${r.mine} now`).join("\n    "));
    }
  }

  // --- (k) TWO SCOPES THAT MAY WRITE THE SAME PATH NEVER BUILD AT THE SAME TIME -----------------
  //
  // WHAT THIS COSTS WHEN IT IS WRONG, measured: three concurrent writers to one declared-shared
  // entry point lost work in TWENTY OF TWENTY trials. And there is nothing to notice it by — the
  // surviving copy passes its fixtures, the sandbox guard permitted every write (the path is in
  // every one of those orders' shared block, which is exactly what `shared_substrate` means), and
  // the disjointness lint passed because the overlap was correctly declared. Three layers, each
  // right on its own; the join is the defect, and the join only exists here, because "these two are
  // running right now" is a fact no lint can hold.
  //
  // Four properties, and the third and fourth are what stop the cure being worse:
  //   1. an excluded pair never overlaps in time
  //   2. scopes that do NOT collide still fan out — an exclusion is a pair, never a global lock
  //   3. an exclusion mixed with a real dependency edge does not deadlock (it is oriented by build
  //      position, so the whole edge set keeps pointing backwards and cannot cycle)
  //   4. absent or malformed pairs mean today's scheduling, not a refusal to run
  {
    const spec = {
      foundation: { ms: 10 },
      "add-todo": { ms: 20, deps: ["foundation"] },
      "list-todos": { ms: 20, deps: ["foundation"] },
      "cli-integration": { ms: 20, deps: ["foundation"] },
    };
    const f = fixture(spec);
    // All three wave-2 scopes write the entry point; none of them depends on another.
    const pairs = [
      ["scopes/add-todo.md", "scopes/cli-integration.md"],
      ["scopes/list-todos.md", "scopes/cli-integration.md"],
      ["scopes/add-todo.md", "scopes/list-todos.md"],
    ];
    const base = scopeEdges(f.rawDeps, f.waves, f.scopes);
    const { edges, added } = withExclusions(base, pairs, f.order);
    const r = await run1(scheduleScopes, f.order, edges, 4, spec);

    const at = new Map(r.result.trace.map((t) => [t.scope_id, t]));
    const overlaps = [];
    for (const [a, b] of pairs.map((p) => p.map((x) => x.split("/").pop().replace(".md", "")))) {
      const A = at.get(a), B = at.get(b);
      if (A && B && A.start < B.end && B.start < A.end) overlaps.push(`${a} [${A.start},${A.end}] overlaps ${b} [${B.start},${B.end}]`);
    }

    // Non-collidng scopes must still fan out, and the exclusion must not have become a global lock.
    const wide = { a: { ms: 10 }, b: { ms: 10 }, c: { ms: 10 }, d: { ms: 10 } };
    const fw = fixture(wide);
    const one = withExclusions(scopeEdges([], fw.waves, fw.scopes), [["scopes/a.md", "scopes/b.md"]], fw.order);
    const rw = await run1(scheduleScopes, fw.order, one.edges, 4, wide);

    // Absent / malformed pairs: today's scheduling, and the round still completes.
    const none = withExclusions(scopeEdges([], fw.waves, fw.scopes), undefined, fw.order);
    const junk = withExclusions(scopeEdges([], fw.waves, fw.scopes), [["scopes/ghost.md", "scopes/a.md"], ["scopes/a.md"], 7], fw.order);
    const rn = await run1(scheduleScopes, fw.order, none.edges, 4, wide);

    // ⟐ A PAIR WRITTEN DEPENDANT-FIRST, BETWEEN TWO SCOPES THAT ALSO HAVE A DEPENDENCY EDGE. This is
    // the deadlock, and it is the sub-check that nearly went missing: the fixture above happens to
    // list every pair in build order, so it passes against an implementation that ignores build
    // position entirely — putting that defect back is the only reason this exists. An exclusion
    // oriented by the pair's own order points FORWARD, meets the dependency edge pointing back, and
    // the two scopes wait for each other with no error, no log line and no artifact.
    const chainSpec = { core: { ms: 10 }, wire: { ms: 10, deps: ["core"] } };
    const fc = fixture(chainSpec);
    const reversed = withExclusions(scopeEdges(fc.rawDeps, fc.waves, fc.scopes),
      [["scopes/wire.md", "scopes/core.md"]], fc.order);
    let chainOk = false, chainWhy = "";
    try {
      const rc = await run1(scheduleScopes, fc.order, reversed.edges, 4, chainSpec);
      chainOk = rc.result.settled.length === 2 && !edgeViolations(rc.result.trace, reversed.edges).length;
      if (!chainOk) chainWhy = `${rc.result.settled.length}/2 settled`;
    } catch (e) { chainWhy = e.message; }

    const problems = [];
    if (added !== 3) problems.push(`${added} exclusion edge(s) landed, expected 3`);
    if (!chainOk) problems.push(`a pair written dependant-first deadlocked or lost a scope (${chainWhy}) — exclusions must be `
      + "oriented by build position, so the whole edge set keeps pointing backwards and cannot cycle");
    if (reversed.added !== 0) problems.push(`an exclusion between two scopes that already have a dependency edge added `
      + `${reversed.added} redundant edge(s); the pair is already ordered`);
    if (overlaps.length) problems.push(`excluded scopes ran concurrently:\n      ${overlaps.join("\n      ")}`);
    if (r.result.settled.length !== 4) problems.push(`${r.result.settled.length}/4 scopes settled under exclusions`);
    if (rw.result.peak !== 3) problems.push(`one excluded pair among four scopes dropped peak concurrency to ${rw.result.peak}, expected 3 — an exclusion is a pair, not a global lock`);
    if (none.added !== 0 || junk.added !== 0) problems.push(`absent/malformed pairs produced ${none.added}/${junk.added} edges, expected 0/0`);
    if (rn.result.peak !== 4) problems.push(`with no exclusions the window reached ${rn.result.peak}, expected the full dial of 4`);
    if (!problems.length) {
      ok(`two scopes that may write the same declared-shared path are never open at once (3 pair(s) serialised, ${r.elapsed} ticks, `
        + "no overlap), scopes that do not collide still fan out to the full dial, and absent or malformed pairs schedule exactly as before");
    } else {
      fail(`the co-scheduling exclusion is not enforced:\n    ${problems.join("\n    ")}\n`
        + "    Concurrent writers to one declared-shared path lose each other's work in every trial, and every fixture,\n"
        + "    lint and hook stays green over the copy that survived.");
    }
  }

  // --- (l) THE REPORTED CEILING IS THE PEAK THAT ACTUALLY HAPPENS --------------------------------
  //
  // The run prints how many scopes CAN be open at once before it dispatches anything, because that
  // number and the dial are different facts and the difference is attributable: a peak below the
  // ceiling is a dispatch or runtime limit, a ceiling below the dial is the scope cut. A reported
  // ceiling that the schedule then misses would be worse than not reporting one — a number in a log
  // that nothing checks is the shape of every measurement this repo has had to throw away.
  //
  // Asserted in both directions on three graphs, because the interesting one is the pathological
  // case the coordinator asked about: a six-scope feature whose entry point sits in every scope's
  // substrate has a ceiling of ONE, and that is the honest answer rather than a bug. The alternative
  // is six legs writing one file, which lost work in twenty of twenty trials — a shorter makespan
  // over a feature that was not built.
  {
    const cases = [
      ["nothing shared, four independent scopes", { a: { ms: 10 }, b: { ms: 10 }, c: { ms: 10 }, d: { ms: 10 } }, [], 4],
      ["a chain — nothing may ever overlap", { a: { ms: 10 }, b: { ms: 10, deps: ["a"] }, c: { ms: 10, deps: ["b"] } }, [], 1],
      ["every scope writes the entry point (a clique)", {
        foundation: { ms: 10 },
        "add-todo": { ms: 10, deps: ["foundation"] },
        "list-todos": { ms: 10, deps: ["foundation"] },
        "cli-integration": { ms: 10, deps: ["add-todo", "list-todos"] },
      }, "all", 1],
    ];
    const problems = [];
    for (const [name, spec, pairSpec, want] of cases) {
      const f = fixture(spec);
      const ids = Object.keys(spec);
      const pairs = pairSpec === "all"
        ? ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [`scopes/${a}.md`, `scopes/${b}.md`]))
        : pairSpec;
      const { edges } = withExclusions(scopeEdges(f.rawDeps, f.waves, f.scopes), pairs, f.order);
      const ceiling = releaseCeiling(edges, f.order);
      const r = await run1(scheduleScopes, f.order, edges, 8, spec);
      if (ceiling !== want) problems.push(`${name}: ceiling reported ${ceiling}, expected ${want}`);
      if (r.result.peak > ceiling) problems.push(`${name}: ${r.result.peak} legs ran at once against a reported ceiling of ${ceiling}`);
      if (r.result.peak < ceiling) problems.push(`${name}: the schedule never reached its own reported ceiling (${r.result.peak} of ${ceiling}) at an unbounded dial`);
      if (r.result.settled.length !== ids.length) problems.push(`${name}: ${r.result.settled.length}/${ids.length} settled`);
    }
    if (!problems.length) {
      ok("the concurrency ceiling the run reports before dispatching is exactly the peak the schedule reaches — 4 when nothing "
        + "is shared, 1 for a chain, and 1 when every scope writes the entry point, which is a scope-cutting fact and not a bug");
    } else {
      fail(`the reported concurrency ceiling is not what happens:\n    ${problems.join("\n    ")}`);
    }
  }

  // --- (j) THE KERNEL'S EDGES ARE USED ONLY WHEN THEY AGREE WITH THE KERNEL'S WAVES -------------
  //
  // `scope_waves` and `scope_deps` are two projections of one graph the kernel parsed once, and they
  // arrive over a sub-agent boundary that re-reports JSON field by field. So each validates the
  // other: an edge list that does not re-derive the wave order has lost or invented an edge in
  // transit, and the safe reading of a lost edge is the wave it came from — never a scope released
  // early on data that has already been shown to be wrong.
  {
    const spec = { slow: { ms: 100 }, fast: { ms: 10 }, x: { ms: 10, deps: ["fast"] } };
    const f = fixture(spec);
    const faithful = scopeEdges(f.rawDeps, f.waves, f.scopes);
    const rFaithful = await run1(scheduleScopes, f.order, faithful, 4, spec);
    const xStart = rFaithful.result.trace.find((t) => t.scope_id === "x").start;

    // The same round with the ONE edge that matters dropped in transit. It re-levels differently, so
    // the wave rung takes over and `x` waits for the whole first wave, exactly as it used to.
    const mangled = scopeEdges([["scopes/x.md", "scopes/nope.md"]], f.waves, f.scopes);
    const rMangled = await run1(scheduleScopes, f.order, mangled, 4, spec);
    const xStartFallback = rMangled.result.trace.find((t) => t.scope_id === "x").start;

    // And the cross-check must not be a hair trigger. ONE junk row beside a faithful edge list is
    // dropped on its own; discarding the whole list over it would trade a real win for a typo, and
    // "the edge list had a self-edge in it" is not evidence that the other edges are wrong.
    const withJunk = scopeEdges([...f.rawDeps, ["scopes/x.md", "scopes/x.md"], ["scopes/ghost.md", "scopes/fast.md"]], f.waves, f.scopes);
    const rJunk = await run1(scheduleScopes, f.order, withJunk, 4, spec);
    const xStartJunk = rJunk.result.trace.find((t) => t.scope_id === "x").start;

    if (xStart === 10 && xStartFallback === 100 && xStartJunk === 10 && !edgeViolations(rMangled.result.trace, mangled).length) {
      ok("a faithful edge list releases a scope when its own dependency lands (t=10, not t=100); a single junk row is dropped "
        + "on its own; and an edge list that does not re-derive the wave order falls back to wave release rather than "
        + "trusting data already shown to be wrong");
    } else {
      fail(`the edge/wave cross-check is not doing its job: with faithful edges x started at t=${xStart} (expected 10), `
        + `with one junk row alongside them at t=${xStartJunk} (expected 10 — a typo must not cost the whole edge list), `
        + `with a mangled edge list at t=${xStartFallback} (expected the wave release, 100)`);
    }
  }
}
