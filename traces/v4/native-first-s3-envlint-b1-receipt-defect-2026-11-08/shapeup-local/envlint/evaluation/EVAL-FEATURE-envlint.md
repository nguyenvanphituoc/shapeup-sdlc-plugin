---
type: eval-report
feature: envlint
task: FEATURE
verdict: fail
round: 1
dimensions_run: [spec-conformance, tdd-surface, completeness, test-surface-conformance]
dimensions_ignored: [integration, security, performance]
bug_count: 3
browser_mode: none
evaluator: spec-evaluator
eval_at: 2026-11-08
linked_docs: ["[[usecases/UC-ParseEnvText]]", "[[usecases/UC-EvaluateRules]]", "[[usecases/UC-LintEnvFile]]", "[[domain-model]]", "[[ux-behavior]]"]
t0_citation:
  - { scope_id: rules-engine, artifact: .shapeup/envlint/t0/verdicts/r1-a1-t1.json, sha256: f2221c8736aaa62b1ea7df9040165abf809bb3d76c65bf7cd5389fe0ca980189 }
  - { scope_id: parse-env,    artifact: .shapeup/envlint/t0/verdicts/r1-a1-t2.json, sha256: 64e1632fae7d84aca6debd5d029d5ef2cbf57be8e8a67a73b35168cfd50f2d7e }
  - { scope_id: cli,          artifact: .shapeup/envlint/t0/verdicts/r1-a1-t3.json, sha256: 02be007e1e801c884a08ea7612aa4c0c3d983039bc69a9bd397ea3f265a1a4e5 }
---

OVERALL: FAIL — spec-conformance failed (UC-LintEnvFile INV-03 / RULE-04: ANSI escapes reach stdout; ux `findings` "one line per item": a value with a newline splits one finding over two lines); completeness failed (CMP-1: 3 invariants with no backing task AC). tdd-surface PASS, test-surface-conformance PASS (31/31 rows). 3 bugs. Ignored: integration, security, performance.

## Evidence base
- T0 artifacts: all three are green on disk. I recomputed the sha256 of each myself with node `crypto` (values in the frontmatter).
- Build gate `.shapeup/envlint/build/r1-t1.json`: green, `build_probe` exit 0.
- `node --test` (the order's run_cmd, run by me): 42 tests, 42 pass, exit 0.
- I drove the CLI myself as a process oracle with `evidence/probe.mjs`: 47/47 checks matched the spec. Raw results are in `evidence/probe-r1.json`.
- I re-probed with `evidence/probe2.mjs`, twice, and got the same result both times: the ESC and newline cases.
- No `.verdicts-*.jsonl` history exists. This run is the baseline.

## spec-conformance — FAIL (threshold: all-pass)
| id | criterion | verdict | conf | evidence |
|----|-----------|---------|------|----------|
| SC-P-STEPS | UC-ParseEnvText Steps 1–8 | PASS | high | CRLF==LF, export prefix, key trim, ' literal, " escapes \n \" \\ (other `\` kept), trailing-after-quote, unquoted ` #` cut, `a#b` kept, duplicates kept, `A=` → "" |
| SC-P-ERR | UC-ParseEnvText Error Cases (5) | PASS | high | exact `{line,message}` for each code |
| SC-P-INV | UC-ParseEnvText INV-01..03 | PASS | high | deep-equal re-parse; `parse(undefined)` throws; `${B}`/`$D` literal; lines 1/4/5 kept across blanks and comments |
| SC-R-STEPS | UC-EvaluateRules validateSchema + evaluate Steps | PASS | high | all 6 messages match verbatim; last duplicate wins; schema order; unknown keys ignored; INVALID_TYPE+NOT_IN_ENUM together |
| SC-R-INV | UC-EvaluateRules INV-01..03 | PASS | high | args deep-equal after the calls; Value Types accept/reject table matches exactly; `A=""` required+int → only INVALID_TYPE |
| SC-C-STEPS | UC-LintEnvFile Steps 1–8 + RULE-01/02/03/06 | PASS | high | `--schema` works before or after the envfile; envfile read before schema; ordering probe (6 lines) exact; `./rel.env` printed as given |
| SC-C-INV01 | UC-LintEnvFile INV-01 / RULE-05 | PASS | high | garbage bytes, `[]`, `"x"`, directory → exit 1/2, no stack trace |
| SC-C-INV02 | UC-LintEnvFile INV-02 | PASS | high | temp dir byte-identical; sentinel `.env` never read |
| SC-C-INV03 | UC-LintEnvFile INV-03 / ux RULE-04 "Output contains no ANSI escape sequences" | FAIL | high (re-probed, agrees) | envfile `PORT=\x1b[31mred` gives stdout `…:1: PORT: expected int, got "\x1b[31mred"`, which carries a CSI. The raw value is interpolated at src/rules.mjs:72 and printed at bin/envlint.mjs:77 |
| SC-C-ONELINE | ux TerminalOutput `findings` "one line per item" / RULE-01 | FAIL | high (re-probed, agrees) | envfile `PORT="a\nb"` produces 1 finding, printed over 2 stdout lines. src/rules.mjs:72 |
| SC-NONGO | _index Non-Go (no write, no interpolation, no process.env, no color, no network, no implicit .env) | PASS | high | source scan clean; TS-NOGO rows pass. The tool emits no colour of its own; SC-C-INV03 covers echoed escapes |

## tdd-surface — PASS (threshold: no-critical)
| id | verdict | evidence |
|----|---------|----------|
| TDD-1 | PASS | `node --test` exit 0, 42/42 |
| TDD-2 | PASS | `src/parse.mjs`→`test/parse.test.mjs`, `src/rules.mjs`→`test/rules.test.mjs`, `bin/envlint.mjs`→`test/cli.test.mjs` |
| TDD-3 | PASS (advisory) | Tests are named per TS row. Minor gap: UC-ParseEnvText TS-NOGO-01 (oracle `test`) is not in the suite, because REQ-25 forbids `node:fs` in `test/parse.test.mjs` (the discovery ledger records this). I graded the row on my own grep. Neither the INV-03 test nor any other test feeds control characters into a value. |

## completeness — FAIL (threshold: no-critical)
| id | verdict | evidence |
|----|---------|----------|
| CMP-1 | FAIL (critical) | Backed: P-INV-02 (TASK-001 AC "returned literally"), P-INV-03 (AC 1-based line / blank lines), C-INV-01 (TASK-003 "no stack trace"), C-INV-02 (TASK-004 TS-INV-02, TASK-003 "never reads ./.env"), C-INV-03 (TASK-003 / TASK-004 "no \x1b["), R-INV-02 (TASK-002 Value Types AC). **Unbacked:** UC-ParseEnvText INV-01 (no AC restates determinism or "throws on non-string"; only the no-I/O-import part appears), UC-EvaluateRules INV-01 (no AC restates "no mutation of arguments"), UC-EvaluateRules INV-03 (AC restates "empty counts as present" but not "still type- and enum-checked") |
| CMP-2 | PASS | each UC has ≥1 task (TASK-001/002/003+004) |
| CMP-3 | PASS (advisory) | ledger: 2 discovered items, 0 imagined. Advisory only |

## test-surface-conformance — PASS (threshold: all-pass)
TSC-1: every one of the 31 rows ran its Probe and matched Expect. My probe evidence is the primary source, and the named T0 lines corroborate it.
- UC-ParseEnvText: TS-INV-01, TS-INV-02, TS-INV-03, TS-ERR-NO_EQUALS, TS-ERR-INVALID_KEY, TS-ERR-UNTERMINATED_SINGLE, TS-ERR-UNTERMINATED_DOUBLE, TS-ERR-TRAILING_AFTER_QUOTE, TS-REQ-forms, TS-REQ-empty, TS-NOGO-01. All PASS.
- UC-EvaluateRules: TS-INV-01, TS-INV-02, TS-INV-03, TS-ERR-MISSING_REQUIRED, TS-ERR-INVALID_TYPE, TS-ERR-NOT_IN_ENUM, TS-ERR-SCHEMA_INVALID, TS-REQ-duplicate, TS-NOGO-01. All PASS.
- UC-LintEnvFile: TS-INV-01, TS-INV-02, TS-INV-03, TS-ERR-USAGE (8 argv variants), TS-ERR-READ_FAILED, TS-ERR-SCHEMA_INVALID, TS-ERR-FINDINGS (stdout exact), TS-REQ-clean, TS-REQ-no-assignments, TS-NOGO-01, TS-NOGO-02. All PASS.
- Note: UC-LintEnvFile TS-INV-03 is weaker than its invariant. It probes only "any findings case", so it passes while INV-03 fails (SC-C-INV03).

TSC-2: PASS. In every UC, each INV has a TS-INV row and each Error Case code has a TS-ERR row (LintEnvFile FINDINGS ↔ TS-ERR-FINDINGS). Every row cites D1–D4.

## Verdict stability (run 1)
- No prior verdict history; this run is the baseline.
- Both FAILs were re-probed (`probe2.mjs`, run twice) and the results agreed, so confidence is high. No flips.

## Bugs
### BUG-1 — major
criterion: SC-C-INV03 (UC-LintEnvFile INV-03, ux RULE-04)
location: src/rules.mjs:72 (also src/rules.mjs:80; printed at bin/envlint.mjs:77)
repro: `printf 'PORT=\033[31mred\n' > e.env; echo '{"PORT":{"type":"int"}}' > s.json; node bin/envlint.mjs --schema s.json e.env | od -c`
expected: stdout contains no `\x1b[` sequence
actual: `e.env:1: PORT: expected int, got "\x1b[31mred"`. The raw ESC byte reaches the terminal.
fix_hint: escape control characters (U+0000–U+001F, U+007F) when a value is put into a message, e.g. as `\x1b`/`\n`. The spec's message template `got "<value>"` does not say how to render control characters, so the PO or planner should confirm the escaping form.

### BUG-2 — major
criterion: SC-C-ONELINE (ux TerminalOutput `findings`: one line per item; RULE-01)
location: src/rules.mjs:72
repro: `printf 'PORT="a\\nb"\n' > e.env; node bin/envlint.mjs --schema s.json e.env | wc -l`
expected: 1 line for the 1 finding
actual: 2 lines. The double-quote `\n` escape becomes a real newline inside the message.
fix_hint: same fix as BUG-1. Escape the value in the message so each item stays on one line.

### BUG-3 — critical (planning gap, not a build defect)
criterion: CMP-1
location: shapeup/envlint/spec/usecases/UC-ParseEnvText.md:69 (INV-01); shapeup/envlint/spec/usecases/UC-EvaluateRules.md:71 (INV-01), :73 (INV-03)
repro: read the task ACs for UC-ParseEnvText / UC-EvaluateRules. None cites these INV ids, and none restates their assertion 1:1.
expected: ≥1 task AC per invariant, citing the INV id or its exact assertion
actual: the tests exist (TS-INV-01/03 pass), but the board does not back these invariants
next: a plan spec step in reconcile mode, to add the INV-backed ACs. The judge does not author them.

## Observations (not graded)
- `bin/envlint.mjs` is not marked executable (discovery ledger). `node bin/envlint.mjs` works.

## Next action
→ Round 2: the rules-engine scope (owner of src/rules.mjs) fixes BUG-1 and BUG-2 and adds a regression test with control characters in a value. Planning reconciles BUG-3. Then re-run spec-evaluator over the full Test Surface of UC-EvaluateRules and UC-LintEnvFile. (integration, security and performance were NOT evaluated.)
