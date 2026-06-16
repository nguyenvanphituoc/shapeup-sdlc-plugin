---
id: test-surface-conformance
title: "Test surface conformance"
enabled: false
weight: 1.0
hard_threshold: all-pass
applies_to:
  lens: [lite, standard]
  package: any
  variant: any
requires_browser: true
---

# Test Surface Conformance Dimension

> **Auto-enable rule (read at GATE V0.5):** stays `enabled: false` by default — a no-op on
> every spec generated before `ba-pitch-analyzer` v2.9. The core flips it ON for a run
> **only when** the spec's `usecases/` contains at least one `## Test Surface` section
> (fresh v2.9 spec, or a pre-v2.9 spec retrofitted via `--surface-only`). Pre-surface
> specs → never activates → existing verdicts unchanged (non-regression guarantee).
> Explicit `--dimensions ...,test-surface-conformance` always wins over the auto rule.

**Why this exists.** `spec-conformance` grades the AC that were written; it does not
*expand* them. The QA meeting (2026-06-11) located the gap: nobody systematically derives
the test matrix — boundary values, negative cases, error-code coverage, no-go breaches —
that the spec already implies. The BA now derives that matrix into each UC's
`## Test Surface` (D1 Invariants · D2 Error Cases · D3 Contract shapes · D4 No-gos,
mechanical-only); this dimension is the judge-side half: probe every derived row against
the running app. Judge probes; it never authors rows — a missing or thin Test Surface is
reported as a finding and routed back to `ba --surface-only`, never filled in here.

**Distinctions held:**
- conformance = *the AC that were written pass* · test-surface = *the matrix the spec
  implies passes* · completeness = *the tasks that must exist, do exist*.
- This dimension covers **derivable** tests only. Exploratory edges (concurrency, state
  interruption, cross-UC journeys, data residue) belong to `/qa-edge-hunter`, which runs
  post-PASS and reads this run's `EVAL-*.md` as its negative-space input — every TS row
  probed here is territory QA must NOT re-hunt. Recording probed rows in the report is
  therefore part of this dimension's contract, not optional logging.

---

## Criteria

- id: TSC-1
  statement: "Every row in every UC `## Test Surface` table passes its Probe with the stated Expect, evidence captured."
  probe: ui
  evidence_required: true
  pass_rule: >
    For each TS-* row across usecases/: execute the Probe via the handler its phrasing
    implies (API/data probes → cmd/data; screen-level → ui) and compare observed behavior
    to Expect. Side-effect clauses ("no side effect", "state unchanged") MUST be verified
    by a data probe, not assumed from the response code. Zero failing rows → PASS. Any
    failing row → FAIL at `critical` (a derived case the spec itself implies is broken).
    Rows whose probe cannot run (endpoint absent, screen unreachable) are FAILs, not skips
    — absence of evidence is a FAIL.
  source: code

- id: TSC-2
  statement: "The Test Surface is internally complete against its own sources: every [INV-NN] has a TS-INV-NN row; every Error Cases code has a TS-ERR-* row; rows cite D1–D4."
  probe: static
  evidence_required: true
  pass_rule: >
    Cross-check each UC: Invariants ↔ TS-INV rows, Error Cases codes ↔ TS-ERR rows, and
    every row's Source cites D1–D4. A UC with `## Test Surface` whose own sources are
    uncovered → FAIL at `major` with `next: ba --surface-only` (judge surfaces the gap;
    generator fills it — this dimension NEVER authors rows). A UC carrying the explicit
    empty-sources line passes TSC-2 vacuously. A v2.9+ spec UC with NO `## Test Surface`
    section at all → FAIL at `major`, same routing.
  source: code

---

## Threshold

`all-pass` — TSC-1 failures are correctness failures of behavior the spec itself derives;
leniency here is leniency on the spec. TSC-2 `major` findings also block (the surface must
be trustworthy before QA subtracts it as covered territory), but their fix is a `ba
--surface-only` re-run, not a build round — the bug template's `next:` field routes them.

---

## Bug template

```
severity: [critical|major]
criterion: [TSC-1|TSC-2]
location: [usecases/UC-Name.md#Test-Surface TS-ID | endpoint | screen]
ts_row: <the full row probed, verbatim>
repro: <probe executed — command / UI steps>
expected: <the Expect cell>
actual: <observed evidence — response, state, screenshot ref>
next: <TSC-1 → task-executor fix via tech-lead round r+1 | TSC-2 → ba --surface-only re-run>
```

## Report obligation (the QA handoff)

The EVAL report section for this dimension MUST list every TS row probed (PASS and FAIL),
keyed `UC-id / TS-id`. `/qa-edge-hunter` Phase Q1 subtracts exactly this list when building
charters — an unlisted probe is invisible to QA and will be wastefully re-hunted.
