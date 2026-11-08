---
type: eval-report
feature: envlint
task: FEATURE
round: 1
verdict: fail
dimensions_run: [spec-conformance, tdd-surface, completeness, test-surface-conformance]
dimensions_ignored: [integration, security, performance]
bug_count: 3
browser_mode: cli   # order browser=cli; CLI deliverable, driven as a process, no browser used
evaluator: spec-evaluator
eval_at: 2026-11-08
linked_docs: ["[[usecases/UC-01-parse-env-text]]", "[[usecases/UC-02-check-pairs-against-schema]]", "[[usecases/UC-03-lint-env-file]]", "[[domain-model]]", "[[ux-behavior]]"]
t0_citation:
  - { scope_id: parsing, artifact: t0/verdicts/r1-a1-t1.json, sha256: 85626ecf1d62ad7b782a6b59bd4c5db5b80d365bb1e6878bdbb512f1fd2a55ad }
  - { scope_id: rules, artifact: t0/verdicts/r1-a1-t2.json, sha256: a5ddb105dbe721687315de17c0aef099af08beb530bea63b01ca008eef4e041b }
  - { scope_id: cli, artifact: t0/verdicts/r1-a1-t3.json, sha256: 83ced6c75d069bd59d9119f0f318cfd0279427afa197698e77c018ad7ea94867 }
---

OVERALL: FAIL. 3 of the 4 graded dimensions fail: spec-conformance (UC-03 INV-05), test-surface-conformance (UC-03 / TS-INV-05, and TSC-2 for UC-02) and completeness (CMP-1, UC-02 INV-04). tdd-surface passes. 3 bugs. Not graded: integration, security, performance.

How the evidence was gathered: I ran the binary as a process (`node bin/envlint.mjs ...`) against fixtures under `evaluation/evidence/fx/`, and called the pure modules directly. The probe script is `evaluation/evidence/probe.mjs`. Its raw output is `evaluation/evidence/probe-r1.json`, keyed by criterion.

## T0 citations
I recomputed the sha256 of each artifact from disk with node:crypto. All three are green, `node --test test/<scope>.test.mjs`, exit 0.

| scope | artifact | sha256 |
|---|---|---|
| parsing | .shapeup/envlint/t0/verdicts/r1-a1-t1.json | 85626ecf1d62ad7b782a6b59bd4c5db5b80d365bb1e6878bdbb512f1fd2a55ad |
| rules | .shapeup/envlint/t0/verdicts/r1-a1-t2.json | a5ddb105dbe721687315de17c0aef099af08beb530bea63b01ca008eef4e041b |
| cli | .shapeup/envlint/t0/verdicts/r1-a1-t3.json | 83ced6c75d069bd59d9119f0f318cfd0279427afa197698e77c018ad7ea94867 |

The `check_files` digests recorded in the T0 artifacts are identical to the current `test/*.test.mjs` files, so no check was rewritten after T0. The order lists no `revised_checks`.

## spec-conformance — FAIL (threshold: all-pass)
| id | criterion | verdict | confidence | evidence |
|---|---|---|---|---|
| SC-UC01 | UC-01 Steps 1-6 + C1 line rules | PASS | high | quotes are verbatim, `#` is not stripped from unquoted values, the line splits at the first `=`, `export`+tab is removed, duplicates are kept |
| SC-UC02 | UC-02 Steps 1-5 + C3 order/messages | PASS | high | type before enum; lined findings ascending, then required findings in schema key order; message shapes match C3 |
| SC-UC02-INV04 | UC-02 INV-04 behavior | PASS | high | did not throw on `__proto__`/`constructor`/`toString` keys |
| SC-UC03 | UC-03 Steps 1-6 + ux-behavior order | PASS | high | parse error comes before a finding on the same line ordering; line-less findings come last; exit codes 0/1/2 |
| SC-UC03-INV05 | UC-03 INV-05: no ANSI escapes | **FAIL** | high (re-probed) | an ESC byte in a user value is echoed raw: bin/envlint.mjs:67 (message from src/rules.mjs:66) |
| SC-MOD | module import table | PASS | high | shebang present; `src/*` import nothing |
| SC-NONGO | _index boundaries | PASS | high | no write, network, interpolation, default `.env` or stdin |
| SC-PKG | decision 7: package.json bin | PASS | high | only the `bin` field was added |

## tdd-surface — PASS (threshold: no-critical)
| id | verdict | evidence |
|---|---|---|
| TDD-1 | PASS | `node --test` 46/46 exit 0. Scope fixtures: parse 15/15, rules 15/15, cli 16/16 |
| TDD-2 | PASS | each of src/parse.mjs, src/rules.mjs and bin/envlint.mjs has a companion test |
| TDD-3 | PASS (advisory) | test names carry the TS ids and assert exact outputs |

## completeness — FAIL (threshold: no-critical)
| id | verdict | evidence |
|---|---|---|
| CMP-1 | **FAIL** (critical) | UC-02 [INV-04] (UC-02 file:37) is not backed by any TASK-002 AC. The other 13 invariants are backed |
| CMP-2 | PASS | every UC is referenced by at least one task |
| CMP-3 | PASS | the ledger has no `[+]` items, so ratio 0 |

## test-surface-conformance — FAIL (threshold: all-pass)
The QA handoff: every row probed, listed by `UC / TS`.

| UC / TS | verdict | evidence |
|---|---|---|
| UC-01 / TS-INV-01 | PASS | pairs/problems are on physical lines 3, 5, 6, 8 |
| UC-01 / TS-INV-02 | PASS | no import; deterministic |
| UC-01 / TS-INV-03 | PASS | `${HOME}/x` stays literal |
| UC-01 / TS-INV-04 | PASS | "", "\n\n", "=", "'", BOM and CRLF inputs all return arrays and never throw |
| UC-01 / TS-ERR-MISSING_EQUALS | PASS | `{line:2, message:"missing '='"}` |
| UC-01 / TS-ERR-INVALID_KEY | PASS | `1BAD=x` and `=x` both give invalid key |
| UC-01 / TS-ERR-UNTERMINATED_QUOTE | PASS | both lines give unterminated quote |
| UC-02 / TS-INV-01 | PASS | no import or network; `http://unreachable.invalid` passes on shape alone |
| UC-02 / TS-INV-02 | PASS | one finding, line 3 |
| UC-02 / TS-INV-03 | PASS | no finding for EXTRA |
| UC-02 / TS-ERR-REQUIRED_MISSING | PASS | `{PORT, null, required}` |
| UC-02 / TS-ERR-TYPE_MISMATCH | PASS | one type finding for each of the 8 values (plus " 7") |
| UC-02 / TS-REQ-type-boundary | PASS | no findings |
| UC-02 / TS-ERR-ENUM_MISMATCH | PASS | Dev and staging fail; dev passes |
| UC-02 / TS-ERR-SCHEMA_INVALID | PASS | the 6 invalid schemas give errors; `{}` and the valid schema give `[]` |
| UC-03 / TS-INV-01 | PASS | 17 cases, no stack lines, at most one `envlint:` line (+usage) each |
| UC-03 / TS-INV-02 | PASS | exact stdout, exit 1 |
| UC-03 / TS-INV-03 | PASS | exit 0 with empty stdout, then exit 1 for the missing key |
| UC-03 / TS-INV-04 | PASS | cwd listing unchanged |
| UC-03 / TS-INV-05 | **FAIL** | the findings run on the `PORT=\x1b[31mred` env prints 0x1b on stdout. The stdin part passes |
| UC-03 / TS-ERR-USAGE | PASS | all 6 variants exit 2 with `envlint:` and `usage:` |
| UC-03 / TS-ERR-ENV_NOT_FOUND | PASS | `cannot read env file missing.env: ENOENT`, exit 2 |
| UC-03 / TS-ERR-ENV_UNREADABLE | PASS | EISDIR, exit 2 |
| UC-03 / TS-ERR-SCHEMA_NOT_FOUND | PASS | `cannot read schema file`, exit 2 |
| UC-03 / TS-ERR-SCHEMA_INVALID_JSON | PASS | `not valid JSON`, exit 2 |
| UC-03 / TS-ERR-SCHEMA_INVALID | PASS | `invalid schema`, exit 2 |
| UC-03 / TS-ERR-FINDINGS | PASS | `e.env:3: parse error: missing '='`, exit 1 |
| UC-03 / TS-NOGO-01 | PASS | exit 2 usage; `.env` not read |
| UC-03 / TS-NOGO-02 | PASS | exit 0, compared literally |
| TSC-2 | **FAIL** (major) | the UC-02 Test Surface has no TS-INV-04 row for [INV-04] |

## Verdict stability (run 1)
- There is no prior `.verdicts-*.jsonl`, so this run is the baseline and no flips are possible.
- I re-probed every FAIL once. TS-INV-05 / INV-05: `od -c` shows `033` again, which agrees with the first probe. CMP-1 and TSC-2 are static re-reads and also agree. Confidence is high on all of them.
- How TS-INV-05 was read: the row says "Any findings run → no `\x1b` byte". The cli scope's own fixture (test/cli.test.mjs:112) only uses ASCII values. I took the row as a universal claim, and a single counterexample refutes it.

## Bugs
### BUG-1 — major
criterion: UC-03 INV-05 / UC-03 / TS-INV-05 (spec-conformance, test-surface-conformance)
location: bin/envlint.mjs:67 (the message is built at src/rules.mjs:66 and :69)
repro: `printf 'PORT=\033[31mred\n' > esc.env; echo '{"PORT":{"type":"int"}}' > s.json; node bin/envlint.mjs --schema s.json esc.env | od -c`
expected: no 0x1b byte in stdout or stderr on any findings run
actual: `esc.env:1: PORT: expected int, got "<ESC>[31mred"`, with the raw 033 on stdout
fix_hint: escape control characters (C0 and DEL) when the CLI renders each line. That keeps the C3 `got "<value>"` message shape in src/rules.mjs intact. The env path that gets echoed needs the same treatment. Add an ESC-valued fixture to the TS-INV-05 test.
next: task-executor, scope `cli`, round 2

### BUG-2 — critical
criterion: CMP-1
location: shapeup/envlint/spec/usecases/UC-02-check-pairs-against-schema.md:37
repro: search the TASK-002 ACs for INV-04 or for a no-throw assertion. Nothing matches.
expected: at least one TASK-002 AC that states UC-02 INV-04
actual: no AC states it. The behavior is tested (test/rules.test.mjs:137) and passes.
next: planner reconcile adds the AC to TASK-002. No code change is needed.

### BUG-3 — major
criterion: TSC-2
location: shapeup/envlint/spec/usecases/UC-02-check-pairs-against-schema.md:52
repro: compare UC-02 `## Invariants` (:34-37) with its `## Test Surface` rows (:57-64)
expected: a TS-INV-04 row, `D1: INV-04`
actual: the only rows are TS-INV-01..03
next: planner retrofit-surface re-run for UC-02. The judge does not author rows.

## Refuted AC
- TASK-003: "Output lines and order exactly per [[ux-behavior#Output lines (findings state)]], no ANSI escapes, no stdin read (covers: REQ-2, REQ-28, REQ-29)". The "no ANSI escapes" part is disproved by BUG-1.
- TASK-004: "Temp cwd listing is unchanged after a run; no `\x1b` in output; `${HOME}` compared literally (covers: REQ-25, REQ-26, REQ-28, REQ-29)". The "no `\x1b` in output" part is disproved by BUG-1, and the test behind it (test/cli.test.mjs:112) only uses ASCII values.

## Next action
→ Round 2: the task-executor fixes BUG-1 in scope `cli`. The planner reconciles BUG-2 and BUG-3 for UC-02, which are spec and board work with no code change. Then re-run spec-evaluator.
  (integration, security and performance were NOT evaluated this run.)
