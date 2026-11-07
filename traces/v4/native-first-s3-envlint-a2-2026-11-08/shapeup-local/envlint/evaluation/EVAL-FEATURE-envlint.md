# EVAL — envlint (round 1, feature-level)

**Verdict: PASS** (all four dimensions: spec-conformance, tdd-surface, completeness, test-surface-conformance)

## T0 citations (sha256 recomputed from disk via `harness probe t0`)
| scope | path | sha256 |
|---|---|---|
| parsing | .shapeup/envlint/t0/verdicts/r1-a1-t1.json | c2262e11bd6329cd26fe78e5645e6ce4ceb130f64a8b9c1a102321d63ccb5f84 |
| rules | .shapeup/envlint/t0/verdicts/r1-a1-t2.json | 4364596b4236fe93a6926b26e410195bbb2009d18d9c26cc59d5b5f880c5f782 |
| cli | .shapeup/envlint/t0/verdicts/r1-a1-t3.json | 095d2954a17d2f1c4f0fd53028ee49d16423f81a4b63dd415a575c2fa1f202e4 |

All three green. Build gate `.shapeup/envlint/build/r1-t1.json`: `node --check bin/envlint.mjs` exit 0 (library archetype, no launch probe).

## Evidence
- Ran `node --test` (28 tests, 28 pass, exit 0) from the project root, plus `K=` and `1BAD=x` through `parseEnv` directly.
- Read each test against its row's Expect; every row below is asserted by a check that matches it, except where noted.

## Test Surface (26 rows, each graded; all PASS, high confidence)
UC-ParseEnvText: TS-INV-01 (never throws test), TS-INV-02 (no import in src/parse.mjs), TS-ERR-MISSING_EQUALS, TS-ERR-INVALID_KEY, TS-ERR-UNTERMINATED_QUOTE (test 'problems carry line and skip'), TS-REQ-forms, TS-REQ-empty-value (no dedicated test; direct probe returned `{key:"K",value:"",line:1}`), TS-NOGO-01.
UC-EvaluateRules: TS-INV-01, TS-INV-02, TS-ERR-REQUIRED_MISSING, TS-ERR-TYPE_MISMATCH, TS-REQ-url-shape, TS-ERR-ENUM_MISMATCH, TS-REQ-last-wins.
UC-LintEnvFile: TS-INV-01, TS-INV-02, TS-ERR-USAGE, TS-ERR-ENV_UNREADABLE, TS-ERR-SCHEMA_UNREADABLE, TS-ERR-SCHEMA_INVALID_JSON, TS-ERR-SCHEMA_INVALID_SHAPE, TS-ERR-FINDINGS, TS-REQ-clean, TS-REQ-no-assignments, TS-NOGO-01.

## Stability
No FAILs, so no re-probes and no flips.

## Bugs
None blocking.

## Observations (non-blocking)
- The invalid-key problem message is `invalid key '<key>'` (src/parse.mjs:22), not the bare `invalid key` in the contract. The row's Expect elides the message with `…` and the test checks only the line number, so this is graded PASS. If the contract text is meant to be exact, this deviates.
- Probing was limited to existing fixtures and direct module calls. Scratch-file writes are outside this order's substrate, so no ad-hoc CLI runs.
- No `run_cmd` or `launch_cmd`. A CLI is exercised through the spawned-process tests in test/cli.test.mjs.

## NEXT ACTION
Proceed to QA / ship.
