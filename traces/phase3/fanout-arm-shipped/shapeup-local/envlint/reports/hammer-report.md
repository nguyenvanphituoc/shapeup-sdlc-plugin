---
type: hammer-report
feature: envlint
order_id: envlint/hammer
---

# GATE H — Scope Hammer Report: envlint

## GATE H0 — Census
Must-have (unresolved) : 0
Nice-to-have (~)        : 5 — all from QA hunt (QA-001..QA-005), source: QA
Carry candidates        : none — all 4 scopes (parsing-engine, rules-engine, cli-composition-root, test-surface-suite) FINISHED/kept, no hammer_proposals, no breaker tripped

## GATE H1 — Baseline Comparison
Baseline: shapeup/envlint/shaping/baseline.md not present — approximate, using pitch problem
statement / UC-01 spec as implicit baseline (flagged approximate).

All 5 QA findings (QA-001 unknown schema `type` silently valid, QA-002 `type`+`enum` enum
dropped, QA-003 non-object schema JSON handed to Object.keys(), QA-004 unrecognized flag
shadows env-file path, QA-005 duplicate `--schema` silently last-wins) are classified
NICE-TO-HAVE by default: none traces to a pitch boundary or a scope's business_goal — each is
a permissiveness edge in schema/argv handling beyond the pitch's stated Non-Go list and UC-01
Error Cases, all `~` in the hunt report, none marked contradicts-EVAL. EVAL already PASSed
spec-conformance (64/64 tests, all UC-01 invariants/error cases graded). Product with none of
these fixed is still strictly better than the baseline (no envlint tool at all / manual env
inspection) for the pitch's core problem. No item fails H1.2 — nothing is ship-blocking.

## GATE H2 — Cut List & Verdict
Baseline      : approximate — pitch problem statement / UC-01 spec (no shapeup/envlint/shaping/baseline.md)
Ship-blocking : none
Proposed cuts : QA-001, QA-002, QA-003, QA-004, QA-005 — all nice-to-have, all safe to cut (see H1)
Carry-forward : QA-001..QA-005 carried to .shapeup/envlint/discovery/ledger.md as raw ideas for next cycle (already present as `~` entries)
Verdict       : SHIP now
