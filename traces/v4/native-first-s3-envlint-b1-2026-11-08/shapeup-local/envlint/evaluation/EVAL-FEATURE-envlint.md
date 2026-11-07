---
type: eval-report
feature: envlint
task: FEATURE
round: 1
verdict: fail
dimensions_run: [spec-conformance, tdd-surface, completeness, test-surface-conformance]
dimensions_ignored: [integration, security, performance]
bug_count: 1
browser_mode: none
evaluator: spec-evaluator
eval_at: 2026-11-08
linked_docs: ["[[usecases/UC-ParseEnv]]", "[[usecases/UC-CheckRules]]", "[[usecases/UC-LintEnvFile]]", "[[domain-model]]", "[[ux-behavior]]"]
t0_citation:
  - { scope_id: parsing, artifact: t0/verdicts/r1-a1-t1.json, sha256: a3f1a3087fc88a0bfcd47fd60d23d31ae6487a1fad0d93fd94e6bc10378915c6 }
  - { scope_id: rules,   artifact: t0/verdicts/r1-a1-t2.json, sha256: 666293cd1fe824b0d2df72b27d5104cfe46e6d4930d2590639509c3b0336ed4a }
  - { scope_id: cli,     artifact: t0/verdicts/r1-a1-t3.json, sha256: f05de7a8b59ead30a649573c37af120b3c560204d9d0217e772acd8e0538cc68 }
---

OVERALL: FAIL — spec-conformance failed (1 invariant: UC-LintEnvFile INV-03, ANSI escapes reach stdout). 1 bug. The other dimensions pass. Ignored: integration, security, performance.

## T0 citations (recomputed)
Each digest was computed from disk during this evaluation with `harness probe t0 --slug envlint --scope <id> --round 1`. The direct `shasum` hasher needed an approval this session did not have. All three artifacts are `overall: green`.

| scope | artifact | sha256 |
|---|---|---|
| parsing | .shapeup/envlint/t0/verdicts/r1-a1-t1.json | a3f1a3087fc88a0bfcd47fd60d23d31ae6487a1fad0d93fd94e6bc10378915c6 |
| rules | .shapeup/envlint/t0/verdicts/r1-a1-t2.json | 666293cd1fe824b0d2df72b27d5104cfe46e6d4930d2590639509c3b0336ed4a |
| cli | .shapeup/envlint/t0/verdicts/r1-a1-t3.json | f05de7a8b59ead30a649573c37af120b3c560204d9d0217e772acd8e0538cc68 |

Build gate `.shapeup/envlint/build/r1-t1.json`: green. `node --check bin/envlint.mjs` exited 0. Archetype is library, and there is no launch probe and no `[ui]` row.

## Evidence
- `node --test` (this is `run_cmd`, run unpiped): exit 0, 37 tests, 37 pass, 0 fail.
- An independent probe, `.shapeup/envlint/evaluation/evidence/probe-r1.mjs`, ran the CLI as `node bin/envlint.mjs` over fresh temp-dir fixtures and called the modules directly: 29/29 PASS.
- An ANSI probe, `.shapeup/envlint/evaluation/evidence/probe-r1-ansi.mjs`, failed. I ran it twice and both runs gave the same result.
- I read every check the T0 fixtures named by row id against that row's Expect. Every check asserts its row, so none is weaker than its row. Separately, my own probe re-ran each row.

## spec-conformance — FAIL  (threshold: all-pass)
| id | criterion | verdict | confidence | evidence |
|----|-----------|---------|-----------|----------|
| SC-AC | UC-ParseEnv Steps 1–9 | ✅ PASS | high | CRLF split, comments and blanks skipped, `export`, quotes stripped, inline `#` kept, duplicates kept (probe-r1) |
| SC-AC | UC-CheckRules Steps 1–7 | ✅ PASS | high | checkSchema reasons, last occurrence judged, type/enum/required, unknown keys ignored, schema key order |
| SC-AC | UC-LintEnvFile Steps 1–9 | ✅ PASS | high | strict parseArgs, IO/SCHEMA order, PD-14 lines sorted by line with missing keys last (`x.env:1,2,3` then `x.env: Q`), exit 1/0 |
| SC-ERR | Error Cases, all three UCs | ✅ PASS | high | see the TS-ERR-* rows below |
| SC-INV | UC-ParseEnv INV-01, INV-02 | ✅ PASS | high | zero imports, deterministic, no throw on `\u0000`, a lone surrogate, `"` |
| SC-INV | UC-CheckRules INV-01, INV-02 | ✅ PASS | high | zero imports, `https://nonexistent.invalid` judged synchronously |
| SC-INV | UC-LintEnvFile INV-01, INV-02 | ✅ PASS | high | dir sha256 snapshot unchanged for exits 0/1/2; garbage and `null` schema give no stack frame |
| SC-INV | **UC-LintEnvFile INV-03** "Output carries no ANSI escape sequences" | ❌ FAIL | high (re-probed, stable) | an env value, env key or schema key holding `\x1b[31m` is echoed raw to stdout — bin/envlint.mjs:57 |
| SC-UX | ux-behavior Terminal states and behavior rules | ✅ PASS | high | clean/findings/usage/io/schema states match; `--schema` in either position and either form |
| SC-NONGO | `_index` no-gos (no write, no `${VAR}`, no implicit `.env`, no network, no prompts) | ✅ PASS | high | TS-INV-01 snapshot, TS-NOGO-01 ×2, TS-INV-02 (rules), stdin ignored. The "no colors" no-go is breached only via passthrough; it is graded once, under INV-03 |

## tdd-surface — PASS  (threshold: no-critical)
| id | verdict | evidence |
|---|---|---|
| TDD-1 | ✅ PASS | `node --test` exit 0, 37/37 |
| TDD-2 | ✅ PASS | src/parse.mjs → test/parse.test.mjs; src/rules.mjs → test/rules.test.mjs; bin/envlint.mjs → test/cli.test.mjs and test/cli-edges.test.mjs |
| TDD-3 | minor (advisory) | test/cli.test.mjs:81 checks ANSI only on the findings fixture, whose values hold no ESC, so INV-03 for echoed input is untested |

## completeness — PASS  (threshold: no-critical)
| id | verdict | evidence |
|---|---|---|
| CMP-1 | ✅ PASS | every INV is cited by TS id in an AC on a task with the right use_case_refs: ParseEnv INV-01/02 (TASK-001), CheckRules INV-01/02 (TASK-002), LintEnvFile INV-01/02 (TASK-004), INV-03 (TASK-003) |
| CMP-2 | ✅ PASS | each of the 3 UCs has at least 1 task |
| CMP-3 | no finding | the ledger has 2 discovered items and no imagined list. One item is about the harness, one is a minor input-coercion note |

## test-surface-conformance — PASS  (threshold: all-pass)
TSC-2 PASS: every INV has a TS-INV row, every Error Case code has a TS-ERR row, and every row cites a source in D1–D4.
TSC-1, rows probed. This list is the QA negative space.

| UC / TS row | verdict | evidence |
|---|---|---|
| UC-ParseEnv / TS-INV-01 | ✅ PASS | no imports; `parse` twice gives the same output |
| UC-ParseEnv / TS-INV-02 | ✅ PASS | `=x`, `\u0000`, `A` → problem at line 1; `""` → none; no throw |
| UC-ParseEnv / TS-ERR-PARSE_NO_EQUALS | ✅ PASS | problems [line 2], pairs [A] |
| UC-ParseEnv / TS-ERR-PARSE_BAD_KEY | ✅ PASS | 1 problem at line 1, no pairs |
| UC-ParseEnv / TS-ERR-PARSE_UNCLOSED_QUOTE | ✅ PASS | 1 problem at line 1 |
| UC-ParseEnv / TS-REQ-text-forms | ✅ PASS | CRLF text gives pairs at lines 1/4/5/6/7, quotes stripped, no problems |
| UC-ParseEnv / TS-NOGO-01 | ✅ PASS | value is the literal `${B}` |
| UC-CheckRules / TS-INV-01 | ✅ PASS | no imports, no require/fetch |
| UC-CheckRules / TS-INV-02 | ✅ PASS | `[]`, synchronous, 0 ms |
| UC-CheckRules / TS-ERR-RULE_REQUIRED | ✅ PASS | 1 finding, rule required, line null |
| UC-CheckRules / TS-ERR-RULE_TYPE | ✅ PASS | 1.5/yes/localhost → 1 finding each with the pair line; -3/true/https://x.y → none |
| UC-CheckRules / TS-ERR-RULE_ENUM | ✅ PASS | `c` → enum finding; `a` → none |
| UC-CheckRules / TS-ERR-SCHEMA_INVALID | ✅ PASS | 4 invalid shapes → reasons; valid → [] |
| UC-CheckRules / TS-REQ-duplicate-last | ✅ PASS | no findings |
| UC-LintEnvFile / TS-INV-01 | ✅ PASS | sha256 dir snapshot identical after exits 0, 1, 2 |
| UC-LintEnvFile / TS-INV-02 | ✅ PASS | garbage exits 1 with empty stderr; null schema exits 2 `envlint: invalid schema null.json: …` |
| UC-LintEnvFile / TS-INV-03 | ✅ PASS (row as written) | findings fixture with stdin closed: exit 1, no `\x1b[`. The row is narrower than INV-03 (see the BUG-1 retrofit note) |
| UC-LintEnvFile / TS-ERR-USAGE | ✅ PASS | 7 variants exit 2 with `envlint:` and `usage:` |
| UC-LintEnvFile / TS-ERR-IO | ✅ PASS | missing env, missing schema, schema dir, env dir → exit 2 `envlint: cannot read <path>` |
| UC-LintEnvFile / TS-ERR-SCHEMA | ✅ PASS | `{not json` and `float` → exit 2 `envlint: invalid schema <path>: …` |
| UC-LintEnvFile / TS-ERR-FINDINGS | ✅ PASS | `app.env:1: A: …`, `app.env:2: PARSE_NO_EQUALS…`, `app.env: B: …`, exit 1 |
| UC-LintEnvFile / TS-REQ-clean | ✅ PASS | exit 0, stdout empty |
| UC-LintEnvFile / TS-REQ-empty-file | ✅ PASS | empty and comments-only → 0, then 1 naming Z |
| UC-LintEnvFile / TS-REQ-schema-position | ✅ PASS | 3 alternate forms give the same status and stdout as the base |
| UC-LintEnvFile / TS-NOGO-01 | ✅ PASS | cwd `.env` ignored, exit 0 |

## Verdict stability (run 1)
There is no prior `.verdicts-*.jsonl`, so this run is the baseline. The one FAIL was re-probed and agreed both times (confidence high). Stability: all criteria are stable this round.

## Bugs
### BUG-1 — major
criterion: SC-INV, UC-LintEnvFile INV-03 (also bears on the REQ-25 "no colors")
location: bin/envlint.mjs:57 (also :54). The echoed text comes from src/rules.mjs (`got "${pair.value}"`) and src/parse.mjs (`invalid key "${key}"`)
repro: schema `{"A":{"type":"int"}}`, env file `A=\x1b[31mred`, then `node bin/envlint.mjs --schema s.json app.env` (see evaluation/evidence/probe-r1-ansi.mjs)
expected: stdout carries no ANSI escape sequences (UC-LintEnvFile INV-03)
actual: stdout `app.env:1: A: expected int, got "\u001b[31mred"`. The same happens for an ESC in an env key (PARSE_BAD_KEY message) and in a schema key (missing-key line)
fix_hint: escape control characters (at least `\x1b`, and C0/C1 controls generally) in printed text at the CLI print site, e.g. render them as `\x1b`, and add a test with an ESC-bearing value. Retrofit note (TSC, not graded): TS-INV-03 could add an ESC-bearing input so the row matches the invariant

## Next action
→ Round 2, scope `cli`: fix BUG-1 in bin/envlint.mjs, then re-run spec-evaluator over the full UC-LintEnvFile Test Surface (regression rule). integration, security and performance were NOT evaluated.
