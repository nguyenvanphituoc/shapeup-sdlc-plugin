# LANE C — settle the isolation question

Phase 3 of the v2.0 strip-down, lane C: **isolation and integrity**. Lane A owns the concurrency
instrument, lane B owns the scheduler. This lane owns two questions and nothing else.

## 1 · How I read Phase 3

The strip-down plan asks Phase 3 for three things. Two shipped. The third — `isolation: 'worktree'`
on build legs — was refused, and the refusal is the only plan item in the whole document whose
stated reason was never executed against anything:

> *"A fresh worktree does not carry the gitignored `.shapeup/` run state every leg reads and writes,
> so it would break the legs it was meant to isolate."*

That sentence contains one factual claim (a worktree does not carry `.shapeup/`) and one inference
(therefore the legs break). The claim is trivially checkable and probably true. The inference is the
part that was never tested, because it silently assumes the run root must be reachable *at the leg's
own cwd* — and the kernel already separates those two ideas in at least one place (`verify t0` takes
`--cwd` for the working tree and `--out` for the run root, and its own header explains why the two
must not be derived from each other).

So the deviation may be right for a reason it does not give, or wrong. Either way the record is a
plausible argument standing where a measurement belongs, and Phase 3 cannot close over it.

The second question is the plan's own done-when **D2** — "board/ledger uncorrupted (the reducer
proves itself)" — and Phase 7 probe 3. The repo already contains a lock (`kernel/reduce/ingest.mjs`
`withLock`) whose comment says the corruption it prevents was *measured*. What has never been run is
a probe that forces the concurrency and checks the state afterwards, across **all** the shared files
rather than the one the lock covers. A lock on one reducer is not a proof about the run's state; it
is a proof about that reducer.

### What I will not touch

- `shapeup-run.js`'s scheduling loop (lane B). Anything my evidence demands there ships as a written
  instruction in my report, not as a diff.
- `domain.schema.json` and `commands/ship.md` (the main session owns the `RunArgs` fix that makes
  `maxParallelScopes` reachable). My probe's job is to say what bound the evidence supports.

## 2 · The experiments, and what each one settles

Every one of these is deterministic, free, and runs against scratch git repos under the session
scratchpad. None of them spends a model token. Each names, in advance, the observation that decides
it — so a result I did not want cannot be re-read as a result I did.

### E1 — What a worktree actually carries

Build a scratch project with a committed `shapeup/<slug>/` tree, a gitignored `.shapeup/<slug>/` run
tree (receipt, board, orders, results, trials, graph, ledger, pointers), then `git worktree add` and
enumerate both trees inside the new worktree.

- **Settles:** the factual half of deviation #5.
- **Decides it:** the file list. If `.shapeup/` is absent in the worktree, the claim holds. If the
  committed `shapeup/` tree is present, the deviation's reasoning covers only half the state a leg
  reads, and I say which half.

### E2 — What `sandbox-guard` does inside a worktree

Execute `hooks/sandbox-guard.mjs` — the real file, fed real PreToolUse payloads on stdin — three
ways over the E1 fixture: (a) `cwd` = main checkout, write outside the substrate; (b) same payload,
`cwd` = the worktree; (c) `cwd` = worktree, write inside the substrate.

- **Settles:** the plan's "one hook-coupling risk". The plan says the risk is that the guard reads
  the `active-scope` pointer. Grep says it reads `active-order` and the live order set. So the plan's
  named risk is stale; the question is whether a *different* coupling bites.
- **Decides it:** arm (b)'s verdict. `deny` means the guard survives a worktree. `allow` means every
  substrate wall is off inside a worktree, silently, by fail-open — and `isolation:'worktree'` would
  then be trading a hard wall for a soft one, which is a decision, not a detail.

### E3 — Is the obstacle removable, and at what price

Three candidate removals, each executed rather than argued:

1. **`--cwd` threading.** Every kernel subcommand already declares `cwd: { type: "path" }`. Run a
   full compile → ingest cycle from inside a worktree with `--cwd <main checkout>` and see whether
   the run state lands correctly.
2. **Run root ≠ working tree.** `verify t0` already splits them (`--cwd` / `--out`). Run it from the
   worktree with the run root pointed at the main checkout, and check what the git ratchet then
   operates on.
3. **`.shapeup/` outside the worktree by construction** (symlink, or a root override).

- **Settles:** whether "it would break the legs" is a property of the design or of the current
  wiring.
- **Decides it:** for each candidate, does the cycle complete and does the state land in one place?
  A candidate that works but leaves `sandbox-guard` disarmed (E2) has not removed the obstacle, it
  has moved it.

### E4 — The blast radius of the T0 ratchet's revert

`kernel/verify/ratchet-tree.mjs` `restore()` runs `git restore --source=<ref> --worktree -- .`. The
`-- .` is repo-wide. Two scopes, disjoint substrates, one shared working tree: snapshot scope A,
have scope B write its own files, then trigger scope A's revert and list what changed.

- **Settles:** whether a shared working tree is safe for concurrent build legs *at all* — which is
  the positive case for worktrees that the deviation never considered.
- **Decides it:** whether scope B's files survive scope A's revert. If they do not, `sandbox-guard`
  cannot see it (it hooks `Edit`/`Write`, and this is a git subprocess), and the answer to Q1 flips.

### E5 — The parallel-corruption probe (D2, Phase 7 probe 3)

Force ≥3 concurrent writers against one run's shared state and assert consistency afterwards.
Classified by *write shape*, because that is what determines whether a file can tear:

| File | Shape | Can it tear? |
|---|---|---|
| `tasks/_index.md` (board) | read-modify-write markdown | yes — lost update |
| `discovery/ledger.md` | append to markdown | append is atomic; section interleaving is the risk |
| `t0/trials.jsonl` | append, but the **row's own `trial` field** is `readTrials().length + 1` | yes — duplicate ordinals |
| `graph.jsonl` | read-diff-append | yes — duplicate rows |
| `receipts/dispatch.jsonl` | pure append | no, if each line is one `O_APPEND` write under `PIPE_BUF` |
| `active-order` | whole-file overwrite | last-writer-wins by design; the guard reads the order *set* |

Each arm runs N≥3 real OS processes started as close together as the scheduler allows, and each arm
runs **≥20 times**, reporting a reproduction *rate*. A race that fires 1 in 20 is not disproved by
one green run, and a probe that reports a boolean cannot express that.

- **Settles:** D2, honestly — per file, not as a slogan.
- **Decides it:** for each arm, an invariant checked after the fact (board rows agree with task
  frontmatter; every `trial` ordinal unique per run; no duplicate graph node/edge ids; every JSONL
  line parses).

### E6 — `active-scope`: delete, or not

The plan says delete the pointer. It has since been repurposed as the *run* pointer. Enumerate every
reader from the filesystem, then decide from the enumeration.

- **Settles:** whether the plan item still applies as written.
- **Decides it:** the reader list plus what each falls back to when the pointer is absent. A pointer
  whose absence is a supported state for every reader is deletable; one that is a hard dependency
  anywhere is not, and the plan item is then satisfied by the *substrate* pointer being gone rather
  than by this file being gone.

## 3 · Guards I intend to leave behind

Structural checks under `tests/structural/`, wired like their neighbours, cheap enough for CI:

- the corruption probe itself, as a repeatable check with a fixed iteration count;
- the trial-ordinal uniqueness invariant;
- `sandbox-guard`'s behaviour when the run root is not under the leg's cwd — executed, never read.

Each is verified by re-introducing the defect it catches and watching the suite go red.

## 4 · Alternatives I considered and rejected

**Read `shapeup-run.js` and reason about it.** Rejected: the whole reason this lane exists is that
the last round of reasoning about worktrees was persuasive and unexecuted. A static suite cannot
tell you that a thing runs.

**Prove the corruption probe with one green run.** Rejected: it is the exact shape of the D1 false
green the plan is fixing. A concurrency probe that runs once measures the scheduler's mood.

**Fix the concurrency defects I find by widening `withLock` over everything.** Rejected as scope
creep and as the wrong shape — a global lock over the whole kernel would serialise the fan-out Phase
3 exists to create, which is a fix that deletes the feature. Where a defect needs a fix I will pick
the narrowest one that keeps the legs parallel, and where it needs a *limit* I will report the limit
to lane B rather than encode it here.

**Add `isolation:'worktree'` and see if the sample project still works.** Rejected: that spends model
budget the brief reserves for the main session, and a single live run cannot distinguish "works" from
"the race did not fire this time".
