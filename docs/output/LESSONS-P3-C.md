# LESSONS — LANE C (isolation and integrity)

What the other lanes and the merge need from this lane. Everything here was executed; nothing is
inferred from reading code.

## For LANE B (the scheduler) — two hard constraints

**1. Two scopes whose `shared` blocks intersect must not be co-scheduled.** This is the one that
will bite. Disjointness is enforced on `allowed`, and `shared` is the *declared escape hatch from
it* — `verify spec` passes a path both scopes list as shared, on purpose. `sandbox-guard` then
permits that path to **every** live order. So the permission layer is correct, the lint is correct,
and nothing anywhere connects either of them to *time*.

Measured: three concurrent writers doing read-modify-write on one shared entry point lost work in
**20 of 20 trials** — the surviving file contained exactly one writer's contribution. There is no
control that catches this: it is not a substrate violation, so no hook fires, and the losing writer
gets no error.

`verify spec` now emits a `SHARED-CONCURRENT` finding (level `warn`) naming the scope pair and the
path. **Consume it when building waves.** Two scopes carrying that finding belong in different
waves, exactly as a dependency edge would place them. It is advisory rather than red because
refusing the contract would weld shut the escape hatch that exists for legitimate shared entry
points.

The real-world shape is not hypothetical: in `headless-final`, `bin/todo.js` sits in five scopes'
`shared` block, with a measured wave overlap of 4.

**2. `maxParallelScopes` has a ceiling set by the ingest lock, not by cost.** `reduce ingest` takes
a per-run lock and refuses after **30 seconds** of waiting — deliberately, because proceeding
unlocked is what caused the lost update it exists to prevent. That refusal is an exit 1 that will
surface as a leg failure. The critical section is short (file I/O over the board and task files), so
4 legs are comfortable, but the bound is *total time inside the section × concurrent finishers*, and
it scales with board size rather than with scope count. If you raise the dial past ~8, measure the
lock wait rather than assuming it.

Nothing in this lane found a reason to drop `maxParallelScopes` below 4.

## For LANE A (the instrument) — records not to trust

**`t0/trials.jsonl`'s `trial` field changed meaning.** It used to be a run-wide counter
(`readTrials(file).length + 1`) and is now the scope's own trial ordinal. Two consequences for any
instrument reading it:

- **Do not join on `trial` alone.** The identity is `(scope_id, trial)`. Rows from different scopes
  legitimately share an ordinal now, and *did* share one before the fix too — for the opposite
  reason, because concurrent scopes raced the shared counter and minted duplicates (measured
  `[1,1,1,4]` and `[1,1,3,3]`, 95% of 20 runs).
- **Trial ordinals are not a run-wide sequence and never reliably were.** Any "how many trials did
  this run take" figure must count rows, not read a maximum.

**Any archived `graph.jsonl` written before this lane's fix has collapsed trial nodes.** Trial nodes
were keyed `trial:<slug>:<ordinal>` with no scope, and the graph folds into a Map, so concurrent
scopes' execution records overwrote each other. Measured: four trial rows on disk projected to two
nodes. A historical graph will silently under-report trials and its `SUPERSEDES` edges may point
into a different scope's lineage. The graph is derived, so **delete and rebuild it** rather than
reading an old one — but a rebuild only helps if `trials.jsonl` itself is post-fix.

**O_APPEND is safe, and now it is measured rather than assumed.** Your `legs.jsonl` design rests on
"one append-only JSONL line cannot tear". Swept 4 concurrent writers × 100 rows at 260 B, 1 KB, 4 KB,
8 KB, 16 KB and 65 KB: **zero torn or lost lines at every size**. The assumption holds on a local
filesystem. Two caveats worth carrying: this was one platform, and a network filesystem does not
make the same guarantee. Keep each record a single `appendFileSync` call — the property belongs to
the one write, not to the file.

**The concurrency assertion belongs inside the corruption probe too.** I adopted your point directly:
both racing arms of the new probe now compute peak overlap from observed process intervals and fail
if it is below 2. Before that they would have gone green over a sequential execution — the same
false-green shape as counting only successes. Post-merge these should call `harness probe
concurrency` instead of computing overlap locally, so there is one instrument rather than two.

## For the merge

**`active-scope` — the plan says delete it; the plan item is already satisfied, differently.** The
dangerous thing it named was the *substrate* pointer, rewritten per scope, which concurrency breaks.
That is gone: its writer was removed and `sandbox-guard` resolves the live order set instead. What
kept the filename is a *run* pointer, written once at run open and never moved. Readers enumerated
from the filesystem, each exercised with the file present and deleted:

| Reader | Falls back to | Verdict without it |
|---|---|---|
| `kernel/init/run.mjs` | — (sole writer) | n/a |
| `kernel/verify/budget.mjs` | scans for a receipt | exit 0, unaffected |
| `kernel/reduce/snapshot.mjs` | scans for a mid-run ledger | exit 0, unaffected |
| `kernel/report/export.mjs` | none | exit 3, names the flag to pass |
| `kernel/lib/paths.mjs` (`resolveRunId`) | `null` | hook decision rows lose `run_id` |
| `hooks/lib/decision.mjs` | via `resolveRunId` | **2/2 → 0/2 rows carry a run key** |
| `kernel/probe/resume.mjs` | — | **imported and never used** (removed) |

Deleting it costs the run key on every hook decision row and buys no concurrency safety. Keep it.
Its doc-comment claimed the sandbox guard reads it to answer "which scope is checked out?"; executed
against a fixture, the guard's verdicts are **identical** with the file present and absent. That
stale comment is where the plan's risk register got "sandbox-guard coupling (reads active-scope
pointer today)" — the comment was the source, and it is now corrected.

**`isolation:'worktree'` is declined, and not for the reason on record.** ADR-0003 carries the full
argument. The short version: the recorded premise (a worktree lacks the run state) is true but is
*not* an obstacle — the main checkout is derivable from inside a worktree with `git rev-parse
--git-common-dir`, no configuration at all. The decision rests on two things the record never
mentioned: a worktree silently disarms `sandbox-guard` (it resolves from cwd, finds no pointer, and
emits the same `no-round` row it emits when no run exists — in-substrate and out-of-substrate writes
become indistinguishable), and **nothing merges a worktree back**, so legs would write product code
where nothing downstream reads it.

## Two general lessons this lane paid for

**A composite key can be satisfied by the defect it was written to catch.** My first racing
assertion checked that `(scope_id, trial)` was unique under concurrency. The old cross-scope counter
produces `[1,1,1,4]` across *four different scopes* — every composite key distinct. The assertion
passed on the broken code, in 5 of 5 runs. What actually carries the evidence is the ordinal's own
*value*: four fresh scopes must each be numbered 1. Check the value the defect changes, not a
uniqueness property that survives it.

**Deleting a file that was never there proves nothing.** The check "removing `active-scope` does not
disarm the guard" ran against a fixture that had never written `active-scope`. It was green and
vacuous. It only became a test once the fixture planted the pointer first, making the deletion the
discriminating act.

Both are the same failure in different clothes, and both were caught only by re-introducing the
defect and watching for red — never by re-reading the assertion.
