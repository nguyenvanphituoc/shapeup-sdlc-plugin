# `eval-planted-bug-2` — the three-defect judge fixture

The successor to [`../eval-planted-bug`](../eval-planted-bug), and it exists because that one had
no headroom. `spec-evaluator` was measured against it twice, on two models, and its revision loop
**never executed** — every run approved on round 1. An instrument that only separates *correct*
from *broken* cannot show a quality improvement, which is what Day 1's rung actually asks for.

## What is planted, and why each one is here

| | Defect | Reachable by | Why it is here |
|---|---|---|---|
| **BUG 1** | `todo done 99` exits 0 in silence instead of refusing non-zero (INV-04) | any probe, no store file needed | the obvious one — an evaluator that runs each command once finds it |
| **BUG 2** | `todo rm 2-3` splices in ascending order, so the second removal shifts and it deletes `b` and `d` instead of `b` and `c` (INV-03) | **only** a probe against a seeded four-item store | the one that separates judges |
| **BUG 3** | `add` stores and echoes the text **untrimmed** — `text.trim()` is used only to test for emptiness, never to produce the stored value (INV-06) | any probe — but only if you know what INV-06 says | the one you cannot grade from the probe alone |

BUG 3 was added after v3 of this fixture ceilinged at 1.0, three runs out of three. The first two
defects are both reachable by *probing*, and probing is the one thing this skill will not skip —
v3's runs wrote repro commands complete with heredocs and store seeding. So the arm this fixture
was missing is not a harder bug; it is a bug **whose correct verdict is not derivable from the
probe**. `INV-06` is not in `UC-01.md`. It lives in [`spec/invariants.md`](spec/invariants.md), an
amendment file the use case defers to by reference, and TS-08's Expect column cites it rather than
restating it. Run the probe and you see `exit 0` and the text you passed in; the defect is sitting
in plain sight *inside the evidence line the judge has to write down* — `added:   write the pitch  `
— and it still reads as a pass unless the judge went and read what the row cites.

Every other row of the Test Surface passes against a store file that does not exist, and
`build/todo.test.mjs` is green **because every case in it runs on a fresh install** — so it cannot
reach the batch-removal path at all. The task ships with all eight acceptance boxes ticked.

A judge that defers to the green suite and the ticked boxes approves. A judge that runs each
command once catches BUG 1 and misses BUG 2, which reads like diligence. Only a judge that probes
each row **the way the row is written** catches both of those — and neither of them is BUG 3.

This is not a trick: `spec/usecases/UC-01.md`'s Test Surface states the seeded store and the exact
expected remaining list for TS-06. Every graded row traces to a line of the spec, which is the rule
`docs/internal/plan/ratchet-and-receipt-plan.md` §0 binds every fixture to.

## The last arm — the question the spec does not answer

`archive` on a store with **zero** done items. UC-01 supports two incompatible readings and the
Test Surface has no row for it. The contract is to **raise** it (`escalates[]`, kind
`spec-ambiguity`), not to settle it. Choosing an answer and grading against that choice is the
confident-wrong move, and it looks like thoroughness.

## Ground truth

`todo.contract.json` is the machine-readable form of UC-01's Test Surface. Run it directly — no
Claude auth, no spend:

```
node oracles/process-oracle.mjs examples/eval-planted-bug-2/todo.contract.json \
     "node $PWD/examples/eval-planted-bug-2/build/todo.mjs"
```

TS-04, TS-06 and TS-08 FAIL; the other five PASS. That report is what
`evals/oracles/verdict-rows.mjs` grades a judge's `verdict.json` **against** — one row per
Test-Surface row, passing when the judge's verdict matches what the build actually does. False-FAIL
costs exactly as much as false-PASS, which the nine hand-authored criteria of the previous rubric
could not do.

> The contract file is deliberately **not** seeded into the eval workspace. It is the probes, and
> handing them over — including the seeded store — would remove the headroom this fixture exists to
> create. The prose table is the spec, and it states everything a graded row needs.
