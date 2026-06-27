# Verdict Ledger — re-probe, confidence, and flip detection

Read this at GATE V2 (alongside `anti-leniency.md`) and act on it at Phase B. It exists because
the judge is the harness's least verifiable component: a single non-deterministic snapshot per
criterion, no second opinion, no record of whether last round's PASS would still pass. This turns
that blind oracle into a **measurable** one — without adding a second judge (the single-judge
invariant is untouched). Three mechanisms: **re-probe on FAIL**, **per-criterion confidence**, and
an append-only **verdict ledger** that flags when a criterion's verdict flips across runs.

This is a self-contained procedure: you append and read a JSONL file with your normal file tools
and reason over it. It calls no external script.

---

## 1. Re-probe on FAIL (within a run)

Before you finalize a `FAIL` at GATE V2, run that criterion's probe **once more** (same probe,
fresh invocation). This costs one extra probe per failing criterion and catches the two ways a
single snapshot lies:

- The two probes **agree** (both FAIL) → the failure is real. `confidence: high`, `reprobed: true`.
- The two probes **disagree** (one PASS, one FAIL) → the signal is *flaky*, not a clean defect.
  Record `verdict: FAIL` still (absence of a stable pass = FAIL), but `confidence: low`,
  `reprobed: true`, and say so in the evidence ("probe non-deterministic: 1 PASS / 1 FAIL across
  2 runs — flaky or environment-dependent"). A flaky criterion is itself a finding the generator
  must stabilize, not a clean pass.

Re-probe only FAILs (and any PASS you have specific reason to doubt) — re-probing every PASS
doubles cost for little signal. Deterministic oracles (`process`/`test`/`data`/`[cmd]`) rarely
flip; `[ui]` snapshots flip most, so weight re-probing toward them.

## 2. Per-criterion confidence

Every criterion verdict carries a confidence, assigned by this rule (do not free-form it):

| confidence | when |
|---|---|
| `high` | deterministic oracle (`process`/`test`/`[cmd]`/`[data]`) **or** a re-probe that agreed |
| `medium` | a single deterministic probe you did not re-probe (most PASSes) |
| `low` | re-probe disagreed (flaky), **or** a `[ui]`/`snapshot` read with any ambiguity, **or** the verdict flipped vs the prior run (§3 sets this for you) |

Confidence is reported, never overrides the verdict: a `low`-confidence FAIL is still a FAIL. It
tells the PO and the generator *how much to trust this row* and where re-running would help.

## 3. The verdict ledger (across runs)

**File:** `.shapeup-sdlc/<slug>/evaluation/.verdicts-<task_id>.jsonl` — append-only, one JSON
object per criterion per run. Never rewrite prior lines; the history is the point.

```json
{"run":1,"task":"TASK-007","dimension":"spec-conformance","criterion":"AC4","verdict":"FAIL","confidence":"high","reprobed":true,"flip":false,"evidence":"Pay click throws — Pay.tsx:84","at":"2026-06-27T10:00:00Z"}
```

Required keys: `run` (1-based, increment per evaluator invocation on this task), `task`,
`dimension`, `criterion`, `verdict` (`PASS|FAIL`), `confidence`, `reprobed` (bool), `flip` (bool),
`evidence`, `at` (ISO-8601).

**Procedure at Phase B (before writing the report):**
1. Read the existing ledger if present. Determine this run's number = (max prior `run`) + 1, else 1.
2. For each criterion you graded this run, find its **most recent prior line** (same `criterion` +
   `dimension`). If one exists and `prior.verdict !== this.verdict`, set `flip: true` and force
   `confidence: low` (a flip means the oracle is unstable for this row, whatever you thought).
   Otherwise `flip: false`.
3. Append one line per criterion.
4. Surface every `flip: true` in the report (§4) — a flip is a calibration finding, not noise.

A flip is **PASS→FAIL** or **FAIL→PASS** for the same criterion across runs with no intervening
code change to that area. PASS→FAIL after the generator fixed an unrelated bug, or FAIL→PASS after
a targeted fix, is *expected* — note the cause. An *unexplained* flip means the judge is
non-deterministic on that row and the PO should not trust a single verdict there.

## 4. Reporting

Add to the EVAL report (see `report-schema.md`), after the per-dimension tables:

```
## Verdict stability (run 3)
- ⚠ AC4 — FLIP PASS→FAIL vs run 2, no code change to checkout → judge non-deterministic here; confidence low. Re-run before trusting.
- AC2 — stable FAIL across runs 1–3 (confidence high).
- Stability: 6/7 criteria stable this round.
```

If there are no prior runs, print `Verdict stability: first run — no history yet.` and still write
the ledger so the next run has a baseline.

## Why this stays single-judge

Nothing here adds a second grader or a knowledge base that could become a covert judge. Re-probe is
the *same* judge running the *same* probe twice; confidence and flips are bookkeeping over that one
judge's own outputs. The verdict authority is unchanged — this only makes its reliability visible.
