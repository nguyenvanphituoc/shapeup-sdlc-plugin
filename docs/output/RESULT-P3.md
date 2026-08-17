# Phase 3 — the fan-out, measured

What the plan asked for, what shipped, and what building the instrument that could check it turned
up. Companion to `PLAN.md` §"Phase 3 — Fan-out" and to `RESULT-v2.md`, which closed Phase 2.

Three lanes worked this phase in parallel git worktrees, exchanging findings mid-flight, and one
result was merged: **A** built the instrument, **B** the scheduler, **C** the isolation decision and
the corruption probe. Their own write-ups are `PLAN-P3-{A,B,C}.md` and `LESSONS-P3-{A,B,C}.md`.

---

## 1 · The acceptance ledger

Phase 3's "done when" has three clauses. They are answered here in the order they can be answered,
which is not the order they are written.

### D2 — board/ledger uncorrupted under concurrency

**Met, and it was not met before.** This is the clause that turned out to be false, and nothing had
ever probed it. Four write shapes, ≥20 iterations each:

| Write shape | Result |
|---|---|
| `reduce ingest` (locked) | 0/20 corrupt — the lock works, and this is the first time it was executed under contention |
| `verify t0` (trial ordinal) | **19/20 corrupt** |
| `reduce graph` | **20/20 duplicate rows** |
| raw JSONL append | 0/20 to 65 KB — append-only is concurrency-safe by construction, confirmed rather than assumed |

Four defects fixed, each invisible to a suite of a thousand static checks because every layer
involved was individually correct:

1. **The T0 ratchet destroyed its neighbours' work.** A red attempt reverted with `git restore
   --worktree -- .` — the whole repo — and a scope's snapshot is a stash of the whole tree. Executed:
   one scope's revert replaced another scope's file with the baseline *while that scope's leg was
   still working in it*. No control could see it, because `sandbox-guard` fences the Edit and Write
   tools and the ratchet destroys through a `git` subprocess. Now bounded to the scope's own
   `allowed` globs — never `shared` — and refuses rather than falling back to the repo.
2. **The trial ordinal was a read-modify-write counter.** `readTrials().length + 1`: four concurrent
   scopes produced `[1,1,1,4]` in 95% of 20 runs, and the run graph keys nodes off that ordinal, so
   four trial rows projected to **two** nodes. Half the execution records, gone silently.
3. **`substrate.shared` loses writes.** It is the sanctioned escape from the disjointness rule, so
   the lint passes it and the wall permits that path to every live order. Three concurrent writers to
   one entry point lost work in 20 of 20 trials.
4. **The ingest lock admitted a second writer.** It broke any lock older than 30 s; `mkdir` stamps
   its mtime once and the critical section is synchronous, so "working for 31 s" and "died 31 s ago"
   were the same observation.

### D1 — a 3-scope feature builds with ≥2 scopes concurrently

**Met.** It was also *claimed* before this phase, from a probe that counted green legs — which three
legs run strictly one after another satisfy exactly. There was no instrument in the repo that could
measure overlap.

`harness probe concurrency` now answers it from run records alone. Re-derived over the committed
archive (`traces/phase2-criterion1/CONCURRENCY-BASELINE.json`), the strongest honest evidence is
`headless-shipped` round 1: **4 legs open simultaneously**, 6 of 6 legs closed, and the dependency
wave structure re-derived from the timings rather than read off the scheduler. Every archived figure
is a *lower* bound — leg-completion records did not exist when those runs were taken — which is the
safe direction for a "≥ 2" claim.

Two properties the instrument has because a false answer was caught in the act:

- **A predicate an absence can satisfy reports the absence in the same value.** `max_concurrent: 1`
  over four starts and one usable end reads identically to a genuinely sequential run, so the report
  carries how many legs had complete records beside the figure, refuses a speedup it cannot support,
  and answers `null` — not `0`, not `1` — when nothing can be measured.
- **An ingest that ran outside its leg cannot manufacture overlap.** A leg's recorded end is when the
  *writer* ran. One leg repaired by hand 250.8 s late, against −2.4 s and +29.2 s for its two
  untouched neighbours, made a run whose dial was **1** report two legs concurrent. Overlap is now
  measured against the legs' own mid-flight T0 windows as well, and where the two disagree the answer
  is `disputed`.

### D3 — wall-clock beats the Phase-2 baseline by ≥30%

*(measured below in §3)*

---

## 2 · The plan's items, and where each landed

| Plan item | Outcome |
|---|---|
| `pipeline()` over scopes | shipped in Phase 2's tail; now **measurable**, which it was not |
| `isolation:'worktree'` on build legs | **declined** — ADR-0003, on grounds the record did not have |
| delete branch-per-scope checkout | already gone |
| delete the shared `active-scope` pointer | **kept**, and the plan item is satisfied differently: the dangerous *substrate* pointer is gone, and what carries the name is a write-once *run* pointer that is not a concurrency hazard. Removing it drops the run key from hook decision rows (2/2 → 0/2) |
| `args.maxParallelScopes` (default 4) | shipped in code and **unreachable** until this phase declared it |
| verify `sandbox-guard` reads the order, not the pointer | true — and the plan's risk register named the wrong coupling. The guard is coupled to `cwd`, not to `active-scope` |

### ADR-0003, and why the reason matters as much as the answer

The plan mandates per-leg worktrees. `RESULT-v2.md` deviation #5 declined them on this reasoning:
*"a fresh worktree does not carry the gitignored `.shapeup/` run state every leg reads and writes."*

That is a claim about a filesystem, and it had never been executed. Executed: **the premise is true
and it is not the obstacle.** A fresh worktree carries 13 of the run-state files and 0 of them — and
the run root is reachable from inside a worktree three separate ways, one needing no configuration at
all (`git rev-parse --git-common-dir`).

What declines it instead:

- **A worktree silently disarms the substrate wall.** Executed inside one, `sandbox-guard` finds no
  pointer and defers — `verdict=allow, rule=no-round`, byte-identical to the row it writes when no
  run exists anywhere. In-substrate and out-of-substrate writes become indistinguishable. Adopting
  worktrees first would trade a hard wall for nothing.
- **Nothing merges a worktree back.** This appears nowhere in the prior record and is decisive. Build
  legs write product code; a leg in its own worktree writes it *there*, and the evaluator, the ship
  report and the traceability oracle all read the main tree.

The hazard worktrees were meant to contain was real — that is defect 1 in §1 — and had a narrower
fix. The residual is stated rather than closed: a worker's **Bash** calls are not fenced by the
substrate wall, so a repo-wide formatter or codemod will reach another scope's files and nothing will
deny it.

---

## 3 · The scheduler, and D3

The chunked fan-out had a barrier per chunk and released a scope only when its whole wave finished.
It is now a **dependency-released sliding window**: waves order the scopes, edges release them, the
dial caps them, and the dependency wait happens *before* the slot acquire — which is what makes
deadlock structurally impossible rather than merely unobserved.

Measured on a virtual clock over 14 workloads, against the scheduler it replaces, under two dispatch
models (the second charging for the launch ramp, because a `pipeline()` group is measured **not** to
start together — one archived wave of four took a 54-second ramp):

| Workload | dial | chunked | window | saved |
|---|---|---|---|---|
| 8 independent legs, one slow per group | 4 | 100 | 51 | **49%** |
| 8 independent, one 4× leg (ramped) | 4 | 75 | 50 | **33%** |
| 6 independent, even legs (ramped) | 4 | 50 | 40 | 20% |
| todo-cli (1→4→1) | 4 | 70 | 70 | **0%** |
| **this project's sample feature (2→1)** | 4 | 40 | 40 | **0%** |
| dependency chain | 4 | 40 | 40 | 0% |
| five-way shared entry point | 4 | 70 | 100 | **−43%** |

**The window never loses on duration, and it gains nothing on a feature whose waves already match
the dial** — which includes both features this repo actually builds. The launch ramp *widens* the
gap rather than narrowing it (0%→20%, 20%→33%): a barrier re-pays the ramp on every chunk, a window
pays it once. That was the strongest argument against the change, and testing it reversed it.

**D3 is not claimable by scheduling, and this phase does not claim it.** The plan's baseline is
Phase-2's **sequential** scope loop, so the 30% was bought by fan-out existing at all — which shipped
before this phase. A better scheduler competes only for the residual, measured at ≤14.5% of one
archived build span. Saying so is the point: a plan that promises 30% and delivers a differently-sized
number teaches you to discount its next estimate.

### The safety edge, and the one place it costs D1

Two scopes that may write one path never overlap now. On a feature whose entry point sits in five
scopes' substrate — measured in the archive — that drops concurrency to one scope at a time and costs
43% of the makespan, and it **fails D1**.

It is still right, for a reason worth stating plainly: the 43%-faster alternative *loses work in
every trial*. A makespan comparison that ignores whether the feature got built is the same instrument
failure as the probe that only counted greens.

D1 is therefore **conditional on the scope cut**, and the condition is already a hard lint:
≥2 scopes with disjoint writable substrate. Both features this repo builds satisfy it with the edge
switched on. Only the badly-cut variant does not, and it should not. The concurrency the contracts
permit is now reported *before* the run spends anything, which splits a shortfall into two causes
with different repairs: below the ceiling is a dispatch problem, a ceiling below the dial is a
scope-cut problem.

---

## 4 · What the live runs found that no fixture could

### A build leg can skip its own ingest and be accepted

The most expensive defect of the phase, and it surfaced on the first live run rather than in any
probe. A leg wrote its code, a green T0 verdict, a kept trial row and its WorkResult — and skipped
step 3 of its own script, `reduce ingest`. It reported green; the round re-verified the T0 artifact,
agreed, and walked on:

```
TASK-001 (env-parsing)   status: pending   ACs ticked: 0     ← skipped its ingest
TASK-002 (schema-rules)  status: done      ACs ticked: 12
```

Nothing was wrong with the order, the receipt or the result — ingesting the same file afterwards
succeeded, attested, and ticked nine criteria. The single writer of shared state simply never ran, and
the board that GATE L2 reads as "100% ✅" silently disagreed with a scope that was genuinely finished.

**What made it visible was a record built for something else.** The leg-completion ledger exists to
measure concurrency; it had a row for one scope and none for the other, and the row is written *by*
`reduce ingest`, so its absence is proof the writer never ran — a fact the leg cannot assert about
itself, for the same reason a dispatch receipt is written by the hook layer rather than by the
sub-agent making the call.

The round now asks both questions, and ingests finished work its leg failed to apply rather than
paying a whole attempt again for work already done.

### The evaluator graded a command the contract did not name

The acceptance contract's verification clause named `npm test`. That command fails on this Node
version; `node --test` with no path argument passes 45/45. The evaluator cited the second one, and
the run shipped **PASS** with the discrepancy uncaught — nobody in the loop ran the exact invocation
the contract specifies. The verdict was right about the deliverable and wrong about what it had
verified.

### Two environment facts that make the headless lane usable

- `claude -p` terminates a session's background tasks after **600 s**, and the whole pipeline is one
  background launch. An unattended run dies mid-phase with no diagnostic beyond "background tasks
  still running; terminating", which reads like a tidy shutdown. Nothing is lost — resume state is on
  disk and a relaunch fast-forwards — so the cost is a relaunch, not the run.
- `/ship` is not a command. On both install topologies it answers `Unknown command`. The name that
  resolves is `/shapeup-sdlc-plugin:ship`, and the README called the bare form the whole quickstart.

---

## 5 · The switches that were accepted and ignored

`shapeup-run.js` read `args.noQa`, `args.maxParallelScopes` and `args.adversarialVerify`.
`$defs/RunArgs` declared none of them, and tech-lead builds the launch record from that definition —
so `--no-qa`, documented in **seven** places across the shipped set, did nothing; Phase 3's own cost
dial could not be turned; and the refute wave could not be switched on. `--no-eval` worked, which is
what shows this was an oversight rather than a design.

Both halves were individually correct. The script defaults a field it reads; the schema declares a
coherent record. Nothing was wrong until you asked what the **join** between them said, and nothing
was reading the join. That is the recurring shape of every defect in this document.

And a run could not state what it was launched with: `run-args.json` is declared by the schema, named
tech-lead as its writer, described as written fresh on every launch — and no instruction anywhere ever
said to write one. The instrument reported `default (no run-args.json)` for a run launched with
`--parallel-scopes 1`. Honest, and unfalsifiable.

Two checks close the classes rather than the instances: every arg a workflow reads must be declared in
the launch record, and every artifact the schema makes tech-lead responsible for must be named in
tech-lead's own instructions. *A registry entry is not an instruction.*

---

## 6 · The instrument's own failure mode, twice

Both lanes that built measuring tools caught their own tool lying, and both times the wrong version
produced entirely plausible numbers:

- A leg-pairing window keyed by **order id** let a leg that had actually died claim a T0 artifact
  written by a later dispatch of the same scope, returning a **17-minute** duration. Keyed by
  scope + round it is correct.
- A `(scope_id, trial)` uniqueness check **passed on the broken counter 5/5**, because `[1,1,1,4]`
  across four *different* scopes makes every composite key distinct. It had to assert the ordinal's
  value, not its uniqueness.

Five guards across the three lanes were found **vacuous** — green against the exact defect they
existed to catch — and every one of them was found the same way: by re-introducing the defect and
watching the suite fail to notice. Two were checks that matched a function's *declaration* and read
its parameter names as though they were the arguments at the call site.

There is no substitute for that discipline, and re-reading a guard is not one. **34 defect
re-introductions** were applied across the three lanes; the suite went red on every one and green on
every restore.

---

## 7 · Suite

| | Baseline | Now |
|---|---|---|
| Structural checks | 1020 | **1125** |
| Kernel subcommands | 21 | 23 (`probe concurrency`, `probe leg`) |
| Orchestrator lines | 996 | 1264 |

The orchestrator grew by 268 lines, which moves further from the plan's ≤600 target rather than
toward it. Recorded rather than left to be noticed: the growth is the scheduler, the safety edge and
the leg-application check, and the target was written against a draft that had none of them.
