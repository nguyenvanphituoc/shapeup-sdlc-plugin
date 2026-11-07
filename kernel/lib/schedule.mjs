// BUILD SCHEDULE — which scopes may open now, as a pure function of the contracts and the round.
//
// WHAT THIS DECIDES. Three separable things, kept separate on purpose:
//
//     WAVES ORDER the scopes.   EDGES RELEASE them.   THE DIAL CAPS them.
//
// Fusing the three into "chunk the list by the dial" cost wall-clock twice over: the dial became a
// quantum (a wave of six at a dial of four idled three workers until the slowest of four landed),
// and a wave said when a scope was definitely safe to start, never when it became safe. Everything
// the earlier loops bought with a failed run survives, and each rule is named where it holds:
// a scope never starts beside a scope it consumes; no scope is ever dropped; the dial is honoured
// exactly; two scopes that may write one declared-shared path never open together.
//
// WHY IT LIVES IN THE KERNEL. The decision is pure — no dispatch, no clock, no randomness — so it is
// the one part of the build loop a fixture can execute instead of reasoning about. The loop asks the
// kernel's `probe next` which scopes are releasable and dispatches exactly those; nothing about the
// schedule is held in a session's memory, so a killed session resumes into the same schedule.
//
// EVERY INPUT DEGRADES THE SAME WAY, AND IN ONE DIRECTION: an absent or unusable edge list means
// release per wave, absent exclusions mean none. A scheduler that refuses to run is worse than one
// that runs unscheduled; what must never happen is the opposite reading — when the pairs are there
// the edge is enforced, because a run that quietly loses work is worse than both.

/**
 * A scope id from a contract path or a bare id.
 * @param {string} p - `…/SC-1.md`, `SC-1.json` or `SC-1`.
 * @returns {string} The id.
 */
export const idOf = (p) => String(p).split("/").pop().replace(/\.(md|json)$/, "");

/**
 * Group scopes by the kernel's dependency waves, or fall back to one wave.
 *
 * Every scope must appear exactly once, or the grouping is not trustworthy and one wave is the safe
 * answer: a scheduler that drops a scope is worse than an unscheduled one.
 *
 * @param {Array} raw - `probe resume`'s `scope_waves`: arrays of contract paths.
 * @param {Array<{scope_id:string, path:string}>} list - Every scope in the round.
 * @returns {Array<Array<{scope_id:string, path:string}>>} Waves of scope objects.
 */
export function wavesFrom(raw, list) {
  const byId = new Map(list.map((s) => [s.scope_id, s]));
  const w = (raw || []).map((g) => g.map((p) => byId.get(idOf(p))).filter(Boolean)).filter((g) => g.length);
  return w.length && w.reduce((a, g) => a + g.length, 0) === list.length ? w : [list];
}

/**
 * The dependency relation the fan-out releases on, as `scope_id → the scope_ids it waits for`.
 *
 * Three rungs, each a strict non-regression on the next. The edge list is used only when it
 * re-levels to the SAME waves: both fields are projections of one graph the kernel parsed once, so
 * each validates the other, and an edge dropped or invented in transit lands on the wave rung rather
 * than releasing a scope early — the one direction this must never fail in.
 *
 * @param {*} rawDeps - `scope_deps`: `[dependant, dependency]` path pairs.
 * @param {Array[]} waves - Validated dependency waves, arrays of scope objects.
 * @param {Array} list - Every scope in the round.
 * @param {function(string):void} [log] - Receives the one line a rejected edge list earns.
 * @returns {Map<string,Set<string>>} One entry per scope; an empty set means "ready immediately".
 */
export function scopeEdges(rawDeps, waves, list, log = () => {}) {
  const known = new Set(list.map((s) => s.scope_id));
  const blank = () => new Map(list.map((s) => [s.scope_id, new Set()]));

  // Kahn. A CYCLE IS THE ONE INPUT THAT TURNS A SCHEDULER INTO A HANG rather than a failure: two
  // scopes awaiting each other produce no error and no artifact. An edge set is used only when every
  // node peels.
  const levelsOf = (m) => {
    const done = new Set(), out = [];
    for (;;) {
      const ready = list.filter((s) => !done.has(s.scope_id) && [...m.get(s.scope_id)].every((d) => done.has(d)));
      if (!ready.length) break;
      out.push(ready.map((s) => s.scope_id).sort());
      for (const s of ready) done.add(s.scope_id);
    }
    return done.size === list.length ? out : undefined;
  };
  const shape = (levels) => (levels ? JSON.stringify(levels) : "");

  if (Array.isArray(rawDeps) && rawDeps.length) {
    const m = blank();
    let edges = 0;
    for (const pair of rawDeps) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const to = idOf(pair[0]), from = idOf(pair[1]);
      if (to === from || !known.has(to) || !known.has(from)) continue;
      m.get(to).add(from);
      edges++;
    }
    const want = shape(waves.map((w) => w.map((s) => s.scope_id).sort()));
    if (edges && shape(levelsOf(m)) === want) return m;
    log(`the dependency edge list does not re-derive the wave order (${edges} usable edge(s)); ` +
        `releasing per wave instead`);
  }

  // WAVE RUNG. "Everything in wave i waits for everything in wave i-1": acyclic by construction. A
  // single wave yields no edges, which is the fully unscheduled fan-out.
  const m = blank();
  for (let i = 1; i < waves.length; i++) {
    for (const to of waves[i]) for (const from of waves[i - 1]) m.get(to.scope_id).add(from.scope_id);
  }
  return m;
}

/**
 * Forbid two scopes that may write the same path from building at the same time.
 *
 * `shared_substrate` is the declared escape hatch from the disjointness rule: the spec lint passes an
 * overlap both contracts declare, and the sandbox guard permits that path to every live order naming
 * it. Both are individually correct and the join is wrong — concurrent writers to one shared entry
 * point lose each other's work with every check green. The only place "these two are running right
 * now" exists is the schedule.
 *
 * An exclusion is not a dependency: each pair is oriented by BUILD POSITION, later waits for
 * earlier, which keeps the whole set pointing backwards and so acyclic.
 *
 * @param {Map<string,Set<string>>} edges - Release edges so far; mutated and returned.
 * @param {*} rawPairs - `scope_exclusions`: unordered path pairs.
 * @param {Array} order - The build order; position decides which side of a pair waits.
 * @returns {{edges: Map<string,Set<string>>, added: number}} The composed set and how many landed.
 */
export function withExclusions(edges, rawPairs, order) {
  if (!Array.isArray(rawPairs) || !rawPairs.length) return { edges, added: 0 };
  const at = new Map(order.map((s, i) => [s.scope_id, i]));
  let added = 0;
  for (const pair of rawPairs) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const a = idOf(pair[0]), b = idOf(pair[1]);
    if (a === b || !at.has(a) || !at.has(b)) continue;
    const [first, later] = at.get(a) < at.get(b) ? [a, b] : [b, a];
    if (edges.get(later)?.has(first)) continue;                 // already ordered by a real edge
    edges.get(later).add(first);
    added++;
  }
  return { edges, added };
}

/**
 * The widest set of scopes this release graph can have open at one moment.
 *
 * The dial says how many legs are paid for; this says how many the constraints permit, and they are
 * not the same number. A feature whose entry point sits in five scopes' substrate has a ceiling of
 * one however wide the dial is opened — a scope-cutting fact, decided at the board review.
 *
 * @param {Map<string,Set<string>>} edges - The composed release set.
 * @param {Array} items - The scopes in the round.
 * @returns {number} Widest simultaneously-admissible set; 1 when nothing may overlap.
 */
export function releaseCeiling(edges, items) {
  const done = new Set();
  let widest = 1;
  for (;;) {
    const ready = items.filter((s) => !done.has(s.scope_id) && [...(edges.get(s.scope_id) || [])].every((d) => done.has(d)));
    if (!ready.length) break;
    widest = Math.max(widest, ready.length);
    for (const s of ready) done.add(s.scope_id);
  }
  return widest;
}

/**
 * The whole schedule for a set of scopes: order, release edges and the ceiling they permit.
 *
 * @param {object} f - Resume facts: `scope_files`, `scope_waves`, `scope_deps`, `scope_exclusions`.
 * @param {number} dial - `--parallel-scopes`.
 * @param {function(string):void} [log] - Diagnostics.
 * @returns {{scopes:Array, waves:Array, order:Array, edges:Map<string,Set<string>>, added:number, ceiling:number}}
 */
export function scheduleFor(f, dial, log = () => {}) {
  const scopes = (f.scope_files || []).filter((s) => s?.scope_id && s?.path);
  const waves = wavesFrom(f.scope_waves, scopes);
  const order = waves.flat();
  const composed = withExclusions(scopeEdges(f.scope_deps, waves, scopes, log), f.scope_exclusions, order);
  const width = Math.max(1, Number(dial ?? 4) || 1);
  return {
    scopes, waves, order, edges: composed.edges, added: composed.added,
    ceiling: Math.min(releaseCeiling(composed.edges, order), width),
  };
}

/**
 * The scopes that may open right now.
 *
 * Release is on SETTLED, not on green: gating on green is strictly stronger and costs more than it
 * buys — a dependency that fails would starve every dependant of any attempt, and those scopes would
 * leave the round's census entirely. What must never happen is a scope building concurrently with a
 * scope it consumes, and the dependency wait forbids exactly that.
 *
 * @param {{order:Array, edges:Map<string,Set<string>>}} sched - From {@link scheduleFor}.
 * @param {{settled:Set<string>, inFlight:Set<string>}} state - Scope ids by state.
 * @param {number} dial - Concurrency cap, counting scopes already in flight.
 * @returns {Array<{scope_id:string, path:string}>} In build order; empty when nothing may open.
 */
export function releasable(sched, state, dial) {
  const width = Math.max(1, Number(dial ?? 4) || 1);
  let free = width - state.inFlight.size;
  const out = [];
  for (const s of sched.order) {
    if (free <= 0) break;
    if (state.settled.has(s.scope_id) || state.inFlight.has(s.scope_id)) continue;
    const deps = [...(sched.edges.get(s.scope_id) || [])];
    if (deps.every((d) => state.settled.has(d))) { out.push(s); free--; }
  }
  return out;
}
