# v4 requirements

The registry v4 is planned and judged against. See [`README.md`](README.md) for method and rules.

## Columns

| Column | Meaning |
|---|---|
| **ID** | `V4-REQ-<n>`, assigned once, never reused |
| **Requirement** | one atomic clause, stated as an outcome a user or maintainer can observe |
| **Source** | the `analysis/NN-topic.md` file that produced it |
| **Priority** | `must` · `should` · `could` — relative to the v4 bet, not to the backlog |
| **Status** | `proposed` · `accepted` · `rejected` · `deferred` · `superseded` |
| **Decided** | date and who (PO) moved it out of `proposed`; blank while proposed |

## Registry

| ID | Requirement | Source | Priority | Status | Decided |
|---|---|---|---|---|---|
| V4-REQ-1 | Every kernel module is classified in its header as witness, memory or projection, and the structural suite checks the classification against a list, so a module whose class is unknown cannot ship | [`analysis/03`](analysis/03-what-the-kernel-is-for.md) | should | proposed — not implemented | |
| V4-REQ-2 | Every agent a run spawns carries a recorded reason to exist: it reads far more than it returns, it does independent or parallel work, or it needs a tool the loop cannot hold. Work with none of the three stays in the run loop's own window. | [`analysis/02`](analysis/02-single-agent-loop.md); low level in [`README.md`](README.md#v4-req-2--low-level) | should | accepted (narrowed: `coverage` + `analyze`) | 2026-11-07, PO, by setting the implementation goal |
| V4-REQ-3 | Every agent a run spawns has a row in the run's leg ledger naming its worker and duration; a run has no agent its own records cannot see | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-4 | A gate is answered in the session that reached it; no relaunch and no fast-forward follow a PO's answer, and the gate row still carries its source | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-5 | Opening a run needs no permission beyond the kernel's two Bash rules: the installer adds no `Workflow` token, and no copy of the orchestrator is staged into the project | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-6 | Every kernel subcommand that ships has a runtime caller; one with none is removed in the same release that finds it | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-7 | A run killed at any point resumes by invoking `/ship` again; the resume point is read from artifacts on disk and from nothing else | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-8 | The run's leg ledger carries tokens and cost per leg | [`review`](review-2026-11-07-single-loop.md) §8 | should | proposed | |
| V4-REQ-9 | The published install URLs keep resolving and delegate to the installer | [`review`](review-2026-11-07-single-loop.md) §8 | should | proposed | |
| V4-REQ-10 | Each hook's release notes carry its deny count over the archived runs; a hook at zero across them is named as an ablation candidate at the next model upgrade | [`review`](review-2026-11-07-single-loop.md) §8 | could | proposed | |
| V4-REQ-11 | Wire and map-scopes produce their committed artifacts from the same context as coverage and analyze — *after* the handoff trace `analysis/02` question 3 asks for | [`review`](review-2026-11-07-single-loop.md) §8 | could | proposed | |
| V4-REQ-12 | A projection module ships only with a named reader in a skill or a command; one with none is removed in the release that finds it (narrows V4-REQ-6 from "has a caller" to "has a reader") | [`analysis/03`](analysis/03-what-the-kernel-is-for.md) | should | proposed — holds at 2026-11-08: the projections left (`reduce hill`, `probe requirements`) each have a named reader | |
| V4-REQ-13 | A with/without run of the decision engine — `probe next` replaced by a listing of open and closed artifacts the loop reads — on one pitch, one model, one date, two reps, held to the kit's "holds" rule | [`analysis/03`](analysis/03-what-the-kernel-is-for.md) | could | proposed — measured on envlint: A shipped 2 of 2, B 0 of 1 with a 59 % higher cost; the engine was kept (execution-native-first, S3) | |
| V4-REQ-14 | The shipped executable set is at most one script with at most four subcommands (`t0`, `gate`, `fence`, `init`) and two hooks; a module outside that list is removed, not added | [`analysis/04`](analysis/04-native-harness.md) | must | proposed — not met: 24 subcommands and 4 hook registrations (execution-native-first) | |
| V4-REQ-15 | Every worker is a plugin subagent definition with `tools`, `model` and `skills` declared; the loop dispatches by agent name and reads the result file the worker wrote | [`analysis/04`](analysis/04-native-harness.md) | must | proposed — implemented in S2; the loop dispatches by agent name and the worker writes its own result | |
| V4-REQ-16 | Destructive-command and secret-read protection is a `permissions.deny` block the installer writes, not a hook, verified by executing the host against it | [`analysis/04`](analysis/04-native-harness.md) | should | proposed — not done: `safety-spine` kept (it is the Bash audit trail); PO decides | |
| V4-REQ-17 | A structural test either executes a shipped script against a fixture or validates a shipped manifest; a test that asserts on prose is removed, and prose parity is the maintenance audit's job | [`analysis/04`](analysis/04-native-harness.md) | must | proposed — applied to eight wording-only sections; the suite is not reduced to the plan's shape | |

## Open questions

Questions that block a requirement from being written atomically. Each becomes an
`analysis/NN-topic.md` file, then leaves this list.

From [`analysis/01-rent-or-own-the-harness.md`](analysis/01-rent-or-own-the-harness.md):

- ~~Which parts of the plugin re-implement what the host tool now does itself?~~ answered in [`analysis/03`](analysis/03-what-the-kernel-is-for.md)
- Does any hook, gate or worker skill have a with/without ablation on record?
- Does the run export hold pass^k across repeated runs and per-run cost?
- What does the decision ledger guarantee against rewriting — and is that enough for an audit log?

From [`analysis/02-single-agent-loop.md`](analysis/02-single-agent-loop.md):

- Which of the kit's three criteria can the run export hold evidence for, per worker? (Tokens read have no source.)
- Can one with/without comparison of the planning chain be run and held to the kit's rule: one model, one date, at least two reps?
- Does the planning chain lose anything at its handoffs — an id, a clause, a seam?
- Does a token or cost axis belong beside `round_budget`, `attempt_budget` and the wall clock?
- Does any skill have a retirement trigger at a model upgrade?
