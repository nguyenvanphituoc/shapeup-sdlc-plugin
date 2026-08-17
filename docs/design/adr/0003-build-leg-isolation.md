# ADR-0003 — Isolation for concurrent build legs

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-17 |
| **Decision** | Concurrent build legs share one working tree. Per-leg git worktrees are **declined**, and the isolation they were meant to provide is supplied by three narrower controls named below. |
| **Affects** | the BUILD fan-out, `kernel/verify/ratchet-tree.mjs`, `kernel/verify/t0.mjs`, `hooks/sandbox-guard.mjs` |

## Context

Scopes build concurrently. The plan that introduced the fan-out also called for running each build
leg in its own git worktree, so that a scope's file operations could not reach another scope's work.
The fan-out shipped; the worktree did not, and the reason recorded at the time was:

> A fresh worktree does not carry the gitignored run state every leg reads and writes, so it would
> break the legs it was meant to isolate.

That is a claim about a filesystem, and it had never been run. Declining an isolation control on an
untested premise is the thing this record exists to stop, so the premise was executed.

## What execution showed

**The premise is true, and it is not the obstacle.** A fresh worktree of a project carrying a run
carries every committed artifact (scope contracts, requirements, wiring map) and **none** of the
gitignored run state — measured at 13 files present in the checkout and 0 in the worktree. But the
run root is reachable from inside a worktree three separate ways, and one of them needs no
configuration at all:

- A worktree's `.git` is a file naming the main checkout's git directory, so `git rev-parse
  --git-common-dir` yields the main checkout with no flag, no environment variable and no operator
  action.
- Every kernel subcommand already accepts `--cwd`, and a full cycle run from inside a worktree with
  `--cwd <main checkout>` resolves the main run root correctly.
- Linking the run root into the worktree restores the substrate wall exactly, both directions
  (an out-of-substrate write denied, an in-substrate write permitted).

So the recorded reason does not survive execution. The decision below rests on different grounds.

What the premise *does* establish is how much the workaround has to get right, and that the cost of
getting it wrong is silence rather than an error. Every one of those run-state files is written by a
leg that would succeed either way: a leg writing its completion record into a worktree's own empty
run root exits 0, and the record simply is not where anything reads it. The run continues, the gates
pass, and the only symptom is a measurement that has quietly returned to its pre-fan-out value. A
run root threaded absolutely would fix it — but a worktree scheme that forgets one writer does not
fail loudly, and there is no check that would catch it.

**The substrate wall is rooted at the leg's own working directory.** `sandbox-guard` resolves the
live order set from the cwd it is handed. Executed inside a worktree, it finds no pointer and defers
— fail-open, which is the correct direction for a hook that has nothing to enforce, and which here
means every substrate boundary is unenforced. The decision row it writes is `no-round`, the same row
it writes when no run exists anywhere. In-substrate and out-of-substrate writes in a worktree are
therefore **indistinguishable**: both are permitted, and both are recorded identically. Adopting
worktrees without first threading the run root would trade a hard wall for nothing, silently.

This also corrects the risk register, which listed the coupling as "`sandbox-guard` reads the
`active-scope` pointer". It does not. It reads `active-order` and the live order set, and deleting
the run pointer changes none of its verdicts. The real coupling is to the cwd.

**Nothing merges a worktree back.** This is the decisive gap and it appears nowhere in the prior
record. Build legs write product code. A leg running in its own worktree writes it *there*, and no
step in the pipeline returns it to the checkout the run is building. The evaluator, the ship report
and the traceability oracle all read the main tree. Worktree isolation as specified produces a run
whose work is not where the run is looking.

**The hazard worktrees were meant to contain was real, and had a narrower fix.** The T0 ratchet
reverted a red attempt with a repo-wide `git restore`. A scope's snapshot is a stash of the whole
tree, so one scope's revert rolled its neighbours back to whatever state they held when that scope
last went green — executed directly, a neighbour's file was replaced by the baseline while its own
leg was still working in it. No existing control could see this: the sandbox guard fences the Edit
and Write tools, and the ratchet destroys through a `git` subprocess.

## Decision

Concurrent build legs share one working tree. The isolation is supplied by:

1. **Disjoint substrates, enforced per write.** `verify spec`'s disjointness rule fails a spec whose
   scopes claim the same path, at GATE L1b, before any build starts; `sandbox-guard` then denies any
   write no live order's substrate covers. This is a hard wall and it works under every permission
   mode.
2. **A revert bounded by the scope's own substrate.** The ratchet restores only the `allowed` globs
   of the scope that triggered it — never `shared`, which is by definition a surface another scope
   may also be writing. With nothing to bound it, the revert refuses rather than falling back to the
   repo.
3. **A per-run lock on the reducer.** Shared-state writes are serialised by `reduce ingest`'s lock,
   which is what keeps the board agreeing with the task files it describes when several legs finish
   together. Its stale-break asks whether the holder is still alive, not merely how old the lock is:
   a synchronous critical section cannot refresh its own timestamp, so age alone made a slow holder
   and a dead one the same observation and let a waiter in beside a live writer.
4. **A co-scheduling finding on shared surfaces.** Disjointness is enforced on `allowed`, and
   `shared` is the declared escape hatch from it — legal by design, and unsafe for two scopes at the
   same time, because an edit is read-modify-write and the later writer drops the earlier one
   silently. Measured on a shared entry point with three concurrent writers: work was lost in every
   trial. `verify spec` now reports the overlapping pair as `SHARED-CONCURRENT` so the scheduler can
   separate them into different waves. It is advisory: refusing the contract would close the escape
   hatch the rule exists to open.

## Accepted risk

Isolation is per-write, not per-tree, so it covers what the harness can observe. A worker's **Bash**
calls are not fenced by the substrate wall: a dependency install, a formatter run across the repo,
or a codemod will reach another scope's files, and nothing will deny it. Two mitigations, neither
complete: substrates are disjoint so a *correct* worker has no reason to write outside its own, and
the seesaw check re-runs finished scopes' fixtures so a broken neighbour surfaces as a regression at
the next attempt rather than at ship. This is the residual, stated rather than closed.

## What would change the answer

Adopt per-leg worktrees if any of the following becomes true, and expect to build the merge-back step
first:

- Workers begin running repo-wide Bash routinely, making the unfenced axis the common case rather
  than the exception.
- Concurrency rises past the point where one tree's build outputs collide between legs.
- The substrate wall gains a run-root resolution independent of the leg's cwd — at which point the
  worktree stops disarming it, and the objection in §2 above falls away.
