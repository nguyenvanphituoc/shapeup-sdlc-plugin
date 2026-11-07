# GATE H — census, envlint (round 1)

## ⏸ GATE H0 — Census
Must-have (unresolved)  : 0
Nice-to-have (~)        : 13 — 7 requirements with no EVAL anchor (REQ-9, 10, 11, 12, 13, 15, 19 — `probe requirements`), 6 QA findings (QA-001…QA-006, `qa/hunt-report.md`)
Carry candidates        : none — all three scopes green and FINISHED; no attempt-budget proposals; no breaker

Ownership (`probe owner`): src/parse.mjs → parsing, src/rules.mjs → rules, bin/envlint.mjs → cli; 0 unowned, 0 missing.

Why the 7 requirements are not must-haves: each is the parsing/rules behaviour the T0 suites assert
(parse 10 tests, rules suite, the integration fixture exercising every parse feature and rule; EVAL ran
`node --test` 29/29). The gap is that no Test Surface row derives from them (D1–D4 have no source for
"handles comments"), so the judge graded no criterion that anchors them. REQ-19's result also lacks
ingest because its dispatch left no receipt.

## Baseline comparison
Baseline: approximate — the pitch's problem statement ("a `.env` file is the one config file nobody
validates"); no `shapeup/envlint/shaping/baseline.md` exists. Today there is no validator at all; the shipped
CLI validates required/type/enum key by key with line numbers, exits non-zero, and handles the three named
edges without crashing. Strictly better than the baseline with every item above cut.

## ⏸ GATE H2 — Cut List & Verdict
Baseline      : approximate — pitch problem statement
Ship-blocking : none
Proposed cuts : 13 nice-to-have (see hammer-census.json `cut_list`), each carried to the discovery ledger as a raw idea
Carry-forward : QA-001 inline comments, QA-004 sanitise echoed control bytes, QA-003 schema validation — the strongest next-cycle candidates
Verdict       : SHIP now
