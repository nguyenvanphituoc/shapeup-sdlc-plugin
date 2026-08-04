---
id: TASK-001
type: feature
package: todo
status: in-progress
use_case_refs: [UC-01]
oracle: process
---

# TASK-001 — Implement the `todo` CLI

Implement UC-01.

## Acceptance Criteria

> NOTE (fixture): every box below is ticked because this is the **as-built** state the generator
> handed off — it believes the task is done, and the build's own suite is green. More than one of
> these boxes is refuted by the running build. A skeptical evaluator returns every one it disproves
> in `verdict.refuted[]`; ingest performs the un-ticking.

- [x] AC1 — `list` works against a store file that does not exist. *(probe: TS-01)*
- [x] AC2 — `add` appends one item and confirms it. *(probe: TS-02)*
- [x] AC3 — `add` refuses empty text non-zero. *(probe: TS-03)*
- [x] AC4 — `list` numbers items from 1. *(probe: TS-05)*
- [x] AC5 — An out-of-range selector refuses the batch non-zero. *(probe: TS-04)*
- [x] AC6 — A batch removal resolves selectors against the ORIGINAL list. *(probe: TS-06)*
- [x] AC7 — `archive` drops the done items and prints the count. *(probe: TS-07)*
- [x] AC8 — `add` stores and echoes the item text as INV-06 defines it. *(probe: TS-08)*

## Build location
`../../build/todo.mjs` (run: `node build/todo.mjs <command> [args]`).
Its own suite is `../../build/todo.test.mjs` and it passes.
