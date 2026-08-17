// Load the BUILD scheduler OUT OF THE SHIPPED WORKFLOW SCRIPT, so a fixture can execute the exact
// bytes that run in production.
//
// WHY IT HAS TO BE DONE THIS WAY. A Workflow script has no module resolution — no `import`, no
// `require`, `args` arrives as a runtime global — so the scheduler cannot live in a file the suite
// imports and the script imports too. The alternatives were both worse than this one:
//
//   - a second copy under kernel/ that the tests exercise: two implementations, one tested. The
//     copy passes forever while the shipped one drifts, which is the exact shape of the defect that
//     let a 418-line duplicate of the attempt loop read as shipped code.
//   - assert the scheduler's SHAPE with a regex: that is what the check this replaces did, and a
//     regex cannot tell a correct schedule from a plausible-looking one.
//
// So the region between the two markers is read off disk and evaluated. `log` is injected because
// the runtime provides it as a global; nothing else in the region touches the outside world — the
// scheduling decision is pure by construction, which is what makes this possible at all.
//
// AN ABSENCE IS REPORTED, NEVER SKIPPED. A missing file, a missing marker, or a missing binding
// throws. A loader that returns "nothing to check" on a file it could not find is a green row that
// means the opposite of what it reads.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const REGION_START = "// ---- SCHEDULER REGION START";
export const REGION_END = "// ---- SCHEDULER REGION END";
export const WORKFLOW = "skills/tech-lead/workflows/shapeup-run.js";

/**
 * Read and evaluate the shipped scheduler region.
 *
 * @param {string} ROOT - Repository root.
 * @param {object} [opts] - Options.
 * @param {function(string):void} [opts.log] - Stand-in for the runtime's `log` global.
 * @param {string} [opts.source] - Override the source text (used to re-introduce a defect and
 *   confirm the guard actually catches it).
 * @returns {{scopeEdges: Function, withExclusions: Function, scheduleScopes: Function,
 *   source: string, lines: number}}
 * @throws {Error} When the file, either marker, or either binding is absent.
 */
export function loadScheduler(ROOT, opts = {}) {
  const src = opts.source ?? readFileSync(join(ROOT, WORKFLOW), "utf8");
  const a = src.indexOf(REGION_START);
  const b = src.indexOf(REGION_END);
  if (a === -1 || b === -1 || b < a) {
    throw new Error(`${WORKFLOW} carries no delimited scheduler region (${REGION_START} … ${REGION_END}); `
      + "the guards below execute that region, so its absence is a failure, not a skip");
  }
  const region = src.slice(a, b);
  const log = opts.log || (() => {});
  // eslint-disable-next-line no-new-func -- the region is repo source, read from disk, not input.
  const factory = new Function("log", `${region}\nreturn { scopeEdges, withExclusions, releaseCeiling, scheduleScopes };`);
  const bound = factory(log);
  for (const name of ["scopeEdges", "withExclusions", "releaseCeiling", "scheduleScopes"]) {
    if (typeof bound[name] !== "function") throw new Error(`the scheduler region defines no ${name}()`);
  }
  return { ...bound, source: region, lines: region.split("\n").length };
}

/**
 * A discrete-event virtual clock.
 *
 * Real timers would make the measurement flaky and slow; a virtual clock makes the same schedule
 * reproducible to the tick. `sleep(d)` registers a wake at `now + d`; the pump drains the microtask
 * queue (one `setImmediate` hop runs after every pending microtask), then advances to the earliest
 * wake and fires EVERY timer due at that instant, so two legs finishing together do finish together.
 *
 * @param {function(function(number):Promise<void>, function():number):Promise<*>} main - Receives
 *   `(sleep, now)` and does the scheduling work.
 * @returns {Promise<{result:*, elapsed:number}>} The main's value and the virtual makespan.
 * @throws {Error} If work remains with no timer pending — a real deadlock, reported as one.
 */
export async function runVirtual(main) {
  let now = 0, seq = 0, finished = false, value, failure;
  const timers = [];
  const sleep = (d) => new Promise((r) => { timers.push({ at: now + Number(d || 0), seq: seq++, wake: r }); });
  main(sleep, () => now).then((v) => { value = v; finished = true; }, (e) => { failure = e; finished = true; });

  for (let guard = 0; !finished; guard++) {
    await new Promise((r) => { setImmediate(r); });
    if (finished) break;
    if (!timers.length) {
      throw new Error(`the schedule deadlocked at t=${now}: work is outstanding and no leg is running. `
        + "A cyclic release set does this, and it produces no error of its own — which is why it is checked.");
    }
    if (guard > 100000) throw new Error("virtual clock did not converge");
    timers.sort((x, y) => x.at - y.at || x.seq - y.seq);
    now = Math.max(now, timers[0].at);
    while (timers.length && timers[0].at <= now) timers.shift().wake();
  }
  if (failure) throw failure;
  return { result: value, elapsed: now };
}

/**
 * A fake `launch` with controllable per-leg durations, deaths and dropped legs, plus the
 * instrumentation the comparison needs.
 *
 * `ramp` models a measured fact rather than a hypothesis: legs in one dispatched group do NOT start
 * together. On an archived run, four legs of one wave started 0.0 s, 0.2 s, 25.9 s and 54.1 s in —
 * a launch ramp a fifth as long as that wave's whole span. So a leg here first takes a turn on a
 * SERIALISED dispatch path costing `ramp` ticks, holding its slot while it does, and only then runs.
 * A comparison that assumes instantaneous start overstates every scheduler equally, and understates
 * how much a barrier costs, because a barrier re-pays the ramp on the far side of it.
 *
 * @param {function(number):Promise<void>} sleep - The virtual clock's sleep.
 * @param {function():number} now - The virtual clock's reader.
 * @param {Object<string,{ms:number, dies?:boolean, drops?:boolean}>} plan - Per-scope behaviour.
 * @param {{ramp?:number}} [opts] - Serialised per-dispatch cost.
 * @returns {{launch:Function, trace:Array, maxConcurrent:function():number, order:function():string[]}}
 */
export function fakeLauncher(sleep, now, plan, opts = {}) {
  const trace = [];
  let inflight = 0, peak = 0;
  const ramp = Number(opts.ramp || 0);
  let dispatch = Promise.resolve();
  const launch = async (scope) => {
    const spec = plan[scope.scope_id] || { ms: 1 };
    if (ramp > 0) {
      const mine = dispatch.then(() => sleep(ramp));
      dispatch = mine;
      await mine;
    }
    inflight++;
    peak = Math.max(peak, inflight);
    const row = { scope_id: scope.scope_id, start: now(), end: null, concurrent: inflight };
    trace.push(row);
    try {
      await sleep(spec.ms);
      row.end = now();
      if (spec.dies) throw new Error(`${scope.scope_id}: worker died`);
      if (spec.drops) return undefined;         // the runtime dropped the item
      return { scope_id: scope.scope_id, green: spec.green !== false };
    } finally {
      inflight--;
    }
  };
  return {
    launch,
    trace,
    maxConcurrent: () => peak,
    order: () => trace.map((r) => r.scope_id),
  };
}

/**
 * The scheduler this one replaces, verbatim in behaviour: `waves.flatMap((w) => chunk(w, width))`
 * with an `await` per group. Kept HERE, never in the shipped file, because its only remaining job is
 * to be the number the new one is compared against.
 *
 * @param {Array[]} waves - Waves of scope objects.
 * @param {number} width - The dial.
 * @param {function(object):Promise<object>} launch - Dispatcher.
 * @returns {Promise<object[]>} Settled records, in wave-flattened order.
 */
export async function chunkedSchedule(waves, width, launch) {
  const chunk = (xs, size) => {
    const out = [];
    for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
    return out;
  };
  const settled = [];
  for (const group of waves.flatMap((w) => chunk(w, Math.max(1, width)))) {
    // `pipeline()` settles the whole group before the loop continues — the barrier under test.
    const done = await Promise.all(group.map((s) => launch(s).catch((e) => ({ __failed: String(e && e.message) }))));
    settled.push(...done);
  }
  return settled;
}
