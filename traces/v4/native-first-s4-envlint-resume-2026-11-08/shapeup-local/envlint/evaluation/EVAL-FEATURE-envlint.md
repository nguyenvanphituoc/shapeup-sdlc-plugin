---
type: eval-report
feature: envlint
task: FEATURE
round: 2
verdict: pass
dimensions_run: [spec-conformance, tdd-surface, completeness, test-surface-conformance]
dimensions_ignored: [integration, security, performance]
bug_count: 0
browser_mode: cli   # order browser=cli; CLI deliverable, driven as a process, no browser used
evaluator: spec-evaluator
eval_at: 2026-11-08
linked_docs: ["[[usecases/UC-01-parse-env-text]]", "[[usecases/UC-02-check-pairs-against-schema]]", "[[usecases/UC-03-lint-env-file]]", "[[domain-model]]", "[[ux-behavior]]"]
t0_citation:
  - { scope_id: parsing, artifact: t0/verdicts/r1-a1-t1.json, sha256: 85626ecf1d62ad7b782a6b59bd4c5db5b80d365bb1e6878bdbb512f1fd2a55ad }
  - { scope_id: rules, artifact: t0/verdicts/r2-a1-t1.json, sha256: 78daa00e90dced0ed1170eb5e93a676646bc6494e326312825dadf8c57b2c221 }
  - { scope_id: cli, artifact: t0/verdicts/r2-a1-t2.json, sha256: 4c2410cf5c3952cbc9ae3d9b3d24527310f1c9ead74b704dd86bed62a87c1712 }
---

OVERALL: PASS (round 2). All 4 graded dimensions pass: spec-conformance, tdd-surface, completeness and test-surface-conformance. 45 criteria, 0 FAIL, 0 bugs. All three round-1 bugs are fixed. Not graded: integration, security, performance.

How the evidence was gathered: I ran the binary as a process and called the pure modules directly, using fixtures under `evaluation/evidence/fx-r2/`.
- Probe scripts: `evaluation/evidence/probe-r2.mjs` (the round-1 probe, extended for BUG-1 and BUG-3) and `evaluation/evidence/probe-r2-extra.mjs` (the open-stdin run and the exact scope fixture commands).
- Raw output: `probe-r2.json` and `probe-r2-extra.json`, keyed by criterion.
- The regression rule called for the full Test Surface of UC-02 and UC-03. I re-ran UC-01 as well.

## T0 citations
I recomputed the sha256 of each artifact from disk with node:crypto. The kernel has no `probe t0` verb.

| scope | artifact | sha256 | state |
|---|---|---|---|
| parsing | t0/verdicts/r1-a1-t1.json | 85626ecf…a55ad | green, `node --test test/parse.test.mjs` 15/15 (not reopened) |
| rules | t0/verdicts/r2-a1-t1.json | 78daa00e…2c221 | green, `node --test test/rules.test.mjs` 15/15, names TS-INV-04 |
| cli | t0/verdicts/r2-a1-t2.json | 4c2410cf…c1712 | green, `node --test test/cli.test.mjs` 17/17, names TS-INV-05 ×2 |

Each artifact's `check_files` digest equals the current test file on disk. The order lists no `revised_checks`.

## Round-1 bugs re-checked
- **BUG-1 (UC-03 INV-05 / TS-INV-05): fixed.** `bin/envlint.mjs:12-13` renders every C0, DEL and C1 byte as `\xNN` text. That rendering is applied to every stdout line (:76) and every stderr line (:84, :86).
  - I probed 8 user-controlled channels: ESC in an env value, an enum member, a schema key, the env path, the schema path and a missing env path; an unknown flag; and a C1 CSI (U+009B) value. A raw-Buffer check found no 0x1b, 0x9b or 0x07 byte anywhere.
  - Stdin: an async spawn whose stdin pipe was never ended exited 1 on its own, both times.
- **BUG-2 (CMP-1): fixed.** TASK-002 now carries the `[INV-04] … (TS-INV-04) (covers: REQ-17)` AC.
- **BUG-3 (TSC-2): fixed.** UC-02 now has a `TS-INV-04` row (UC-02 spec :60), sourced `D1: INV-04`.

## test-surface-conformance — PASS (threshold: every row passes; TSC-2 complete)
| criterion | verdict | conf | evidence (probe key) |
|---|---|---|---|
| UC-01 / TS-INV-01 | PASS | high | UC01/TS-INV-01: A@3 B@5 problem@6 C@8 |
| UC-01 / TS-INV-02 | PASS | high | no import; identical results |
| UC-01 / TS-INV-03 | PASS | high | `${HOME}/x` literal |
| UC-01 / TS-INV-04 | PASS | high | 10 boundary inputs, none threw |
| UC-01 / TS-ERR-MISSING_EQUALS | PASS | high | `{line:2,"missing '='"}` |
| UC-01 / TS-ERR-INVALID_KEY | PASS | high | lines 1, 2 |
| UC-01 / TS-ERR-UNTERMINATED_QUOTE | PASS | high | lines 1, 2 |
| UC-02 / TS-INV-01 | PASS | high | no import / network; unreachable.invalid passes by shape |
| UC-02 / TS-INV-02 | PASS | high | one finding, line 3 |
| UC-02 / TS-INV-03 | PASS | high | EXTRA → [] |
| UC-02 / TS-INV-04 | PASS | high | **new row.** Accepted url+enum/required schema → `[]`. `::::` and `""` values, and keys `__proto__`/`constructor`/`toString` (also as schema keys) → no throw. Check test/rules.test.mjs:137 asserts the same |
| UC-02 / TS-ERR-REQUIRED_MISSING | PASS | high | `{PORT, null, required}` |
| UC-02 / TS-ERR-TYPE_MISMATCH | PASS | high | finding for each of 9 values |
| UC-02 / TS-REQ-type-boundary | PASS | high | no finding for 7 values |
| UC-02 / TS-ERR-ENUM_MISMATCH | PASS | high | Dev, staging flagged; dev passes |
| UC-02 / TS-ERR-SCHEMA_INVALID | PASS | high | 6 structural faults → errors; `{}` and a valid schema → `[]` |
| UC-03 / TS-INV-01 | PASS | high | 17 cases, no stack lines |
| UC-03 / TS-INV-02 | PASS | high | exact two lines, exit 1 |
| UC-03 / TS-INV-03 | PASS | high | exit 0 empty; exit 1 `A: required key is missing` |
| UC-03 / TS-INV-04 | PASS | high | cwd listing unchanged, no .env |
| UC-03 / TS-INV-05 | PASS | high | see BUG-1 above (UC03/TS-INV-05-bug1, probe-r2-extra stdinHeldOpen) |
| UC-03 / TS-ERR-USAGE | PASS | high | 6 argv shapes → exit 2, `envlint:` + `usage:` |
| UC-03 / TS-ERR-ENV_NOT_FOUND | PASS | high | `cannot read env file missing.env: ENOENT` |
| UC-03 / TS-ERR-ENV_UNREADABLE | PASS | high | `adir: EISDIR` |
| UC-03 / TS-ERR-SCHEMA_NOT_FOUND | PASS | high | `cannot read schema file missing.json: ENOENT` |
| UC-03 / TS-ERR-SCHEMA_INVALID_JSON | PASS | high | `not valid JSON` |
| UC-03 / TS-ERR-SCHEMA_INVALID | PASS | high | `invalid schema inv.json: …` |
| UC-03 / TS-ERR-FINDINGS | PASS | high | `e.env:3: parse error: missing '='`, exit 1 |
| UC-03 / TS-NOGO-01 | PASS | high | exit 2 usage, .env not read |
| UC-03 / TS-NOGO-02 | PASS | high | exit 0, literal compare |
| TSC-2: UC-02 Test Surface covers its own Invariants | PASS | high | INV-01..04 each have a TS-INV row; all rows cite D1–D4 |

## spec-conformance — PASS (threshold: all-pass)
| criterion | verdict | conf | evidence |
|---|---|---|---|
| UC-01 Steps 1-6 + C1 line rules | PASS | high | UC01/steps |
| UC-02 Steps 1-5 + C3 ordering/messages | PASS | high | UC02/steps |
| UC-02 INV-04 (behavior) | PASS | high | UC02/TS-INV-04, 6 calls, no throw |
| UC-03 Steps 1-6 + ux-behavior output order | PASS | high | UC03/output-order |
| UC-03 INV-05 (no ANSI escape sequences in output) | PASS | high | bin/envlint.mjs:12-13, :76, :84, :86; UC03/TS-INV-05-bug1 |
| Domain modules: imports per domain-model.md Modules table | PASS | high | UC03/static |
| Non-Go (_index boundaries) | PASS | high | no write/network/stdin/default .env |
| _index decision 7: package.json bin entry, name unchanged | PASS | high | git diff: only `bin` added |

## tdd-surface — PASS
| criterion | verdict | conf | evidence |
|---|---|---|---|
| TDD-1: project suite `node --test` green | PASS | high | `node --test` 47/47. Per-scope runs: 15/15, 15/15, 17/17, each exit 0 |
| TDD-2: companion test file per new source file | PASS | high | parse, rules, cli each have one |
| TDD-3: tests target AC behaviors (advisory) | PASS | high | new checks assert exact values: cli.test.mjs:124, rules.test.mjs:137 |

## completeness — PASS (threshold: no-critical)
| criterion | verdict | conf | evidence |
|---|---|---|---|
| CMP-1: every [INV-NN] backed by a task AC | PASS | high | all 13 invariants backed (TASK-002 now carries INV-04) |
| CMP-2: every UC referenced by a task | PASS | high | UC-01←001, UC-02←002, UC-03←003/004 |
| CMP-3: discovery surprise rate (advisory) | PASS | high | 1 [+] of 9 → 0.11 ≤ 0.5 |

## Verdict stability (run 2)
- There is no `.verdicts-*.jsonl` ledger on disk, so I compared against `results/evaluate-r1.json`.
- Four criteria moved FAIL→PASS: UC-03 / TS-INV-05, UC-03 INV-05, TSC-2 and CMP-1. Each flip followed a targeted fix (BUG-1, BUG-3, BUG-2), so these are expected flips and not judge instability.
- The other 40 criteria are stable PASS.
- UC-02 / TS-INV-04 is a new criterion, with no history.

## Spec notes (no bug, PO clarification suggested)
- **The "ASCII-safe" wording in UC-03 INV-05 is ambiguous.** Printable non-ASCII text (`café`) passes through as UTF-8. The TS-INV-05 row, ux-behavior and REQ-28/29 all define the invariant as no escapes, colors or prompts. That definition holds, so I graded on it. If "ASCII-safe" means ASCII-only bytes, the spec should say so.
- **Escaping changes how some paths are echoed.** ux-behavior says `<envfile>` is "the path exactly as given". A path that contains control bytes is now echoed escaped, because INV-05 takes precedence over that wording.
- **One discovery from round 2 is recorded but not fixed.** Ledger item D-R2-1: `src/rules.mjs:66/69` messages still embed raw values. The CLI is the only consumer, and it escapes at render, so this is not graded here.

## Bugs
None.

## Next action
The feature is verified against spec-conformance, tdd-surface, completeness and test-surface-conformance, so it can go to QA and then Ship. integration, security and performance were not evaluated.
