# Execution record — the single-loop plan, as far as it could honestly go

| | |
|---|---|
| **Date** | 2026-11-07 |
| **Plan** | [`plan-2026-11-07-single-loop.md`](plan-2026-11-07-single-loop.md) |
| **Branch** | `plan/single-loop`, local commits only; nothing pushed, nothing tagged |
| **Baseline** | 3.18.4 at `16eae5a`; `npm test` green (2392 checks), `npm run demo` verified |
| **Now** | `npm test` green (2583 checks), `npm run demo` verified, `npm run verify:cross-dir` passes |
| **Status** | **stopped at the plan's own gate.** A0b, A0 and the additive parts of A1 and A6 are done; every activity that deletes something is blocked, and so are the ones that need a real run |

## What stopped it

The plan says that until a real run has shipped through `building`, nothing is deleted. A real run is
a nested `claude -p` session over a consumer project, and Claude Code discards that project's
permission grant until its folder is trusted, which is the user's decision to make. Both the scratch
folder and a folder inside this repository were tried; trust is not inherited. The options put to the
PO were to trust the folder, to skip permissions for the run, or to run no real session. **The PO
chose no real runs.** So every done-when that names a real run is **not met**, and is reported as such
below. Nothing here stands in for it.

## Activity by activity

| # | State | Evidence |
|---|---|---|
| A0b | **done** — ADR-0004 written and accepted by the PO | `docs/design/adr/0004-single-loop.md` |
| A0 | **done** — README written, seven dangling citations removed rather than inventing the two analyses they pointed at, open questions filled, the nine candidate requirements added as `proposed`, the drift check taught relative links (failed on a missing link, then passed) | `tests/structural/08-docs.mjs` |
| A1 | **partly done.** The verb and the skill exist and are tested; the done-when needs a real run and **is not met** | below |
| A2 | **blocked** — deletes three planner skills | |
| A3 | **blocked** — deletes three skills and two commands | |
| A4 | **partly done** — the Stop hook now also recognises `Skill(building)` (additive; `tech-lead` still counts). Deleting `gate-intake`, re-keying and the `SessionStart` echo are blocked | `hooks/gate-zerowork.mjs`, section 175 |
| A5 | **blocked** — deletes the control plane | |
| A6 | **partly done** — the leg row and the export carry `tokens_in`, `tokens_out`, `tokens_total`, `cost_usd`, `usage_source`, null where the host reported nothing. The deletions are blocked | `kernel/reduce/ingest.mjs`, section 177 |
| A7 | **partly done** — the new loop has its own fixtures; porting the 37 script-reading files waits for the script to go | sections 175, 176 |
| A8 | **blocked** — needs a real run | |
| A9 | **blocked** — a 4.0.0 release of a tree that still holds the old control plane would be a release of nothing the plan describes. No version bump, no changelog, no tag. `verify:cross-dir` passes on the current tree | |

### A1, in detail

- `kernel/probe/next.mjs` is the state machine. It is read-only, stateless and writes nothing; every
  "sent back once" branch the script held is a branch of it. `kernel/lib/schedule.mjs` (the scope
  scheduler, moved out of the script) and `kernel/lib/floor.mjs` (the model floor and launch-record check)
  are new.
- `skills/building/` is the loop: 95 lines against the 155-line ratchet, which now also covers its path.
  `commands/ship.md` points at it. `--tiny` still goes to `tech-lead`; the plan removes the tiny lane with
  `tech-lead`, which is a breaking change for consumers that the release notes will have to name.
- `gate --resolve --answer <decision>` records a live PO answer with the source `PO (live)`.
- Section 175 holds 62 planted-tree cases, one per branch of the script's control flow. Section 176
  drives a whole archived plan through `probe next` with every command a step hands out run for real.
  **It is not a real run.** A few lines stand in for the sub-agent; no model ran and no code was built.
  It proves the seams hold: it found that a launch with no answer set exited 2 at its first gate.

### Deviations from the plan, each deliberate

1. **Planning steps keep their workers in A1.** `plan` is folded in A2, which is blocked.
2. **A missing project profile is a `need`, not an abort.** The script aborted because it could not ask;
   the loop can.
3. **`--adversarial-verify` is recorded and reported as not carried.** The refutation wave was bare agents
   with no worker skill, and its verdict was never durable: the ledgered FAIL stood while the gate was
   crossed over a pass. Porting it into a four-worker model needs a decision.
4. **Per-edge scope release becomes per-ask release.** `probe next` returns every scope that is releasable
   now; the loop dispatches them together and asks again. A loop that launches them in the background
   recovers the overlap.
5. **`tokens_total` is added beside the split.** The host reports one figure for a sub-agent.
6. **Mid-run status lines are set only when they differ**, rather than at fixed points.

### Defects in the script found while inventorying it

Each is recorded so porting does not copy it. None was fixed in the script, which is being retired.

- It dereferences its resume snapshot before the null check.
- The registry step has no post-condition.
- QA, the census and the ship report have no fast-forward, so a relaunch after a pause there dispatched
  the hunt and the census again.
- A relaunch after an L3 pause never re-read the answer, so an answered `stop` was ignored.
- Spike results, QA findings and the refutation overturns lived in memory and were lost on relaunch.
- The census's `cannot-ship` aborts before GATE H on the main path and after it on a breaker, and the L4
  `hold` closes `aborted` on one path and `escalated` on the other. `probe next` reproduces both.

## To finish the plan

1. Trust `.plan-runs/consumer-todo` (or any consumer folder), then run the example pitch through
   `/ship --unattended` with the `ci` answer set. The A1 done-when is: `legs.jsonl` holds only worker rows,
   no courier, no relaunch. The consumer folder is gitignored and already carries the install and a pitch.
2. If it ships, A2 to A6 proceed in the order the plan gives, each green before the next, with the 37
   script-reading files ported to `probe next`, the kernel or hook fixtures.
3. A5's kill-and-resume probe, A8's measurement and A9's nested-session check each need a real session.
