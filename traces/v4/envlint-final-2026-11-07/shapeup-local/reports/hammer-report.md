# GATE H — census and cut list — envlint (run envlint-20261107T143005Z-8bd251a0)

Normal stop: round 1 EVAL PASS, build gate green (r1-t2), QA ran and returned not-hunted. Breaker: none.

## Probes cited
- `probe owner --slug envlint --format table`: 3 scopes read, 0 unowned paths, 0 not on disk
  (src/parse.mjs → parsing, src/rules.mjs → rules, bin/envlint.mjs → cli).
- `probe requirements --slug envlint --format table`: 20/22 PASS; no evidence for REQ-1 and REQ-16.
- `probes.attempts`: none (no hammer proposals; every scope green on attempt 1).
- Discovery ledger: absent (no open entries). QA report: 0 charters, 0 findings, status not-hunted.

```
⏸ GATE H0 — Census
Must-have (unresolved)  : 0
Nice-to-have (~)        : 3 — REQ-1 evidence gap (requirement) · REQ-16 evidence gap (requirement) · QA not-hunted (QA)
Carry candidates        : none (all scopes FINISHED on the hill)
```

## Baseline comparison
Baseline not first-class — no `shapeup/envlint/shaping/baseline.md`; comparison is approximate, against the
pitch's problem statement: today a `.env` file is not validated at all. The built tool validates a file
against a schema, reports problems by key and line, and exits non-zero for CI — strictly better than the
baseline with every listed item cut or carried. REQ-1 and REQ-16 are evidence gaps (no judge criterion
anchored to them), not missing behaviour: the schema shape and the pure `{pairs, problems}` surface are
exercised by rows that PASS (UC-EvaluateRules TS-INV-01, UC-ParseEnvText TS-REQ-text-forms).

```
⏸ GATE H2 — Cut List & Verdict
Baseline      : approximate — pitch problem statement
Ship-blocking : none
Proposed cuts : REQ-1 evidence gap — requirement — behaviour covered by passing rows; anchor a criterion next cycle
                REQ-16 evidence gap — requirement — behaviour covered by passing rows; anchor a criterion next cycle
                QA not-hunted — QA — level-up, never a gate; needs a grant that lets the hunter run the CLI
Carry-forward : the three items above, as raw ideas, debt-free
Verdict       : SHIP now
```
