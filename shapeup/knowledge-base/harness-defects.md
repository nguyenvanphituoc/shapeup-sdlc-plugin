# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Defects

### HD-006 — the WorkOrder does not say where the WorkResult goes

**Filed:** 2026-08-11, from the Stage A3 kill/resume probe (`docs/migration/stage-a3-plan.md`
Finding 3). Not from L4 feedback — from two consecutive dispatches failing in the field.

A compiled WorkOrder carries `order_id`, `substrate` and `payload`, and **nothing that names the
result file**. Every worker SKILL.md documents the convention in prose
(`.shapeup/<slug>/results/<order-suffix>.json`), so each worker derives the path itself — while its
own order's `substrate.allowed` names a directory that does not contain that path (e.g. `orient`'s
allowed list is `.shapeup/<slug>/orient/**`).

**Measured, two consecutive ORIENT dispatches, same order, two different failures:**

| leg | what the worker did | what the run did |
|---|---|---|
| 1a | wrote `results/orient.json` correctly, reported a **directory** as `result_path` | aborted at ORIENT, `EISDIR` |
| 1b | wrote all four orient artifacts, **no result file at all** | aborted at ORIENT, `ENOENT` |

Both times the craft was done and the phase was thrown away. A convention carried in prose is a
guess the port is asking each worker to make independently.

**Worked around, not fixed** (`shapeup-run.js` / `shapeup-build-round.js`): the dispatch prompt now
states the exact path, and the pipeline derives the same one from the order rather than trusting the
report. That closes the failure for the workflow lane only.

**The fix this defect is filed for:** `result_path` becomes a field of the WorkOrder, written by
`compile-order.mjs`, declared in `domain.schema.json`, included in each operation's
`substrate.allowed`, and read by every worker instead of derived. It touches every worker's input
contract, which is why it is a bet rather than a patch.

---

**Where a closed defect goes.** Its fix is pinned by a regression guard, and that guard is the
durable record — a defect whose test fires on reversion cannot come back silently, which is more
than a paragraph in this file could ever promise. HD-001…HD-005, the family in which *the committed
contract format fails silent*, closed 2026-08-04/05: pinned by structural §46(f)(g)(h)(i) for the
parser and §23 for the two call sites §46 does not reach, every one mutation-verified in both
directions. What they cost and what they taught is written up once, in
[`evals/DAY1-REPORT.md`](../../evals/DAY1-REPORT.md) and
[`docs/internal/plan/ratchet-and-receipt-plan.md`](../../docs/internal/plan/ratchet-and-receipt-plan.md) §5.

This file stays short on purpose. It is a queue, not an archive.
