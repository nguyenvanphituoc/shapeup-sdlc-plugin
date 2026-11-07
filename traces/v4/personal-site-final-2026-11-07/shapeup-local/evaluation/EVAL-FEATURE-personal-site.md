# EVAL — personal-site (round 1)

Verdict: PASS

Dimensions: spec-conformance, tdd-surface, completeness, test-surface-conformance — all pass.

## T0 citations
| scope | path | sha256 (recomputed via harness probe t0) |
|---|---|---|
| build-site | .shapeup/personal-site/t0/verdicts/r1-a1-t1.json | 249f7b9d14f38b7e8982123d6a8ed223e1aa589b7a000342722cc0e6c3772d39 |

Build gate .shapeup/personal-site/build/r1-t1.json: green (`node build.mjs` exit 0).

## Method and limits
Read build.mjs and build.test.mjs against each Test Surface row's Expect. I could not re-run the test suite
myself (command execution was not approved in this session), so test results rest on the T0 artifact, whose
stdout_tail names each row as passing, and on reading each check: every check asserts its row's Expect.
A project with no `launch_cmd` is a CLI library; no UI probing applies.

## Criteria
| criterion | dimension | verdict | confidence | evidence |
|---|---|---|---|---|
| TS-INV-01 | test-surface-conformance | PASS | medium | test builds twice, compares buffers (build.test.mjs:34); no timestamps in build.mjs:52-82; T0 names PASS |
| TS-INV-02 | test-surface-conformance | PASS | medium | build.test.mjs:46 asserts exit 1, no index.html; writes only after validation (build.mjs:84-85) |
| TS-INV-03 | test-surface-conformance | PASS | medium | esc() at build.mjs:4-10 applied to all interpolations; test :52 |
| TS-INV-04 | test-surface-conformance | PASS | medium | single h1 at build.mjs:65; test :58 |
| TS-INV-05 | test-surface-conformance | PASS | medium | card() build.mjs:41-46 plain title without url; test :64 |
| TS-INV-06 | test-surface-conformance | PASS | medium | build.mjs:48-50; test :72 (stricter: whole page has no ul/ol/li) |
| TS-ERR-CONTENT_MISSING | test-surface-conformance | PASS | medium | build.mjs:24; test :78 asserts exit 1, one line, no file |
| TS-ERR-CONTENT_INVALID_JSON | test-surface-conformance | PASS | medium | build.mjs:31; test :90 |
| TS-ERR-NAME_MISSING | test-surface-conformance | PASS | medium | build.mjs:34-36; test :97 |
| TS-NOGO-01 | test-surface-conformance | PASS | medium | no markdown processing in build.mjs; test :106 |
| TS-NOGO-03 | test-surface-conformance | PASS | medium | only index.html written (build.mjs:85); test :112 |
| TS-NOGO-05 | test-surface-conformance | PASS | medium | no loop/watch; test :117 |
| UC-BuildSite Steps 1-7 / sections order, title, mailto, inline CSS | spec-conformance | PASS | medium | build.mjs:17-18, 52-82 |
| INV-01..06 | completeness | PASS | medium | each covered by its TS row above |
| T0 fixtures green, cited | tdd-surface | PASS | high | artifact sha256 recomputed |

## Bugs
None.

## Stability
No prior verdict ledger; no FAILs to re-probe; no flips.

## NEXT ACTION
Proceed to QA / ship.
