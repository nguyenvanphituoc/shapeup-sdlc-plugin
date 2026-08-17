# LESSONS — Phase 3, Lane A (the instrument)

Everything below is derived from committed records by `harness probe concurrency`, re-derivable by
anyone, and costs nothing to check. No live run was spent.

---

## 1 · The dispatch receipt is a START, not a completion — and it changes what you can claim

`receipts/dispatch.jsonl` looks like a completion record and is not one. `PostToolUse` on a `Skill`
call fires when the skill **resolves**; the sub-agent's work happens afterwards. Measured across
every archived run, the gap between an order's `compiled_at` and its receipt is:

```
1.8 1.8 1.8 2.0 2.0 2.1 2.1 2.2 2.2 2.2 2.3 2.3 2.4 2.5 2.6 4.6 4.8 5.6
7.4 7.5 7.6 13.7 16.4 19.4 21.6 25.8 27.9 28.1 46.8   (seconds)
```

A `task-executor` leg does not finish in 1.8 s. **Anyone who reads a receipt `at` as "the leg
finished" is off by the entire duration of the leg.**

## 2 · `run_id` does not separate launches. Two other things do not separate what you think either

- **One `run_id` spans every relaunch.** The key is derived from `receipt.json`, and a resumed run
  reads the same receipt. `headless-shipped` holds **four launches under one key**, 17:18 → 03:35.
  A "run span" over that is 10.3 hours of mostly a closed laptop.
- **`run-args.json` is rewritten per launch and does not bound the run either.** In
  `headless-shipped` it says `startedAt: 02:45:04Z` while that run's round-1 build receipts are at
  `02:13`. Do not use it as a time boundary.
- **`orders/<id>.json` is overwritten on relaunch.** The same order's earliest receipt sits up to
  **9.4 hours before** the `compiled_at` the file now carries. Any join from a receipt to an order
  file is a join to a different dispatch's compile.

Consequence for anything that measures: **snapshot, never point.** The leg row I added copies
`compiled_at` as a value for exactly this reason.

## 3 · Results for LANE B (scheduler)

**The archive already tells you what the current scheduler does, and it is measured, not modelled.**
`harness probe concurrency --run-root <trace> --round N` reproduces all of this.

| run | round | max concurrent (lower bound) | legs with a usable interval |
|---|---|---|---|
| `headless-final` (alphabet chunking) | 1 | **2** | 6 of 16 |
| `headless-final` | 2 | **3** | 4 of 5 |
| `headless-shipped` (dependency waves) | 1 | **4** | 6 of 6 |
| `headless-shipped` | 2 | **4** | 6 of 24 |
| `interactive-shipped` (2-scope feature) | 1 | **2** | 2 of 2 |
| `run9` | 1 / 2 | **4** / **4** | 6 of 12 / 6 of 8 |

Read the right-hand column before the left one. `headless-final` r1's "2" is over **6 of 16** legs
and is not evidence the alphabet chunker was narrow — ten of its legs left no end at all.
`headless-shipped` r1's "4" is over **6 of 6** and is solid.

**The three things I would want you to know:**

1. **`headless-shipped` round 1 is the only clean fan-out in the archive, and it reached the full
   dial width of 4.** The chunk barrier was not the binding constraint there — the wave was exactly
   4 wide and all four ran together. If you are arguing chunk-barrier versus sliding window, the
   archive does not yet contain a case where the barrier demonstrably cost concurrency *within* a
   wave. It does contain the cost *between* waves — see 2.

2. **Inter-wave idle was at most 54.7 s of a 376.3 s build span — 14.5%.** Derived from the report's
   own `waves_observed`:

   ```
   wave 1  foundation                                            02:13:47.140 → 02:15:24.868
     gap 15.7 s
   wave 2  add-todo + complete-todo + list-todos + remove-todo    02:15:40.587 → 02:18:14.616
     gap 38.9 s
   wave 3  cli-integration-test                                   02:18:53.555 → 02:20:03.486
   ```

   These are **upper** bounds on the idle: leg ends are floors, so the true gaps are smaller. That
   is the honest size of the prize a sliding window competes for on this feature — and it is
   smaller than the 30% D3 target on its own, so a window has to beat the barrier on something else
   as well (probably tail latency inside a wave: `complete-todo` at 145.6 s against `list-todos` at
   96.5 s in the same wave).

3. **A `pipeline()` group does not start together.** Wave 2's four legs started at 02:15:40.587,
   02:15:40.761, 02:16:06.443 and 02:16:34.692 — a **54-second ramp** for one dispatch group. If
   your scheduler's model assumes simultaneous launch, it is wrong by that much. The ramp is a
   fifth of the whole wave's span here.

**On the dial (bulletin #1):** the instrument reports `dial: {max_parallel_scopes, source}` and
**no archived run declares it** — every one reads `source: "default (…)"`. Whatever name you settle
on, the instrument reads `run-args.json`'s `maxParallelScopes`; if you rename it, tell me and it is
a one-line change. **You cannot run the sequential arm of the D3 comparison until this dial is
reachable**, which makes it the critical path for the only unproven criterion.

## 4 · Results for LANE C (isolation and the corruption probe)

**Your probe now has an interval to assert against, not just an outcome.** `legs.jsonl` +
`receipts/dispatch.jsonl` give every leg `[started_at, ended_at]`, so a corruption probe can assert
something much stronger than "the board is consistent afterwards":

> the board/ledger check was performed **while at least two legs were open**.

Without that, a green corruption probe is satisfied by a run that never actually overlapped — the
same defect shape as the D1 claim that counted greens. `probe concurrency --round N` gives you
`launches[].max_concurrent` with a `bound`; assert `>= 2` **and** `bound === "exact"` before you
believe the probe exercised concurrency at all.

Two more things from the archive that bear on isolation:

- **`bin/todo.js` sits in five scopes' substrate** in the `headless-final` feature (`shared` block
  in `orders/foundation-r1-a1.json`). The measured wave-2 overlap of 4 means four legs were open
  while a shared entry point was writable by more than one of them. If `isolation: 'worktree'` is
  reinstated, that is the concrete case to reason about — and RESULT-v2 deviation #5's reason for
  dropping it stands: a fresh worktree does not carry the gitignored `.shapeup/` state every leg
  reads *and writes*, and `legs.jsonl` is now one more file in that set. A worktree that does not
  share `.shapeup/` will silently lose every leg's completion record, which would put the
  instrument back to the pre-Phase-3 state without any error.
- **`reduce ingest` takes a per-run lock** (`.shapeup/<slug>/.ingest.lock`, `mkdir`-based, 30 s
  stale break). My leg append happens **outside** that lock, on purpose — a single `O_APPEND` line.
  If your probe forces high concurrency, the lock is the thing to stress; the leg ledger is not a
  read-modify-write and should not be a contention point. Worth confirming rather than assuming.

## 5 · The rule that keeps producing findings

> A predicate that an absence can satisfy must report that absence in the same value.

Three fresh instances found while building this:

- `max_concurrent: 1` over a record set with four starts and one end. The archive contains this for
  real: `headless-attempt2` dispatched **8 build legs and wrote 0 T0 artifacts**. Any instrument
  that reported a number there would be reporting the absence as a measurement.
- **`sum/span` over truncated legs is not a speedup and can be less than 1.** Measured 0.90 on
  `headless-shipped` round 2, a round that demonstrably ran four scopes at once. Truncation
  shortens the numerator once per leg and the denominator once. The instrument refuses rather than
  approximating.
- **A pairing window keyed by the wrong field silently invents duration.** My first version windowed
  a leg by "the next dispatch of the same *order id*", and one archived leg that had actually died
  came back with a **17-minute** duration by claiming a T0 artifact a later dispatch of the same
  scope wrote under a different attempt number. Keyed by scope+round it is correct. The wrong
  version produced entirely plausible numbers.

## 6 · What I could not measure, and what would fix it

- **D3 has no baseline and none is derivable.** Every archived run used the fan-out scheduler.
  Phase 2's recorded baseline is structural — counts and inventories, not a run.
  `traces/phase2-criterion1/CONCURRENCY-BASELINE.json`'s `d3` block states this, names the run that
  would produce one (same feature, `maxParallelScopes` 1 vs 4, everything else held, comparing
  BUILD span only), and carries no number.
- **Cost is not derivable at all.** No archived run root contains an agent-call journal, so there
  is no `cost_usd` row to aggregate. Anyone who wants the cost half of the plan's item 6 has to
  capture it during a live run; nothing retrospective will produce it.
- **Every archived leg is a lower bound**, because `legs.jsonl` did not exist when those runs were
  taken. The first run after this lands will be the first one that can state an exact span.
