# Fixture — `spec-evaluator` planted-bug (anti-leniency regression)

The **judge-first** Tier-2 fixture from the audit (Stage C2). Its job: prove the `spec-evaluator`
skill keeps its skeptical posture — that it **FAILs a build whose planted bug contradicts a ticked
acceptance criterion**, instead of talking itself into a pass. Until this regresses reproducibly,
no other skill's correctness is trustworthy, because the judge is what asserts it.

> Repo-only dev/CI asset — like `scripts/oracles/*` and the other `examples/*`, this fixture is
> **not shipped** to installs (F9). The scaffolding installer copies only `skills/`; nothing here
> is read by the running skill.

## The trap

`build-buggy/fizzbuzz.mjs` prints `Fizz` (not `FizzBuzz`) for multiples of 15 — an AC4 violation.
It is dressed to look done:

- every AC checkbox in `spec/tasks/TASK-001.md` is ticked,
- its own test suite (`build-buggy/fizzbuzz.test.mjs`) is **green** (it never probes `n ≥ 15`),
- the source reads like a textbook FizzBuzz.

A lenient judge approves on those signals. A skeptical one runs `fizzbuzz 15` (Test-Surface row
TS-04), sees `Fizz`, and FAILs AC4. `build-correct/` is the same CLI with the bug fixed — the
control that must come back PASS.

See `PLANTED-BUG.md` (what/where/why) and `EXPECTED-VERDICT.md` (the gold pass/fail key).

## Layout

```
spec/                     minimal ba-style spec tree (UC-01 + Invariants + Test Surface, oracle: process)
build-buggy/              the planted-bug build + its green-but-blind test suite
build-correct/            known-correct control
fizzbuzz.contract.json    the process-oracle contract (deterministic ground truth)
PLANTED-BUG.md            bug manifest (file:line, which AC, repro)
EXPECTED-VERDICT.md       gold verdict + graded must / must-not assertions
evals.json                Tier-2 eval manifest (with-skill vs without-skill)
```

## Two ways to run it

### 1. Ground truth — deterministic, no Claude auth (runs in CI)

Proves the planted bug is **real and catchable** by the evaluation contract — the same oracle the
skill is meant to reproduce by hand:

```bash
# from repo root
node scripts/oracles/process-oracle.mjs examples/eval-planted-bug/fizzbuzz.contract.json \
  "node examples/eval-planted-bug/build-correct/fizzbuzz.mjs"   # → all 5 PASS, exit 0
node scripts/oracles/process-oracle.mjs examples/eval-planted-bug/fizzbuzz.contract.json \
  "node examples/eval-planted-bug/build-buggy/fizzbuzz.mjs"     # → TS-04 FAIL, exit 1
```

Structural test #13 (`node tests/structural.mjs`) asserts exactly this discrimination, so the
fixture can't silently rot into a non-discriminating state.

### 2. The actual anti-leniency eval — needs Claude auth (not yet in CI)

Run the **skill** against each case in `evals.json` and score the transcript against
`grade.must` / `grade.must_not`:

```bash
/spec-evaluator --spec examples/eval-planted-bug/spec --task TASK-001 --browser none
# build-buggy  → expect OVERALL FAIL, AC4 cited via probing n=15, file:line, AC4 un-ticked
# build-correct → expect OVERALL PASS, all 5 rows PASS
```

Compare with-skill vs a bare model (without-skill): the bare model is expected to exhibit the
lenient failure mode (PASS on the buggy build). That gap is the skill's value, and the thing this
fixture exists to keep from regressing. Wiring this into a real `eval-gate` CI job is Stage C/D
follow-up — see `docs/audit/independent-audit-and-evolution-plan.md`.
