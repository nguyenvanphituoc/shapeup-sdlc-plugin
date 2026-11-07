# EVAL — personal-site (round 1)

**Verdict: PASS** (all four dimensions: spec-conformance, tdd-surface, completeness, test-surface-conformance)

## T0 citations
- scope build-site: `.shapeup/personal-site/t0/verdicts/r1-a1-t1.json`, sha256 `e916e323673f8341fc6afed279c7fb8039fdee69af59e86f85deb26318b255a2` (recomputed via `harness probe t0`, green).
- Build gate `.shapeup/personal-site/build/r1-t1.json`: green (node --test 14/14). The gate warns the ledger declares no run_cmd; this is a library with no build step.

## Evidence
- Ran `node --test` (the command the scope and REQ-21 name; package.json `test` script): 14 tests, 14 pass, 0 fail.
- Read build.test.mjs against each Test Surface row's Expect; every check asserts what its row asks. No revised_checks listed.
- Read build.mjs against UC steps and ux-behavior: order header/About/Projects/Contact, escaping, url-less titles as text, empty-projects sentence, one-line stderr + exit 1 with nothing written, node: imports only.

## Criteria
| Dimension | Criterion | Verdict | Confidence |
|---|---|---|---|
| spec-conformance | UC steps 1-6; Error Cases; Done-when `npm test`; Non-Go | PASS | high |
| tdd-surface | process-driven suite over temp files | PASS | high |
| completeness | INV-01..08 | PASS | high |
| test-surface-conformance | TS-INV-01..08, TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_INVALID_JSON, TS-REQ-name-missing, TS-NOGO-01..03 | PASS (TS-INV-08 medium) | high |

## Stability
No FAILs, so no re-probes; no flips.

## Notes
- TS-INV-08 "networking unavailable" is checked statically (only `node:` imports, no dependencies) rather than with the network off. This is a weak spot in the check, not a defect.
- Spec gap already raised in the UC (non-string `name`) is not graded.
- Manual probe of a hand-made content file was blocked by the sandbox on env-var syntax; the suite's process-level runs cover the same path.

## Bugs
None.

## NEXT ACTION
Proceed to QA / ship.
