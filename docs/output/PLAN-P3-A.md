# PLAN — Phase 3, Lane A: the instrument

**Question owned:** how would anyone know whether D1 (≥2 scopes concurrent), D2 (uncorrupted
state) and D3 (≥30% wall-clock win) hold? Today nothing in the repo can answer any of the three
from evidence, and the one claim that was made (D1, "3/3 legs green") came from a probe that
counted greens and never measured overlap.

Not owned here: the scheduler (Lane B) and worktree isolation / the corruption probe (Lane C).

---

## 1 · My reading of Phase 3

The plan's "done when" is three predicates over a run that has already happened. All three are
**measurements**, and the repo has no measuring device — so Phase 3 cannot be closed or refuted
either way. That is the actual blocker, ahead of any scheduler change: Lane B can make the fan-out
wider and nobody will be able to say whether it worked.

The three are not equally hard, and conflating them is how a false green gets manufactured:

| | what it needs | status after this lane |
|---|---|---|
| **D1** ≥2 concurrent | per-leg intervals, and overlap computed over them | **measurable, and already proven from the archive** — see §5 |
| **D2** uncorrupted | a corruption probe (Lane C) + the reducer's own lock | not mine; I supply the *record* C's probe can assert against |
| **D3** ≥30% wall-clock | two runs of one feature, one of them sequential | **not derivable from anything that exists.** §6 |

The house rule that governs the whole design, from the audit RESULT-v2 produced:

> A predicate that an absence can satisfy must report that absence in the same value.

`max_concurrent: 1` computed over four legs with one usable record is exactly `runFixtures`
returning `pass: true` over zero fixtures. The instrument therefore never emits a concurrency
number without the completeness of the record set it was computed from, in the same document,
and never emits a speedup it cannot support.

---

## 2 · The missing datum, and why the dispatch receipt is not it

The brief asks whether `receipts/dispatch.jsonl` is the right carrier for leg completion. **It is
not, and the reason is measurable rather than architectural.** Against every archived run, the
gap between an order's `compiled_at` and the receipt that answers it is:

```
1.8s 1.8s 1.8s 2.0s 2.0s 2.1s 2.1s 2.2s 2.2s 2.2s 2.3s 2.3s 2.4s 2.5s 2.6s 4.6s 4.8s 5.6s
7.4s 7.5s 7.6s 13.7s 16.4s 19.4s 21.6s 25.8s 27.9s 28.1s 46.8s
```

A `task-executor` leg that writes a module, runs fixtures and ratchets three attempts does not
finish in 1.8 seconds. `PostToolUse` on a `Skill` call fires when the skill **resolves and its
instructions return** — the sub-agent's work happens after it. So the receipt is a hook-attested,
append-only, per-dispatch **START**, and it is an excellent one. It is not an end.

Three further facts that fix the design:

- **`orders/<id>.json` cannot supply a start either, except for the last dispatch.** Order paths
  are reused verbatim on relaunch, so the `compiled_at` on disk is the last compile. Measured: the
  same order's earlier receipts sit up to **9.4 hours before** the `compiled_at` the file now
  carries (`headless-shipped`, `cli-integration-test-r2-a1`: Δ = −33,923 s on its first receipt,
  +4.8 s on its last). Any measurement joining a receipt to a re-compiled order file is joining a
  start to a different dispatch's compile.
- **`run_id` does not separate launches.** `headless-shipped` holds four launches under one
  `run_id` (the receipt persists across relaunch and the id is derived from it), spanning
  17:18 → 03:35. A run-level span computed from that is 10.3 hours of mostly nothing.
- **`results/*.json` mtimes are worthless** — the traces were copied, so every mtime is the copy
  time. Anything built on them is fabricated. Not used anywhere in this lane.

### Decision: `harness reduce ingest` appends a leg-completion row

`.shapeup/<slug>/legs.jsonl`, one append-only JSON row per closed leg, written by the single
writer of shared state, which is also the act that closes a leg (`compile → Skill → reduce
ingest`, `worker()` step 3).

The row snapshots what the order said **at ingest time**, which is what makes it survive the three
things that break records here:

| hazard | how the row survives it |
|---|---|
| a relaunch reusing an order path | append-only, and `compiled_at` is snapshotted rather than re-read later — the order file may be overwritten afterwards and the row is still true |
| two rounds | `round`/`attempt` on the row, parsed from the order id's `-r<N>-a<M>` with the order's own fields as backup |
| a leg that dies without ingesting | **no row — deliberately.** The instrument counts starts with no completion and reports them as `no_completion_record`. A leg that died must be visible as a hole, not smoothed over |

`run_id` comes from the order, and when the order carries none it is resolved through
`readRunId(cwd, slug)` in `kernel/lib/paths.mjs` — never left null silently, and when it *is*
null the instrument reports `legs_unkeyed` rather than assuming one run.

The append is fail-open (`try/catch`, a warning on stderr): a timing row must never fail an
ingest. A lost row shows up as an incomplete leg, which is the honest consequence.

**Rejected alternatives**

- *A `PreToolUse`/`SubagentStop` hook writing an end.* Adds a sixth hook against Phase 5's diet,
  and a hook cannot know which leg a sub-agent stop belongs to. `dispatch-receipt.mjs`'s own
  header already argues why the attestation is `PostToolUse` and not `PreToolUse`; the same
  reasoning says the end is not a hook's fact at all.
- *Extending the receipt row.* The receipt is written by a hook from a tool payload; it has no
  access to the moment the leg closes. Overloading it would mint a fact rather than record one.
- *Deriving the end from `t0/trials.jsonl`.* Kept — as the **fallback** for runs recorded before
  `legs.jsonl` existed (§5), explicitly labelled as a lower bound. It is not the primary, because
  a leg that ran no T0 (an escalation, a dead worker) leaves no trial at all.
- *A `duration_ms` in the WorkResult.* Self-reported by the worker. "Measured, not claimed."

---

## 3 · The instrument: `harness probe concurrency`

Placement argument: `probe` is documented in `kernel/harness.mjs` as *"read-only queries over run
state"*, and this is exactly that — it writes nothing, and it answers from records. Its
neighbours are `probe resume` (derive state from artifacts), `probe t0` (one bounded question),
`probe stats` (aggregate a ledger). `reduce` is the writer and this must not write; `report
export` projects fact tables to disk; `verify` asserts a pass/fail contract, and concurrency is
not a contract to pass. A sixth top-level verb for one query would buy nothing and cost the
one-entry-point permission story its simplicity.

```
harness.mjs probe concurrency --slug <slug> [--cwd <dir>] [--run-root <dir>]
                              [--round N] [--gap-s N] [--format json|table]
```

`--run-root` follows `verify t0 --out <run root>`'s precedent: a caller that already holds the run
root does not have to infer a slug from a directory name. It is what lets an archived trace, whose
tiers are not at `.shapeup/`, be measured at all.

**What it emits**, byte-stable (no `now`, sorted arrays, fixed key order):

- per leg: `order_id`, `scope_id`, `round`, `attempt`, `started_at` + `start_source`,
  `ended_at` + `end_source`, `duration_ms`, `bound`
- `max_concurrent` per segment, with the instant it occurred, and a `bound` of `exact | lower`
- `span_ms`, `sum_leg_ms`, `speedup` (`sum/span`), each carrying its own `bound`
- `waves_observed` — connected components of overlapping intervals, in start order
- `completeness` — `legs_total`, `legs_exact`, `legs_lower_bound`, `no_completion_record`,
  `legs_unkeyed`, and which source supplied each end
- `dial` — `max_parallel_scopes` read from `.shapeup/<slug>/run-args.json` with
  `source: "run-args" | "default"`. **No archived run carries the field** (bulletin #1: it is read
  by the workflow and declared nowhere), so the instrument reports the effective default and says
  it is a default rather than asserting the run was launched with 4.

**Refusal rules, which are the point of the thing:**

- `speedup` is `null` with a `refused_because` unless **every** leg in the segment has an exact
  end. This is not conservatism: measured over `headless-shipped` round 2, the truncated legs give
  `sum/span = 0.90` — a "speedup" below 1 on a round that demonstrably ran four scopes at once,
  because truncated ends shrink the numerator n times and the denominator once. A ratio of two
  lower bounds is not a bound on the ratio.
- `max_concurrent` is always reported *with* its bound and the completeness block. Truncated legs
  are subintervals of the true legs, so overlap over them under-counts — safe for D1 (a lower
  bound of 4 proves ≥2) and stated as such, never as an exact figure.
- A segment with zero usable legs reports `max_concurrent: null`, never `0` or `1`.

**Segmentation.** Relaunches are separated by a gap rule (`--gap-s`, default 900) and the rule,
its threshold and the resulting segment count are all in the output, because it is a heuristic and
a heuristic that hides is a lie. Once `legs.jsonl` exists, segmentation is a fallback too — a leg
row's `compiled_at` snapshot identifies its dispatch exactly.

**Schema.** Emitted as single-line JSON like `probe resume` and `probe t0`, which are its closest
neighbours and neither of which registers a `$defs` entry. I am deliberately **not** touching
`skills/tech-lead/schemas/domain.schema.json`: the merge owner is editing `RunArgs` in that file
for the `maxParallelScopes` declaration, and a second hand in it buys a conflict for no behaviour.
Registering `ConcurrencyReport` is a one-hunk follow-up for whoever merges.

---

## 4 · Guards

Under `tests/structural/23-concurrency.mjs`, wired into `tests/structural.mjs` beside its
neighbours. Every one is verified by **re-introducing the defect and watching the suite go red**,
then restoring the fix.

The one that matters most is shaped against RESULT-v2's own confession: guard #53 asserted "every
record carries the run key" and passed for the whole life of the branch while every real trial row
was unattributable, *because the guard supplied its own fixture root*. So the run-key guard here
executes the shipped `reduce ingest` end to end in a scratch tree, with the run root the shipped
`init run` chose, and deletes `run_id` from the order to prove the fallback resolves it rather
than writing null.

---

## 5 · The baseline (Step 4)

Re-derived from `traces/phase2-criterion1/` by the instrument itself, using the receipt-start +
T0-landmark fallback, and frozen at `traces/phase2-criterion1/CONCURRENCY-BASELINE.json` with a
guard that re-derives and compares byte-for-byte.

**What is honestly derivable, and is now recorded:**

- `headless-shipped` round 1: **max 4 legs simultaneously** at `2026-08-16T02:16:34.692Z`
  (lower bound), 6/6 legs with an end landmark.
- The wave structure falls out of the timings alone: `foundation` → `add-todo + complete-todo +
  list-todos + remove-todo` → `cli-integration-test`. That is the dependency-wave schedule
  RESULT-v2 asserts, re-derived from two append-only ledgers rather than from the scheduler.
- `headless-final` (the alphabet-scheduled run) round 1: max **2**, round 2: max **3**.
- `headless-attempt2-build-dispatched-no-t0`: **8 starts, 0 ends** — the archive's own instance of
  the record set the house rule exists for, and the fixture the incompleteness guard uses.

**What is NOT derivable, stated rather than filled in:**

- **No D3 baseline exists and none can be derived from this archive.** Every archived run was
  executed by the post-Phase-3 fan-out scheduler; there is no sequential arm anywhere. Phase 2's
  "baseline" was structural — line counts and inventories, not a run — which is what RESULT-v2
  means by *"No number about v2.0's cost or wall-clock appears anywhere in this repo."*
- The run that would produce one: **the same feature, twice, changing exactly one variable** —
  `maxParallelScopes: 1` versus `4` — on the same model set, same round budget, same machine,
  compared on `span_ms` for the BUILD phase only (not the whole run: ORIENT/ANALYZE/WIRE/EVAL are
  sequential in both arms and would dilute the ratio toward 0). That comparison is blocked until
  the dial is reachable at all (bulletin #1).
- **Cost is not derivable.** No archived trace carries a `cost_usd` row; the agent-call journal
  `report export` projects is absent from every archived run root.

No number is manufactured to fill the D3 slot. The record says `available: false` with the reason.

---

## 6 · What I will not do

- Not editing `skills/tech-lead/workflows/shapeup-run.js`'s scheduling loop (Lane B's region).
  One advisory call belongs in the SHIP block so a run captures its own timing; it is written down
  in the report for the merge to place, not committed into a file two other lanes are editing.
- Not editing `domain.schema.json` or `commands/ship.md` (merge owner's, per bulletin #1).
- Not spending model budget. Every number in this lane comes from committed records and a
  deterministic re-derivation.
