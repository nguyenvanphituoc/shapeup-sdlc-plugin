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

