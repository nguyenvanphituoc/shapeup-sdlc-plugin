# EVAL envlint round 1

**Verdict: PASS** (spec-conformance, tdd-surface, completeness, test-surface-conformance all pass; 27 criteria, 0 FAIL, no flips, nothing to re-probe)

## T0 citations (sha256 recomputed via kernel probe t0)
- rules: .shapeup/envlint/t0/verdicts/r1-a1-t1.json bfae9be3a398b501c7eb4485fa52b53a3ab41fa7f10576a962125e8aafd1c5ee
- parsing: .shapeup/envlint/t0/verdicts/r1-a1-t2.json 0ab52739bdeb7013096272c23e8f96195097370dd3f50db162ea1754f266ca6d
- cli: .shapeup/envlint/t0/verdicts/r1-a1-t3.json 3410aad4ecd64efdc784400c81cac34288ef1c52de07758c7c08649037452cb2

## Criteria
| Criterion | Dimension | Verdict | Confidence | Evidence |
|---|---|---|---|---|
| UC-ParseEnvText TS-INV-01 | test-surface-conformance | PASS | high | T0 r1-a1-t2 green, node --test test/parse.test.mjs pass; independent `node --test` 29/29 pass; malformed never throw test; src/parse.mjs:4-35 no throw path |
| UC-ParseEnvText TS-INV-02 | completeness | PASS | high | src/parse.mjs has no import statements (read lines 1-35) |
| UC-ParseEnvText TS-ERR-PARSE_ERROR | test-surface-conformance | PASS | high | T0 r1-a1-t2 green, node --test test/parse.test.mjs pass; independent `node --test` 29/29 pass; bad line in the middle |
| UC-ParseEnvText TS-REQ-text-empty | test-surface-conformance | PASS | high | test empty passes in T0 r1-a1-t2 |
| UC-ParseEnvText TS-NOGO-01 | test-surface-conformance | PASS | high | test no interpolation passes; src/parse.mjs keeps value literal |
| UC-CheckEnvAgainstSchema TS-INV-01 | completeness | PASS | high | url check via new URL only, src/rules.mjs:7-14; test url unreachable host passes in T0 r1-a1-t1 |
| UC-CheckEnvAgainstSchema TS-INV-02 | completeness | PASS | high | src/rules.mjs has no import statements (read lines 1-40) |
| UC-CheckEnvAgainstSchema TS-ERR-MISSING_REQUIRED | test-surface-conformance | PASS | high | test missing required key has line null passes, T0 r1-a1-t1; CLI probe printed REQ missing |
| UC-CheckEnvAgainstSchema TS-ERR-TYPE_MISMATCH | test-surface-conformance | PASS | high | test type mismatches carry the pair line passes; CLI probe PORT=abc -> e.env:1 TYPE mismatch |
| UC-CheckEnvAgainstSchema TS-ERR-NOT_IN_ENUM | test-surface-conformance | PASS | high | test enum rejects values outside the list passes; CLI probe A=${HOME} -> e.env:2 NOT_IN_ENUM |
| UC-CheckEnvAgainstSchema TS-REQ-type-valid | test-surface-conformance | PASS | high | test valid typed values produce no findings passes |
| UC-CheckEnvAgainstSchema TS-NOGO-01 | test-surface-conformance | PASS | high | test url on an unreachable host accepted on shape alone passes; no network code in src/rules.mjs |
| UC-LintEnvFile TS-INV-01 | test-surface-conformance | PASS | high | probe in temp dir: directory listing and env bytes unchanged after run; CLI only calls readFileSync (bin/envlint.mjs:30,37) |
| UC-LintEnvFile TS-INV-02 | test-surface-conformance | PASS | high | probe: no ANSI in stdout/stderr on findings run; stdin closed, process exits |
| UC-LintEnvFile TS-INV-03 | test-surface-conformance | PASS | high | probe: cwd .env with errors, `--schema s.json` alone -> exit 2 usage |
| UC-LintEnvFile TS-INV-04 | test-surface-conformance | PASS | high | probe: random-byte file exit 1 and empty file exit 1 (required key missing), stderr empty, no stack |
| UC-LintEnvFile TS-ERR-USAGE | test-surface-conformance | PASS | high | probe: no args and --schema only -> exit 2, usage line on stderr |
| UC-LintEnvFile TS-ERR-ENV_NOT_FOUND | test-surface-conformance | PASS | high | probe: exit 2, stderr names missing.env, no stack |
| UC-LintEnvFile TS-ERR-SCHEMA_UNREADABLE | test-surface-conformance | PASS | high | probe: missing schema and `{not json` both exit 2 naming schema file, no stack |
| UC-LintEnvFile TS-ERR-FINDINGS | test-surface-conformance | PASS | high | probe: stdout `e.env:1: PORT: PORT must be int, got "abc"` plus missing-key line, exit 1 |
| UC-LintEnvFile TS-REQ-clean | test-surface-conformance | PASS | high | probe: valid env exit 0, empty stdout |
| UC-LintEnvFile TS-REQ-no-assignments | test-surface-conformance | PASS | high | probe: comments-only env exit 1, one MISSING_REQUIRED line, no crash |
| UC-LintEnvFile TS-NOGO-01 | test-surface-conformance | PASS | high | probe: env bytes unchanged after run |
| UC-LintEnvFile TS-NOGO-02 | test-surface-conformance | PASS | high | probe: no ANSI codes in stdout or stderr |
| UC-LintEnvFile TS-NOGO-03 | test-surface-conformance | PASS | high | probe: finding line `A must be one of x, got "${HOME}"` quotes literal |
| UC-LintEnvFile Steps 1-7 / Error Cases | spec-conformance | PASS | high | all CLI probes match Steps and exit-code table; bin/envlint.mjs:14-62 |
| Suite: node --test (project test command) | tdd-surface | PASS | high | node --test exit 0, 29 pass 0 fail; per-scope fixtures green in T0 r1-a1-t1..t3 |

## Stability
No FAIL, no re-probe, no flips.

## Bugs
None.

## Notes
`node --test test/` (directory arg) exits 1 on Node 24; no contract names it, the named fixtures and plain `node --test` pass.

## NEXT ACTION
Proceed to QA / ship.
