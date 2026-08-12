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

### HD-007 — the only post-cutover lane cannot start headlessly, and nothing says so

**Filed:** 2026-08-12, from the Stage C / A7 benchmark run (`docs/migration/stage3-evidence.md` §7.5).
Not from L4 feedback — from six paid benchmark reps in which the lane never once executed.

The cutover (D1–D4) deletes the prose orchestrator and makes the `Workflow` lane the only lane for
scoped specs. **In a headless session that lane cannot start.** Every `Workflow` tool call is denied
with `Review dynamic workflow before running`, which requires an interactive confirmation a
`claude -p` run cannot give.

**Reproduced minimally, outside the benchmark, on a three-line workflow script:**

| `--permission-mode` | result |
|---|---|
| `acceptEdits` | **denied** — "requires interactive confirmation that isn't available in this session" |
| `bypassPermissions` | **launches**, returns `{"ok":true}` |

**The plugin documents this nowhere.** There is no `Workflow` permission string anywhere in the
repository; `npx shapeup-sdlc init` writes Bash allowances only; `docs/upgrading.md` names only
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` as a headless requirement. A user who follows the documented
install and runs unattended gets a lane that silently does not start.

**What happens instead is worse than a crash.** Measured across three candidate reps: the agent
falls back to improvising. Once it hand-built the feature with no receipt at all (scored 14/14 by the
oracle, `harness_unreachable` by the run-evidence check); once it emulated the pipeline by hand
through `Skill`/`Agent`/`Bash` and reached gate L4 with a valid receipt — while `shapeup-run.js`
never ran. **A receipt therefore does not prove the lane ran.**

**The fix this defect is filed for:** `init` writes the permission the lane needs (or the ship
command detects that `Workflow` is unavailable and fails loudly at L0 instead of degrading), and
`docs/upgrading.md` states the requirement beside the print-wait ceiling. Failing closed matters more
than the documentation: a lane that cannot start should stop the run, not quietly hand the work to an
improvising agent.

---

### HD-008 — `gate-zerowork`'s "work by other means" swallows the case the gate exists for

**Filed:** 2026-08-12, from the same run (A7 candidate rep 1).

AGENTS.md states the invariant: *"a session that dispatched the orchestrator and left no receipt is
blocked at `Stop` by `hooks/gate-zerowork.mjs`"*, and names what it prevents — *"the orchestrator
describing its own pipeline in future tense and stopping — measured at 29% acceptance with 10 escaped
defects while reading like a clean run."*

**Measured, candidate rep 1.** `Skill(tech-lead)` was dispatched. No receipt was written. The hook
**allowed** the Stop:

```
gate-zerowork Stop null allow | 37 work calls — the session did work by other means
```

The escape hatch is doing exactly the opposite of the invariant: an orchestrator dispatch that
produced no run is *precisely* the case, and doing 37 unrelated edits is what a degraded session
looks like, not an exemption from the check. The run ended reading like a clean one.

**The fix this defect is filed for:** once the orchestrator has been dispatched, work-by-other-means
stops being an acquittal — the absence of a receipt is the finding. The `dispatchedOrchestrator`
branch and the work-call branch need to be ordered, not OR-ed.

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
