# Ship — the ship report

| Contract | |
|---|---|
| Phase | `14` |
| Order | `none` |
| Gate | `L4` |
| Done when | `<spec>REPORT.md` exists |

## The ship report

After GATE H and before GATE L4, write `shapeup/<slug>/REPORT.md` — frozen at L4, committed, so it carries no run-trace path and no board id
(cite use cases and scope ids instead; the fence refuses the write otherwise). Its first line says what this is: **a ship is not a pass**, so
a shipped FAIL opens with `Shipped over a FAIL verdict, with the cut list below`, never with the title alone. Then:

- **Outcome** — the verdict, rounds used and judged, tasks done of planned, whether QA ran, did not run, or ran and drove nothing, and the
  models: per role, what the launch record asked for and what the dispatch receipts (`<run>/receipts/dispatch.jsonl`, `usage.model`) name as
  having run. Where the two differ, say so here: a cost or a verdict read against the wrong model is a figure about a different run.
- **Verification** — one row per scope from its latest trial: fixtures passed of total, regressions, trials, last status.
- **Requirements** — one row per registered clause: its source, the covering criterion, its verdict. A projection, never a verdict; none of it blocks the ship.
- **The cut list and the known gaps** — every cut the PO accepted, and every ship-blocking item the PO overrode.
- **What did not finish** — the unfinished tasks by use case. A run launched with `noEval` says nothing was evaluated and never reads as verified.

Every figure is read off a file you opened in this step. A report written from memory of the run is the failure this section exists to prevent.

A write the fence refuses names a live order: a dead session left a dispatch open. That is dead work, not yours to
answer — say so to the PO (`init run --force` answers every open order and discards the round history; only the PO
asks for it).
