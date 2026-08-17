# LANE B — lessons for the other lanes

What the scheduler change means for LANE A's instrument, LANE C's isolation and corruption probe,
and the merge. Numbers here come from `tools/sched-sim.mjs`, which executes the shipped scheduler
region against synthetic workloads on a virtual clock. Re-run it; do not quote it from memory.

---

## 1 · The blunt finding first: D3's ≥30% is not reachable by scheduling alone

Measured, both schedulers, same workloads, same fake legs (units are one leg's wall-clock). Two
dispatch models, because **legs measurably do not start together** — LANE A found four legs of one
archived wave starting across 54 s of a 376 s build span, so a comparison assuming instantaneous
start is comparing two schedulers on a workload neither of them sees. Model B charges each dispatch
5 units on a serialised path, which is roughly that ratio.

| workload | dial | crit | chunked A | window A | saved A | chunked B | window B | **saved B** |
|---|---|---|---|---|---|---|---|---|
| 6 independent, even legs | 4 | 10 | 20 | 20 | 0% | 50 | 40 | **20%** |
| 6 independent, one 10× leg | 4 | 100 | 110 | 100 | 9.1% | 125 | 105 | **16%** |
| chain a→b→c→d | 4 | 40 | 40 | 40 | 0% | 60 | 60 | 0% |
| 3 scopes, one releases early | 4 | 100 | 110 | 100 | 9.1% | 120 | 105 | 12.5% |
| todo-cli shape (1→4→1) | 4 | 70 | 70 | 70 | **0%** | 85 | 85 | **0%** |
| todo-cli shape | 2 | 70 | 80 | 70 | 12.5% | 105 | 100 | 4.8% |
| **phase3-envlint shape (2→1)** | 4 | 40 | 40 | 40 | **0%** | 55 | 55 | **0%** |
| a leg dies | 4 | 10 | 20 | 20 | 0% | 50 | 40 | 20% |
| 8 independent, one 4× leg | 4 | 40 | 50 | 40 | 20% | 75 | 50 | **33.3%** |
| 8 independent, a slow leg per group | 4 | 50 | 100 | 51 | **49%** | 110 | 75 | 31.8% |
| todo-cli shape | 1 | 70 | 100 | 100 | 0% | 130 | 130 | 0% |

**The ramp widens the gap rather than closing it**, and the reason is mechanical: a barrier re-pays
the launch ramp on the far side of it, and the window pays it once. A row that was 0% under the
optimistic model is 20% under the measured one. This was the strongest argument *against* building
the scheduler, and testing it turned it into an argument for.

The other half of model B is a finding nobody owns yet: **peak concurrency collapses from 4 to 2–3
for both schedulers.** A serialised dispatch path starves the window before the dial ever binds.
That is the same shape as the archive's *"max 2 ran simultaneously, not 3"* and LANE A's 54-second
ramp — see §5.

Read the table as three facts:

1. **The window never loses.** On every workload it is ≤ the chunked loop, and it equals the critical
   path (or the capacity floor) everywhere the critical path is reachable.
2. **The win is entirely a function of duration variance inside a wave, and of wave width against the
   dial.** Zero variance ⇒ zero win. That is not a defect in the scheduler; it is what the barrier
   was costing, and on a uniform workload the barrier costs nothing.
3. **On the sample project the win is exactly zero.** `phase3-envlint` is `{parse, rules} → cli` at a
   dial of 4: nothing chunks, and `cli` genuinely consumes both. Anyone measuring D3 on that feature
   alone will measure the *rest* of Phase 3, not the scheduler.

**So D3 cannot be closed by this lane, and should not be claimed by it.** LANE A's reframe is right
and sharper than mine was: the plan's Phase 2 says *"keep the sequential scope loop for THIS phase"*,
so D3's baseline is **sequential**, and the 30% was bought by fan-out existing at all — which
shipped. This scheduler competes for the residual: LANE A measured that residual as **≤ 14.5%
inter-wave idle (54.7 s of a 376.3 s build span, and an upper bound because leg ends are floors)**,
plus the intra-wave tail their trace also shows (`complete-todo` 145.6 s beside `list-todos` 96.5 s
in the same group — 49 s of tail inside one wave).

The one number that *is* worth chasing: real scope legs are high-variance by construction. An attempt
ratchet that stops at attempt 1 for one scope and burns three for another is a 3× spread inside one
wave, which is the "one slow leg per group" row — 32–49%. LANE A's trace confirms the spread exists
(1.5× inside a single wave, on the one clean fan-out in the archive).

### Why the chunk barrier is unobserved in the archive, and why that is about to change

LANE A is right that no archived run shows the chunk barrier costing anything: no feature produced a
wave wider than the dial, so `chunk(w, 4)` always returned one group. Both halves of that have the
same cause. Every archived run used the default dial of 4 **because the dial was unreachable** —
`maxParallelScopes` was read by the workflow and declared nowhere, so no operator could set it
(bulletin #1). The barrier could not be observed because the only configuration that exposes it could
not be requested.

That changed this week: `--parallel-scopes N` is now wired. The plan's own mitigation for an unsafe
worker archetype is *"drop `maxParallelScopes` to 1 for that archetype"*, and any value below a
wave's width re-creates the barrier — the todo-cli shape at a dial of 2 is the row above. **An
unobserved cost in an archive of runs that could not reach the configuration is not evidence the cost
is not there.**

---

## 2 · What LANE A's instrument must measure to see this at all

The current evidence for D1 is *"3/3 legs green"*, which counted greens and never measured overlap.
An instrument that only sums durations, or only counts legs, cannot distinguish the two schedulers on
nine of the eleven workloads above. Four requirements, in priority order:

1. **A leg-completion record.** The brief already names the gap: orders give a real `compiled_at`,
   trials give a landmark near the end, and there is *no* leg-completion timestamp anywhere. Every
   number in this document depends on `(start, end)` per leg. Without an end, concurrency is not
   observable and neither is makespan attribution. Result-file mtimes are not a substitute.
2. **Peak concurrency, sampled — not inferred from overlaps of two.** Report `max simultaneous build
   legs` per round and the histogram of it, because the failure mode is *"the dial says 4 and the
   window never exceeds 2"*, which looks identical to a fast round. The scheduler now caps at
   `maxParallelScopes` exactly (guarded); if the *observed* peak is below the dial, the ceiling is
   the runtime's, not this scheduler's, and that is a finding worth having.
3. **Idle-slot time.** `Σ (width − inflight) dt` over the round is the barrier's direct signature. The
   chunked loop's idle time is large and lumpy; the window's is only the tail. This is the single
   number that separates "the fan-out is wide" from "the fan-out is wide on average".
4. **Per-leg duration variance.** Two rounds with the same makespan and different variance have very
   different headroom. Publish the spread, not the mean — the mean is what makes a 49% win look like
   a 0% win.
5. **Compare the observed peak against the run's own reported CEILING, not against the dial.** The
   workflow now logs `at most N scope(s) can be open at once` before it dispatches anything. That
   splits a concurrency shortfall into two causes with different repairs, which no single number can:
   **peak < ceiling ⇒ a dispatch or runtime limit; ceiling < dial ⇒ the scope cut.** An instrument
   that only knows the dial reports one symptom for two diseases.

And one anti-requirement: **do not derive makespan from the round's start and end alone.** That
measures the round, which includes the gate, the graph query and EVAL. The scheduler owns the
interval between the first leg's start and the last leg's end, and only that interval can be
attributed to it.

---

## 2b · The safety edge, and what it costs a five-way shared entry point

The scheduler also refuses to co-schedule two scopes that may write the same path. Measured, same
harness, `excl` = exclusion edges added:

| workload | dial | crit | chunked | window | saved | peak(c) | peak(w) | excl |
|---|---|---|---|---|---|---|---|---|
| **five-way shared entry point** (all 6 scopes write it) | 4 | 70 | 70 | **100** | **−42.9%** | 4 | **1** | 7 |
| same feature, entry point owned by ONE scope | 4 | 70 | 70 | 70 | 0% | 4 | **4** | 1 |
| phase3-envlint with a shared entry point | 4 | 40 | 40 | 40 | 0% | 2 | **2** | 0 |

Ramped model: −52.9% and peak 1 for the five-way case; 0% and peak 3 for the other two.

**So the coordinator's worry is real and I am not going to argue it away: a naive shared-path rule
serialises a five-way shared entry point to peak concurrency 1 and costs 43–53% wall-clock. It fails
D1 on that feature.** My judgement, in writing:

**Accept it. Record D1 as conditional on the scope cut rather than weakening the edge.**

Three reasons, in order of weight.

1. **The faster alternative is not faster — it is wrong.** The 70-tick concurrent run loses work in
   twenty of twenty trials. A makespan comparison that ignores whether the feature got built is the
   same instrument failure as the probe that *"only counted greens — it never measured overlap"*, one
   metric over. There is no scheduler that makes six concurrent writers to one file safe; the choice
   is not speed vs safety, it is a slower build vs a build that has to be redone.
2. **D1 is satisfiable exactly when the scope cut is sound, which is what a scope contract is for.**
   Disjoint `allowed_file_substrate` is already a HARD lint at the board review. A feature whose scopes
   all write one file has no independent subtasks, and *"a 3-scope feature builds with ≥2 scopes
   concurrently"* is a claim about a feature cut into three independent scopes. **The sample project
   satisfies D1 with the edge on** (peak 2, zero cost) — that is the row that matters for convergence.
   So does the well-cut todo-cli feature (peak 4, zero cost). Only the badly-cut variant fails.
3. **The cost is now stated before anything is spent, and attributable.** The run computes the
   **concurrency ceiling** — the widest simultaneously-admissible set of its own release graph — and
   logs it against the dial at BUILD-order time. `at most 1 scope(s) can be open at once (the window
   is 4; the substrate the contracts declared is what caps it, not the dial)`. Found there it costs a
   line and a re-cut at L1b; found later it is a slow round indistinguishable from slow workers.

**What I recommend the merge does with it, and it is a gate change I do not own:** carry the ceiling
into GATE L1b's context, beside the scope list. The PO then decides *re-cut or accept a serial build*
at the one gate where re-cutting is cheap. Keep `SHARED-CONCURRENT` advisory — a red would block
features that are perfectly correct built serially — but stop letting the concurrency consequence be
invisible until BUILD.

**Why I rejected bulletin #5's cheaper door** (enforce the shared-path edge inside `scopeWaves`):

- **It does not work with this loop, at all.** Under a sliding window `scope_waves` is only an ORDER,
  not a barrier — nothing is enforced by which level a scope sits in. Splitting a wave would change
  the sequence and nothing else. **The cheap door and the sliding window are alternatives, not
  complements: if the merge decides against the scheduler, take the cheap door instead.**
- **Where it does work (the chunked loop) it over-serialises.** A wave is a barrier for *every* member,
  so separating two colliding scopes also separates every scope that was riding beside them. Two
  colliding scopes in a wave of four become two waves of two — peak 2 with a barrier between them,
  where a pairwise edge gives peak 3.
- **It makes a documented invariant false.** `scope_waves` says it is derived from `tasks` and
  `depends_on` and therefore *"cannot disagree with the board"*. A substrate collision is not a
  dependency; smuggling one in makes the field disagree with the board by design, and the next reader
  of that sentence is entitled to believe it.

## 3 · What LANE C's corruption probe must now survive

The exposure changed in kind, not only in degree.

- **Before:** peak concurrency measured at **2**, transiently, with a hard barrier between groups —
  so the number of simultaneous writers dropped to zero at every group boundary, and every boundary
  was a natural quiesce point where a half-written board could settle.
- **After:** `maxParallelScopes` writers **sustained across the whole round**, with **no quiesce point
  at all**. The window refills the instant any leg settles, so there is no moment in a round where
  the number of in-flight legs is guaranteed to be zero until the round ends.

Concretely, the probe should be re-aimed at four things:

1. **Sustained width, not transient overlap.** Assert the peak reaches the dial and *stays* there for
   most of the round. A probe that passes on a run whose peak was 2 has not tested the new scheduler.
2. **The board/ledger reducer under a rolling write set.** Every group boundary used to serialise the
   reduces by accident. It no longer does: a leg can be ingesting while three others are mid-attempt,
   for the entire round. The single-writer invariant is now doing all of the work, unassisted.
3. **A dependant starting while its siblings are still writing.** This is genuinely new. Under wave
   release, everything in wave *i* had finished writing before anything in wave *i+1* started. Under
   edge release, `x` can start while `slow` — in the same wave — is mid-write. Any code that assumed
   "a later wave sees a quiet tree" is now wrong. **`sandbox-guard` reading every live order is what
   makes this safe; that assumption is now load-bearing in a way it was not before, and it is worth
   a direct probe rather than an inference.**
4. **The `active-scope` pointer question, settled by this.** Whatever else it is repurposed for, it
   can never again be read as "the scope currently building" — there are now up to `dial` of those
   at once and no ordering between them. If anything still reads it that way, it is a defect, and it
   would have been one under the chunked loop too; the window just makes it certain instead of likely.

---

## 4 · The recommendation, decomposed — what to merge and what not to

The change is three separable pieces with very different risk and very different prizes. They should
be judged separately, and the merge can take the first two without the third.

| Piece | New information needed | Prize | Risk | Recommend |
|---|---|---|---|---|
| **P0 — the safety edge** (no two writers to one path at once) | `scope_exclusions` | correctness: three concurrent writers lost work 20/20 | serialises a badly-cut feature to peak 1 (measured −43%) | **merge, and it is the piece I would keep if you take only one.** It is the only one that changes an outcome rather than a duration |
| **P1 — sliding window** (drop the chunk barrier) | none | 0% today; 5–33% the moment a dial narrower than a wave is set, which is now requestable | one semaphore; `maxParallelScopes: 1` proven identical to sequential | **merge** |
| **P2 — dependency release** (edges, not levels) | `scope_deps` over the sub-agent boundary | LANE A's ≤14.5% inter-wave idle | a lost edge releases a scope early — the class that cost a run | **merge**, because the failure direction is closed: an edge list that does not re-derive `scope_waves` is discarded in favour of wave release |
| **P3 — duration-aware ordering** (longest-job-first) | per-leg durations, which LANE A now produces | the residual: the window lands at 51 against a critical path of 50 on the worst workload — one leg's worth | ordering by an estimate | **do not build now.** Revisit once the leg-duration distribution is real. The design keeps *order* separable from *release*, so it stays a one-line change |

P0 needs P1's machinery only for its *mechanism* (release edges), not for its *decision*. If the merge
wants the safety edge without the scheduler, bulletin #5's door is the right one — see §2b for why the
two cannot both be taken.

I am not recommending "change it because I built it". The specific thing that moved me is §1's model
B: the strongest argument against this scheduler was LANE A's launch-ramp measurement, and putting
that measurement into the simulation made the window win *more*, on every workload where it won at
all, and lose on none.

What I would drop without argument if the merge wants a smaller diff: P2. P1 alone is ~40 lines,
needs no new field, needs nothing from `domain.schema.json`, and carries the guards with it.

## 5 · The thing neither of us owns, and it may be bigger than both

**A serialised dispatch path, not the scheduler, may be what caps concurrency.**

Three independent observations line up:

- RESULT-v2: *"max 2 ran simultaneously, not 3 … two started 198 ms apart and overlapped, the third
  began after the second finished."*
- LANE A: four legs of one wave started at +0.0 s, +0.2 s, +25.9 s, +54.1 s — a 54-second ramp.
- This lane's model B: charging 5 units per dispatch on a serialised path drops **both** schedulers'
  peak concurrency from 4 to 2–3, without changing either scheduler.

If dispatch is serialised, then `maxParallelScopes` is not the binding constraint, no scheduler can
reach the width the operator paid for, and every wall-clock number in Phase 3 is bounded by
something none of the three lanes has touched. Two cheap discriminating tests, neither of which I can
run without spending a model:

1. **Does the ramp survive the call-shape change?** This lane replaced one `pipeline(group, …)` with
   N concurrent `pipeline([scope], …)` calls. If the ramp is unchanged, the ceiling is the runtime's
   agent-spawn path. If it shrinks, `pipeline()`'s own item admission was part of it. Same feature,
   same dial — one comparison, one number.
2. **Is the ramp a function of the dial?** Run the same feature at `--parallel-scopes 2` and `4`. If
   the time-to-N-running is roughly constant per leg regardless of N, it is serialised.

Until one of those is answered, **nobody should quote a fan-out width from a dial setting.** The dial
is now honoured exactly by the scheduler — guarded — and that is a different claim from the legs
actually running side by side.

## 5b · The confirm stage: my diff moves it, and the fix that is coming becomes a WRITER

I did not touch the leg-never-ingested defect, as instructed. Two things the owner of that fix needs
from me before rebasing.

**1 · The confirm stage's enclosing structure changed, so the rebase is not a clean apply.** The
stage body is byte-identical in logic but it now lives inside a per-scope launcher rather than a
group pipeline, and its parameter is renamed:

- was: `pipeline(group, check, build, confirm)` inside `for (const group of waves.flatMap(chunk(…)))`,
  stage signature `async (res, scope) => …`
- now: `pipeline([scope], check, build, confirm)` inside the `launch` callback passed to
  `scheduleScopes(buildOrder, scopeReleases, maxParallelScopes, async (scope) => { … })`, stage
  signature `async (res, s) => …` (the outer parameter took the name `scope`, so the stage's own
  parameter is `s`). The settle loop indexes `buildOrder[i]` instead of `group[i]`.

Nothing else about the stage moved: it still asks `probe t0`, still returns `res` or a `green:false`
copy of it, and still never returns a bare value the runtime would read as a drop.

**2 · The fix turns confirm into a writer, and that has a scheduling consequence.** "Ingest the valid
result itself, loudly" makes the confirm stage a writer of shared state. Under the loop this replaces,
confirms could overlap only within one chunk. Under a sliding window **confirms overlap across the
whole round** — up to `maxParallelScopes` of them, with no quiesce point. Two implications:

- The single-writer invariant is doing all the work, for a call site that did not previously make
  writes. If `reduce ingest` is not safe against a concurrent `reduce ingest` for a *different* scope,
  the fan-out will find that out, and the symptom will be a board that disagrees with reality — the
  same symptom as the defect being fixed, which makes it the worst possible failure to introduce here.
- If it is not safe, the remedy already exists and needs no new mechanism: emit an exclusion pair for
  it. `withExclusions` takes unordered pairs and orients them by build position; a whole-round
  ingest lock is expressible as pairing every scope with every other, and the *ceiling* line will then
  print `at most 1` so the cost is visible rather than mysterious. I would not do that speculatively —
  measure first.

**3 · My scheduler does not assume a completed leg has ingested.** It branches on `green` and
`__failed` only, and its own `__failed` records name their cause (`the runtime dropped this leg`,
`<id>: worker died`). Whatever confirm decides, the scheduler reports one record per leg and never
infers anything from a leg's own account of its steps.

**And the instrument point is worth keeping.** `legs.jsonl` — built for D3's concurrency measurement —
is what made this visible, because the row is written *by* ingest, so its absence is proof the writer
never ran. That is the same property my §2 asks LANE A for: **a record whose absence is evidence, not
a gap.** Everything else in the record set (T0 verdict, receipt, WorkResult) was present and correct
for a leg that had not closed.

## 6 · Cross-lane facts worth having

- **`probe resume` gained `scope_deps`** — `[dependant, dependency]` resolved-path pairs, derived from
  the same parse that produces `scope_waves` (one shared `scopeDepGraph`, so the two cannot disagree).
  It is additive: a consumer that ignores it gets the wave release points, which is the previous
  behaviour. It is **not yet declared in `$defs/ResumeState`** — the merge owner holds that file.
- **The two fields validate each other.** The workflow uses `scope_deps` only when Kahn-levelling it
  reproduces `scope_waves`. Both cross a sub-agent boundary that re-reports JSON field by field; an
  edge lost in transit would release a scope early, which is precisely the failure that cost a run,
  so the safe reading of a disagreement is the wave.
- **`maxParallelScopes` as declared by the merge — `integer, minimum 1, default 4` — is exactly
  right for this design; no change requested.** Under a sliding window a
  "ready-set width" and a "global cap" are the same number; splitting them would let an operator ask
  for a state the scheduler cannot express. `1` is still the spelling of "sequential", and is now
  *provably* the sequential lane: same dispatch order, same makespan, asserted against the loop it
  replaced.
- **A guard that pins a source spelling will eventually fail the improvement it was protecting.**
  Check (m) in `16-workflows.mjs` asserted the literal `for (const group of waves.flatMap(…))`. It
  went red on a scheduler that is strictly better at the exact thing it existed to protect. It is now
  two guards: a data-flow assertion that the kernel's order and edges reach the scheduler, and an
  executed assertion that the scheduler honours them. Neither is sufficient alone — the first cannot
  see a scheduler that ignores its arguments, the second cannot see a call site that passes the wrong
  ones.
- **The scheduling decision is pure, and keeping it pure is what makes it free to test.** No clock, no
  randomness, no dispatch. `Promise.race` over in-flight legs was rejected for the same reason
  `Date.now()` is banned in a workflow script: it makes the schedule a function of real time, so a
  relaunch reschedules differently. If a future change needs "wait for whichever finishes first", it
  needs a different justification than "it is slightly tighter".
