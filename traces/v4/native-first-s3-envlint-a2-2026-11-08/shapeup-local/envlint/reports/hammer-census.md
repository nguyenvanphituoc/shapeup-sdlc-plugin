# GATE H — Census & Cut List — envlint

Probes cited: `probe owner --slug envlint` (3 scopes, 0 unowned paths, 0 not on disk); `probe requirements
--slug envlint` (23/27 PASS, 4 no evidence: REQ-1, REQ-8, REQ-20, REQ-25); no attempt probes (no hammer
proposals; breaker null).

```
⏸ GATE H0 — Census
Must-have (unresolved)  : 0
Nice-to-have (~)        : 10 — QA-001..QA-006 (QA), REQ-1, REQ-8, REQ-20, REQ-25 (requirement, no anchored evidence)
Carry candidates        : none — cli, parsing, rules all green and FINISHED
```

## Baseline comparison
Baseline not first-class (no shaping/baseline.md) — comparison is approximate. The pitch's problem statement
is the implicit baseline: today `.env` files get no validation at all, so a typo reaches production.

The four no-evidence requirements are behaviour that the PASS rows did exercise. Each lacks only a verdict
criterion that anchors it by id, so none of them is a missing capability. None of the six QA findings
contradicts an EVAL criterion. With every item carried, the product is still strictly better than the
baseline.

```
⏸ GATE H2 — Cut List & Verdict
Baseline      : approximate — pitch problem statement
Ship-blocking : none
Proposed cuts : 10 nice-to-have (see hammer-census.json cut_list, each with source and why safe)
Carry-forward : QA-001..QA-006 as raw ideas for the next cycle (line endings, url strictness, --help,
                inline comments, empty-enum message, control-byte escaping); anchor REQ-1/8/20/25 on a
                re-eval
Verdict       : SHIP now
```
