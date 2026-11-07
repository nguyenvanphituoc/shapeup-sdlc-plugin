# EVAL — envlint (feature, round 1)

**Verdict: PASS**

Dimensions graded: spec-conformance, tdd-surface, completeness, test-surface-conformance. All pass; every Test Surface row (25) graded by id.

## T0 citations (sha256 recomputed by `harness probe t0`)
| scope | path | sha256 |
|---|---|---|
| parsing | .shapeup/envlint/t0/verdicts/r1-a1-t1.json | 165630b9cf01457b5d0923548b15907ebe7606c859a347c386a1f9cb47403a25 |
| rules | .shapeup/envlint/t0/verdicts/r1-a1-t2.json | 877eb9400d9bf70007f5a6b0703364988e205382bb78395062847860ab86c4c8 |
| cli | .shapeup/envlint/t0/verdicts/r1-a1-t3.json | a37bd88c4732c16f13c92068b10bd724691e20ca1888bf7b105cbafb63a330b7 |

## Evidence
- `node --test` (project-profile test command): 33 tests, 33 pass, 0 fail. The alias `npm test` was refused by this worker's sandbox for approval, so it was not run; the profile names `node --test`.
- Live CLI probes (`.shapeup/envlint/evaluation/probe.mjs`) against bin/envlint.mjs with stdin closed: the exact TS-ERR-FINDINGS output, all usage/unreadable exits (2, no stack frames), url/bool/int/enum cases, empty-file cases, binary garbage env with schema `[]` (exit 2, one `envlint:` line).
- Code read: src/parse.mjs and src/rules.mjs have no `import`; no fetch; no ANSI.

## Criteria
All PASS, confidence high; no FAIL, so no re-probe or flips. Rows per UC: ParseEnvText 7, CheckRules 9, LintEnvFile 9 (see WorkResult for each id).

## Bugs
None.

## Observations (not graded)
- Parse: a quoted value followed by trailing text (`A="x"y`) is reported "unterminated quote"; the spec's step 6 is silent on it.
- Rules: a schema rule with `required` non-boolean is only guarded by the CLI; fine per precondition.

## NEXT ACTION
Proceed to QA / ship.
