---
type: hammer-report
feature: envlint
round: 2
gate: GATE H
generated_at: 2026-08-17
---

# GATE H — Scope Hammer — feature: envlint

## Trigger
Normal stop: all four scopes (`parsing-engine`, `rules-engine`, `cli-composition-root`,
`test-surface-suite`) hold green T0 citations for round 2 and EVAL round 2 returned PASS
(`.shapeup/envlint/evaluation/EVAL-FEATURE-envlint.md`). The two `hammer_proposals`
(`cli-composition-root`, `test-surface-suite`) reflect the round-1 defect (missing
`test-surface.test.mjs`, T0 gaps) — resolved in round 2, no longer open.

## GATE H0 — Census
Must-have (unresolved)  : 0 — no unresolved scopes; no ledger item traces to a stated
                           invariant that fails the baseline test (see H1).
Nice-to-have (~)        : 3 — QA-001, QA-002, QA-003 (all `~`, `.shapeup/envlint/qa/hunt-report.md`
                           and `.shapeup/envlint/discovery/ledger.md`)
Carry candidates        : none — no scope left uphill/downhill; no attempt-budget overflow
                           (all scopes resolved at attempt 1 each round; `t0/trials.jsonl`
                           shows 6 trials total, no exhausted-budget scope)

Item detail:
- QA-001 [UC-01] unrecognized argv flag before the envfile arg silently consumes the real
  envfile path as the flag's value — severity-hint: ux-degradation. NICE-TO-HAVE: degrades UX
  for a malformed CLI invocation, does not contradict a stated invariant.
- QA-002 [UC-01] a non-object schema rule value (e.g. `"int"` instead of `{"type":"int"}`)
  silently disables checking for that key — severity-hint: boundary-breach. NICE-TO-HAVE:
  malformed schema authoring, not a documented invariant.
- QA-003 [UC-01] a schema document that is valid JSON but not an object (e.g. `null`) crashes
  with an uncaught stack trace, exit 1 — ledger tags `contradicts: INV-03, INV-05` (stated
  spec invariants: never a stack trace; exit-2 tool errors are single-line `Error:`-prefixed).
  Classified MUST-HAVE by exception to the default (traces directly to two committed
  invariants), carried into H1 rather than auto-demoted.

## GATE H1 — Baseline Comparison
Baseline: no `shapeup/envlint/shaping/baseline.md` on disk — approximate, using the pitch's
problem statement (UC-01 / project-profile.md: envlint replaces no-tooling / manual `.env`
review with schema-checked linting for well-formed schema+envfile pairs) as the implicit
baseline, flagged approximate per H1.1.

- QA-003 (only MUST-HAVE candidate): with this item left unfixed, is the shipped product still
  strictly better than the baseline (no lint tool) for the pitch's core problem? YES — the
  crash only triggers when the schema document itself is malformed (parses as JSON but isn't
  an object), a narrower authoring error than the core promise of linting a well-formed
  schema+envfile pair; every UC-01 Step/Error-Case/Test-Surface row against well-formed input
  still PASSes (EVAL round 2). Per H1.2, YES-outcomes are still cut-list candidates — QA-003 is
  demoted to a carry-forward proposal rather than a ship blocker.
- QA-001, QA-002: NICE-TO-HAVE by construction — never block H1.

## GATE H2 — Cut List & Verdict
Ship-blocking : none
Proposed cuts : QA-001 (nice-to-have, UX robustness) — carried, not shipped this round
                QA-002 (nice-to-have, boundary robustness) — carried, not shipped this round
                QA-003 (must-have that passed H1.2 as YES) — carried, not shipped this round;
                  logged here explicitly as a known gap since it contradicts INV-03/INV-05 for
                  the malformed-schema-document edge case
Carry-forward : QA-001, QA-002, QA-003 — already recorded as `~` in
                `.shapeup/envlint/discovery/ledger.md` (Discovered — envlint/hunt,
                2026-08-17); no new ledger write needed, debt-free.
Verdict       : SHIP now — all four scopes green, EVAL round 2 PASS, no ship-blocking item
                survives H1. QA-003's invariant contradiction is a known, logged gap scoped
                to malformed schema documents, not the pitch's core problem.

## Known gap logged for the ship report
QA-003: malformed (non-object) schema document crashes with an uncaught stack trace and exit
code 1 instead of a single-line `Error:`-prefixed message and exit code 2, contradicting
INV-03 and INV-05. Carried to next cycle, not fixed this round.
