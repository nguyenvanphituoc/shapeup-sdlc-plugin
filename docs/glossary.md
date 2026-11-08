# Glossary

The twelve terms you need to *use* the harness are in the
[README's glossary table](../README.md#glossary). This page repeats those and adds the
internals — the vocabulary you only need if you are extending the harness rather than running
it.

## Terms you meet while running it

| Term | In plain English |
|---|---|
| **board** | The round's task list. "Green" means every task is done. GATE L2's hook reads this before an evaluation and warns if it is not green. |
| **round** | One build → evaluate cycle. A FAIL verdict starts round *r+1*. |
| **T0** | The smoke test a scope must pass before it counts as built: its fixtures + a DB probe. Writes an artifact to disk that the evaluator must cite. |
| **substrate** | The exact list of files one dispatch is allowed to write, stamped into its work order. A hook blocks anything outside it — and anything the order marks frozen. |
| **scope contract** | The file defining one vertical slice: its substrate, its fixtures, its affordances. |
| **affordance** | The thing a user can actually click, type or call. UI is graded on affordances, not on looks. |
| **hill / hill phase** | How much of a scope is still *unknown* versus merely *unfinished*. The Scout reports a signal at orient; nothing derives it after that. |
| **gate (L0–L4)** | A numbered checkpoint in a run. Most pause for you; GATE L2 is the one a hook observes and reports on. |
| **covers-closure** | Every requirement clause has at least one task claiming to cover it. Nothing silently drops. |
| **wiring reachability** | Every engine has a call site reachable from the app's real entry point. Catches "built, but never wired up". Reports itself unchecked, with a reason, when the import walk cannot be rooted — an unfollowable import, or no reachable engine to control it. |
| **discovery ledger** | The one file everything found mid-run gets written to, so nothing is lost between rounds. |

## Shape Up terms

Inherited from [*Shape Up*](https://basecamp.com/shapeup); the harness uses them with their
original meanings.

| Term | In plain English |
|---|---|
| **appetite** | How much time the work is *worth*, decided before the design. The opposite of an estimate. |
| **shaping** | Roughing out a solution at the right level of abstraction — concrete enough to build, loose enough to leave room. |
| **breadboarding** | Sketching a flow as places, affordances and connections, with no visual design. |
| **pitch** | The shaped write-up that goes to the betting table: problem, appetite, solution, rabbit holes, no-gos. |
| **betting table** | Where a human decides what gets built this cycle. Rejected pitches go back to raw ideas; nothing is a backlog. |
| **hill chart** | The picture of *figuring out* versus *doing*. Shape Up's own; this harness no longer renders one. |
| **scope hammer** | Ship-time triage: cut scope to hit the appetite rather than slip the date. Compare against the baseline, never against the ideal. |
| **rabbit hole** | A part of the problem that could swallow the whole appetite. Named in the pitch so it can be avoided or spiked. |

## Internals (for contributors)

You should not need these to use the harness. They exist to make the guarantees above
mechanically true rather than aspirational.

| Term | In plain English |
|---|---|
| **work order / work result** | The JSON envelope every worker receives and returns. Workers are stateless: everything they used to write into shared files, they now return as data. |
| **envelope port** | The dispatch path — the loop writes the order, a `PreToolUse` hook validates it against a schema, the loop checks the result against the result schema and applies it. |
| **resume** | How a run finds its place again: `/ship` over an open run reads the next phase off the files on disk, never from stored status or the conversation, so a killed session picks up where it died. |
| **single writer** | The loop performs *every* board and ledger write, so parallel scopes cannot corrupt shared state. |
| **pure worker** | A skill containing craft only, with zero pipeline knowledge — it cannot know or care where it sits in a run. |
| **zero-memory handoff** | Each build attempt is a fresh subagent that sees only what the order put in the envelope, never prior chat. |
| **traceability spine** | The three committed artifacts (`requirements.md`, `wiring-map.md`, `project-profile.md`) that the board review and the evaluator read: the requirement registry for covers-closure, the wiring map for the seam each use case attaches through, and the profile for the build and launch probes. |
| **substrate disjointness** | The rule that no two scopes may write the same file — what makes parallel building safe. The loop reads the contracts for it before releasing scopes together. |
| **circuit breaker** | Two nested retry budgets — an outer one on rounds, an inner one on per-scope T0 attempts —  An exhausted scope queues a cut proposal rather than blocking the round; every other exhaustion routes to the ship gate so whatever is green still ships. |
| **discovered task** | Anything found mid-run that is not in the current spec. It goes to the ledger, never silently into the build. |
| **knowledge base** | Committed per-reader guideline files written by `/retro` from your feedback (or by `/retro --scan` from the project on disk, or `/retro --research <stack>` from the platform's official documentation, every rule confirmed by you), read back by the three coachable workers (`task-executor`, `orient`, `qa-edge-hunter`) on their next run, by the planning step at each plan step, and by the loop at GATE L0. Guidance only: it never decides a gate. |

## Naming conventions

| Pattern | Meaning |
|---|---|
| `UC-NN` | Use case |
| `TASK-NNN` | A task on the board |
| `TS-*` | A row in the Test Surface |
| `TS-INV-NN` | A Test Surface row created by a newly discovered invariant |
| `GATE L*` | An orchestrator gate (L0 intake → L4 ship sign-off) |
| `GATE H` | The stop census and cut list |
| `GATE COACH-1` | The retro's categorization question |
| `~` | A QA finding that does not block ship |
