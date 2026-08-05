# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Defects

*(none open)*

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
