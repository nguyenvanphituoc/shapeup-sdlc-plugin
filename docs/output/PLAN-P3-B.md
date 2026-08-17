# LANE B — the schedule is the throughput

Phase 3's question, restated: *is the fan-out as wide as it claims, and does it stay wide?*

## 1 · What Phase 3 actually bought, and what it did not

The plan's Phase 3 line is three clauses. Measured against the tree:

| Plan clause | State |
|---|---|
| `pipeline(scopes, …)` instead of `for (const scope of scopes)` | shipped (`shapeup-run.js:785`) |
| `isolation:'worktree'` on build legs | deviated (RESULT-v2 #5); LANE C owns the isolation question |
| `args.maxParallelScopes` (default 4) | shipped as a *read* (`shapeup-run.js:106`), undeclared everywhere else — see §7 |

And the done-when: **D1** ≥2 concurrent, **D2** uncorrupted, **D3** wall-clock −30% vs the Phase-2 baseline.

D3 is the one this lane exists for, and it is the one the current loop spends. The BUILD fan-out is:

```js
for (const group of waves.flatMap((w) => chunk(w, maxParallelScopes))) {
  const settled = await pipeline(group, check, build, confirm);
  …
}
```

That is **two barriers stacked**, and only one of them was ever intended:

1. **The chunk barrier.** `chunk()` splits a wave wider than the dial into consecutive groups, and the
   `for … await` waits for the *slowest member of a group* before the next group starts. A wave of 6
   with a dial of 4 runs 4, idles three workers while the slowest of the four finishes, then runs 2.
   Nothing about the scopes required that; it falls out of `chunk` being a list operation rather than
   a scheduling one. The dial was supposed to be a *cap*; `chunk` makes it a *quantum*.

2. **The wave barrier.** Even at a dial wide enough to never chunk, a scope waits for its whole wave.
   `cli-integration` waits for the slowest command scope even when it consumes only `foundation`,
   which went green minutes earlier. The kernel derives *levels* (`scopeWaves`, Kahn one level per
   iteration) and the level is a lossy projection of the DAG: it says *when it is definitely safe to
   start*, never *when it became safe*.

Both barriers are worst exactly where the fan-out is supposed to pay — a wide feature with uneven
scope durations, which is every real feature.

There is a third fact worth naming because it bounds the honest claim: **the round barrier is real
and stays.** Every scope must settle before EVAL, because EVAL runs exactly once per round
(architectural invariant). No scheduler removes that. What a scheduler can do is make the round's
makespan equal its *critical path* instead of its *sum of level maxima*, and that is the whole of the
target.

## 2 · What the current loop bought with blood, and must survive

These are walls, not preferences. Each is a defect this repo paid for:

- **No stage returns a bare `null`.** The runtime reads a null stage result as *drop this item and
  skip its remaining stages* — measured (`stage1 → null ⇒ stage2 ran 0/3`). BUILD could not dispatch
  a single scope for the life of the branch, and the failure was indistinguishable from six hard
  scopes.
- **No scope starts beside a scope it consumes.** One scheduling decision produced 19 EVAL failures.
- **No scope is dropped.** `wavesFrom()` falls back to a single wave whenever the grouping does not
  account for every scope exactly once. *A scheduler that refuses to run is worse than one that runs
  unscheduled.*
- **A dead builder is a spent attempt, not a dead run.** Killing the round would discard every other
  scope's green work.
- **`maxParallelScopes` is the cost dial and is honoured.** Concurrency is a cost question before it
  is a speed one.

## 3 · The scheduler I chose

**A dependency-released sliding window over a ready-set**, with the item order still taken from the
kernel's waves.

> **Waves order the items. Edges release them. The dial caps them.**

Three separable concerns, previously fused into one `flatMap(chunk)`:

| Concern | Old | New |
|---|---|---|
| *In what order do scopes get considered?* | wave order, then alphabetical within a wave | unchanged — `waves.flat()` |
| *When may a scope start?* | when its whole wave has settled | when **its own dependencies** have settled |
| *How many at once?* | a fixed-width group, refilled only at a barrier | a window of `maxParallelScopes` that refills the instant any leg finishes |

### Shape

```js
scheduleScopes(items, edges, width, launch) -> Promise<Array<result>>   // one entry per item, in input order
```

- `items` — the scopes, in wave-flattened order.
- `edges` — `Map<scope_id, Set<scope_id>>`, "this scope waits for these".
- `width` — `maxParallelScopes`.
- `launch(scope)` — the injection point. **Production:** `pipeline([scope], check, build, confirm)`
  and take `[0]`. **Test:** a fake with a controllable per-leg duration and a controllable death.

### Mechanism, and why it is written this way

Every item gets a promise built in two phases (all promises created *before* any body runs, so a
dependency that appears later in the list is still resolvable). Each body:

1. `await Promise.all(its dependency promises)` — **holding no slot.**
2. acquire one of `width` slots from a FIFO promise-queue semaphore;
3. `launch`, in `try/catch/finally`, so a throwing leg becomes a `__failed` record and always
   releases its slot;
4. release.

The dependency wait happens **before** the slot acquire. That single ordering is what makes deadlock
structurally impossible: a waiting scope never occupies capacity, so the window can never be filled
by scopes that are all waiting on each other's slots.

No `Promise.race`, no timer, no clock. `Promise.race` would have given a marginally tighter schedule
and is disqualified for the same reason `Date.now()` is: its resolution order is a function of real
time, and a workflow script that replays must schedule the same way twice. The eager-promise +
FIFO-semaphore formulation reaches the same release points deterministically.

### Where the edges come from

The kernel already parses the DAG — `scopeWaves` builds a `deps` map and then throws it away, keeping
only the levels. This lane makes it emit the map as well: `probe resume` gains **`scope_deps`**, a
flat edge list of resolved scope paths, derived from the exact same parse (one shared
`scopeDepGraph`, so waves and edges cannot disagree).

Consumption is a fallback chain, each rung a strict non-regression on the next:

1. **`scope_deps`**, if present, well-formed, referring only to known scopes, and **acyclic**.
2. else **edges derived from `scope_waves`** — "everything in wave *i* waits for everything in wave
   *i−1*". This reproduces today's release points *exactly*, so an absent or unusable edge list costs
   the wave-barrier win and nothing else; the chunk-barrier win survives.
3. else **no edges** — every scope ready, the dial is the only limit. Which is `wavesFrom`'s existing
   one-wave fallback, unchanged.

The kernel's wave data therefore stays load-bearing at every rung, which keeps the regression check
(m) was written for — *"a scheduler that ignores the wave data and fans out flat"* — a real failure.

### One deliberate semantic choice, stated rather than buried

**Release is on *settled*, not on *green*.** The brief says "never start a scope before a scope it
depends on is green". Gating literally on *green* is strictly stronger and I rejected it: a
dependency that fails would then starve every dependant of any attempt at all, and those scopes would
leave the round's census entirely — a new outcome class (`skipped`) that GATE H, the hill projection
and the ledger have no reading for. Today's wave loop releases on completion, not on success, and
matching it keeps the failure semantics identical while still forbidding the thing that actually cost
the run: **a scope building *concurrently with* a scope it consumes.** That is the cli-integration
lesson exactly, and it is what the guard asserts.

## 4 · Alternatives considered and rejected

| Alternative | Why not |
|---|---|
| Widen the dial and keep chunking | The dial is a cost knob. Buying wall-clock with money is not a scheduler. |
| One `pipeline()` over every scope, gating inside stage 1 | A stage that blocks holds a runtime slot. Ready scopes would queue behind waiting ones, and `maxParallelScopes` would become unenforceable — the runtime's own cap would be the real limit, which is the thing RESULT-v2 could not explain ("max 2 ran simultaneously, not 3"). |
| Work-stealing lanes racing in-flight legs (`Promise.race`) | Same class as `Date.now()`: schedule becomes a function of wall time, so a replay reschedules differently. Buys ~nothing over the eager-promise form. |
| Critical-path / longest-job-first ordering | Needs a per-scope duration estimate. RESULT-v2: *"No number about v2.0's cost or wall-clock appears anywhere in this repo."* Ordering by a guessed duration is ordering by a guess. Revisit when LANE A's instrument produces real per-leg durations — the design keeps *order* separable from *release*, so it is a one-line change then. Measured cost of not doing it: on the worst workload the window lands at 51 against a critical path of 50 — one leg's worth. |
| Over-subscribe the window while legs are still spawning | LANE A measured a 54 s launch ramp, so a slot held during dispatch is a slot doing nothing. Admitting extra legs to compensate would recover it — and would break the one thing the dial promises, which is a bound on spend. The ramp is a dispatch problem and wants a dispatch fix; see `LESSONS-P3-B.md` §5. |
| Speculative start with rollback | That **is** the cli-integration defect, with extra steps. |
| Release on green (see §3) | Starves dependants of a failed dependency; invents an outcome class nothing downstream reads. |
| Leave `chunk()` in for small waves | Two schedulers is two schedulers. |

## 5 · Failure modes this design newly admits, and what forbids each

The chunked loop was *dumb*, and dumb has virtues. Here is every one it had that I am giving up, and
the specific thing that replaces it. Each line is a guard in `tests/structural/23-scheduler.mjs`,
verified by re-introducing the defect and watching the suite go red.

| New failure mode | Why the old loop was immune | What forbids it |
|---|---|---|
| **Deadlock on a cyclic edge set** — A awaits B awaits A, forever. A hang, not a failure: no timeout, no log line, no artifact. | `chunk` over a list cannot cycle; the kernel's Kahn already breaks cycles into one flat wave. | `scopeEdges` accepts an edge set only if Kahn peels **every** node; otherwise it falls to wave-derived edges (acyclic by construction). Guard: a cyclic `scope_deps` fixture must still complete and must still build every scope. |
| **A dependant resolves a dependency promise that does not exist yet** (single-pass map construction), silently dropping the edge. | No promise graph existed. | Two-phase construction: every entry is in the map before any body runs. Guard fixture puts the dependency **later** in the item list than its dependant. |
| **Slot leak** — a launch that throws never releases, and the window narrows permanently. | No slots. | `try/catch/finally`. Guard: a workload whose first N legs all throw must still reach full width afterwards. |
| **Unhandled rejection** from a stored promise nobody awaits | No stored promises. | `launch` is wrapped so the scheduler's promises never reject; `Promise.all` awaits every one of them anyway. |
| **Unbounded concurrency on a junk dial** (`0`, `NaN`, `-1`) | `chunk(xs, 0)` would loop forever — arguably worse, but loudly. | `Math.max(1, …)` at the arg site *and* inside the scheduler. Guard asserts the floor. |
| **Order drift at the sequential setting** — `maxParallelScopes: 1` no longer reproducing the sequential lane. | Trivially true by construction. | FIFO semaphore + wave-flattened item order ⇒ width 1 is exactly `waves.flat()`. Guard asserts byte-identical ordering against the chunked reference at width 1. |
| **A scope dropped by a malformed edge** | `wavesFrom`'s exactly-once check. | Edges are filtered; **items never are**. The return is `items.map(…)`, so one entry per item is structural. Guard asserts it under garbage edges. |
| **Higher sustained concurrency than anything ever probed** — the old loop's measured peak was 2. | It was slow. | Nothing in this lane. This is a real, deliberate exposure and it is **LANE C's**: the corruption probe must now survive `maxParallelScopes` writers sustained across a whole round, not a transient overlap of two. Recorded in `LESSONS-P3-B.md`. |

## 6 · How it is proved, without spending a model

The scheduling decision is pure, so it is testable without dispatching anything.

- The scheduler lives in the shipped `shapeup-run.js` between two marker comments (it cannot be
  `import`ed — a Workflow script has no module resolution). The test **extracts that exact source
  region and evaluates it**, so what is under test is the shipped bytes, not a copy. A missing marker
  or a missing binding is a loud failure, never a skip.
- `tools/sched-sim.mjs` runs both schedulers — mine and a verbatim copy of the chunked loop — over
  the same synthetic workloads on a **virtual clock** (discrete-event, `setImmediate` microtask
  drain, no real sleeping), and reports **makespan and max concurrency** for each. Adversarial cases:
  one slow leg among fast ones, a wave wider than the dial, a dependency chain, a leg that dies, a
  dial of 1, and the two real shapes (todo-cli's six scopes, phase3-envlint's three).
- The comparison runs under **two dispatch models**: legs starting the instant a slot opens, and legs
  taking a turn on a serialised dispatch path. The second is the one calibrated to a measured fact —
  four legs of one archived wave started across 54 s of a 376 s build span — and it is the demanding
  direction for the claim, because a change that only wins under the optimistic model is not worth
  making.
- The numbers are what get reported. Where the win is zero, that gets reported too — and it is zero
  on the sample project.

## 7 · What I need from the coordinator (answering bulletin #1)

The dial stays **one** knob. Declared shape for `$defs/RunArgs`:

```json
"maxParallelScopes": {
  "type": "integer",
  "minimum": 1,
  "default": 4,
  "description": "How many scopes may BUILD at once. A cap on concurrent worker legs, not a group size: the window refills the instant any leg settles. 1 restores the strictly sequential lane, in the kernel's dependency order."
}
```

No second knob. Under the chunked loop a "ready-set width" and a "global cap" would have been two
different things; under a sliding window they are the same number, and splitting them would let an
operator ask for a state the scheduler cannot express.

`maxParallelScopes: 1` remains the correct spelling of "sequential", and is now *stronger* than it
was: it is byte-identical in ordering to the sequential lane, which the suite asserts.

Also needed, and mine to ask rather than to write, since `domain.schema.json` is yours in this merge:
`$defs/ResumeState` gains **`scope_deps`** (exact block in the report). It is additive — every
consumer that ignores it gets the wave-derived edges, which are today's release points.

## 8 · Order of work

1. Kernel: extract `scopeDepGraph` out of `scopeWaves`; add `scopeDeps`; emit `scope_deps`.
2. Workflow: `scopeEdges` + `scheduleScopes` in a marked region; BUILD loop consumes them; delete
   `chunk()` (now dead).
3. `tools/sched-sim.mjs`: virtual clock, both schedulers, the workloads above.
4. `tests/structural/23-scheduler.mjs`: the guards, each verified by re-introducing its defect.
5. `docs/output/LESSONS-P3-B.md`: what LANE A must measure, what LANE C must now survive.
