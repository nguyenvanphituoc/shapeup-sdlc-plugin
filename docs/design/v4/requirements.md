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
| V4-REQ-2 | Every agent a run spawns carries a recorded reason to exist: it reads far more than it returns, it does independent or parallel work, or it needs a tool the loop cannot hold. Work with none of the three stays in the run loop's own window. | [`analysis/02`](analysis/02-single-agent-loop.md); low level in [`README.md`](README.md#v4-req-2--low-level) | should | accepted (narrowed: `coverage` + `analyze`) | 2026-11-07, PO, by setting the implementation goal |
| V4-REQ-3 | Every agent a run spawns has a row in the run's export naming its worker and duration; a run has no agent its own records cannot see | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-4 | A gate is answered in the session that reached it; no relaunch and no fast-forward follow a PO's answer, and the gate row still carries its source | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-5 | Opening a run needs no permission beyond the kernel's two Bash rules: the installer adds no `Workflow` token, and no copy of the orchestrator is staged into the project | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-6 | Every kernel subcommand that ships has a runtime caller; one with none is removed in the same release that finds it | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-7 | A run killed at any point resumes by invoking `/ship` again; the resume point is read from artifacts on disk and from nothing else | [`review`](review-2026-11-07-single-loop.md) §8 | must | proposed | |
| V4-REQ-8 | The export's `leg` table carries tokens and cost per leg | [`review`](review-2026-11-07-single-loop.md) §8 | should | proposed | |
| V4-REQ-9 | The published install URLs keep resolving and delegate to the installer | [`review`](review-2026-11-07-single-loop.md) §8 | should | proposed | |
| V4-REQ-10 | Each hook's release notes carry its deny count over the archived runs; a hook at zero across them is named as an ablation candidate at the next model upgrade | [`review`](review-2026-11-07-single-loop.md) §8 | could | proposed | |
| V4-REQ-11 | Wire and map-scopes produce their committed artifacts from the same context as coverage and analyze — *after* the handoff trace `analysis/02` question 3 asks for | [`review`](review-2026-11-07-single-loop.md) §8 | could | proposed | |

`V4-REQ-1` is left unassigned for the group from `analysis/01`.

## Open questions

Questions that block a requirement from being written atomically. Each becomes an
`analysis/NN-topic.md` file, then leaves this list.

From [`analysis/01-rent-or-own-the-harness.md`](analysis/01-rent-or-own-the-harness.md):

- Which parts of the plugin re-implement what the host tool now does itself?
- Does any hook, gate or worker skill have a with/without ablation on record?
- Does the run export hold pass^k across repeated runs and per-run cost?
- What does the decision ledger guarantee against rewriting — and is that enough for an audit log?

From [`analysis/02-single-agent-loop.md`](analysis/02-single-agent-loop.md):

- Which of the kit's three criteria can the run export hold evidence for, per worker? (Tokens read have no source.)
- Can one with/without comparison of the planning chain be run and held to the kit's rule: one model, one date, at least two reps?
- Does the planning chain lose anything at its handoffs — an id, a clause, a seam?
- Does a token or cost axis belong beside `round_budget`, `attempt_budget` and the wall clock?
- Does any skill have a retirement trigger at a model upgrade?
