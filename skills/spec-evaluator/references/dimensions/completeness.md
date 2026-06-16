---
id: completeness
title: "Spec completeness"
enabled: false
weight: 1.0
hard_threshold: no-critical
applies_to:
  lens: [lite, standard]
  package: any
  variant: any
requires_browser: false
---

# Completeness Dimension

> **Auto-enable rule (read at GATE V0.5):** This dimension stays `enabled: false` by
> default so it is a no-op on every spec generated before `ba-pitch-analyzer` v2.8.
> The core flips it ON for a run **only when** the spec's `usecases/` contains at least
> one `## Invariants` section. A pre-v2.8 spec has no invariants → this dimension never
> activates → existing audit scores and verdicts are unchanged (non-regression guarantee).
> An explicit `--dimensions ...,completeness` always wins over the auto rule.

**Why this exists.** `spec-conformance` answers *"does each task pass its acceptance
criteria?"* — it grades the tasks that exist. It cannot see the task that was never
written. Shape Up's discovered-task philosophy says the real bulk of work is found while
building; an invariant declared on a UC but never backed by a regression task is exactly
that blind spot. This dimension converts "absence of a task" from invisible into a graded
**GAP** — the judge surfaces it; the generator (`ba-pitch-analyzer --tasks-only`) fills it.
Judge never fills it itself.

**Distinction held:** conformance = *the tasks that exist are correct*; completeness =
*the tasks that must exist, do exist*. A spec can be 100% conformant and still incomplete.
Definition of Done for the harness = conformance PASS **and** completeness no-critical.

---

## Criteria

- id: CMP-1
  statement: "Every `[INV-NN]` declared in any usecases/UC-*.md ## Invariants section is backed by ≥1 task whose use_case_refs points to that UC AND whose AC references the invariant (by INV id or its assertion)."
  probe: static
  evidence_required: true
  pass_rule: >
    For each INV-NN found across usecases/: a task backs it only if BOTH hold — (a) the
    task lists that UC in use_case_refs, and (b) the task names the invariant unambiguously,
    i.e. cites the INV id (e.g. "INV-02") or links the UC's #Invariants anchor AND its AC
    restates that specific assertion as a command/observable check. Matching a loose keyword
    shared by several invariants is NOT sufficient — require the INV id or a 1:1 assertion
    match to avoid crediting one task for an invariant it does not actually test. Zero
    uncovered invariants → PASS. Any invariant with no backing task → FAIL at `critical`
    severity (a missing must-have regression, not a cosmetic gap).
  source: code

- id: CMP-2
  statement: "Every use case has ≥1 task referencing it (no UC stranded with related_tasks but zero tasks pointing back)."
  probe: static
  evidence_required: true
  pass_rule: >
    For each usecases/UC-*.md: ≥1 task file lists it in use_case_refs. A UC with zero
    referencing tasks → FAIL at `critical` (this is the Coverage 🔴 condition, re-checked
    from the evaluator side as a completeness gap rather than trusting synthesis alone).
  source: code

- id: CMP-3
  statement: "Discovery ledger surprise rate is within a healthy band (shaping-quality signal)."
  probe: static
  evidence_required: false
  pass_rule: >
    If a discovery ledger exists (discovery/ledger.md or a *discovered-tasks*.md whose
    feature matches run-state.feature), count discovered items marked `[+]` vs imagined
    `[ ]`. surprise_ratio = discovered / (imagined + discovered). PASS (no defect) when
    ratio ≤ 0.5. When ratio > 0.5 → emit a `minor` finding "high surprise rate —
    shaping may have under-specified scope; flag to PO", NOT a critical. evidence_required
    is false, so a spec with no ledger simply yields no CMP-3 finding (not a FAIL).
  source: code

---

## Threshold

`no-critical` — `critical` FAILs (CMP-1 uncovered invariant, CMP-2 stranded UC) block the
dimension. `minor` findings (CMP-3 high surprise) are reported but do not fail the
dimension. This keeps the gate honest about *missing must-have work* while treating the
surprise signal as advisory feedback to the PO, not a build blocker.

Rationale for `no-critical` rather than `all-pass`: CMP-3 is a deliberately non-blocking
signal. Using `all-pass` would let an advisory surprise-rate note sink the verdict, which
would punish healthy discovery — the opposite of the intent.

---

## Bug template

```
severity: [critical|minor]
criterion: [CMP-1|CMP-2|CMP-3]
location: [usecases/UC-Name.md#Invariants INV-NN | usecases/UC-Name.md | discovery/ledger.md]
repro: <how the gap was detected — e.g. "grep use_case_refs across tasks/ found 0 backing TASK for INV-02">
expected: <e.g. "≥1 regression task referencing UC-ConnectObjects covering INV-02">
actual: <e.g. "no task references INV-02; invariant declared but unverified">
next: <handoff — e.g. "ba-pitch-analyzer --tasks-only --from-discovered <ledger> to generate the missing regression task">
```
