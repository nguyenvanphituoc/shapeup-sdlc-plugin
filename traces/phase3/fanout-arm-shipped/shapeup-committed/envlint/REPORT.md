---
type: ship-report
feature: envlint
date: 2026-08-17
verdict: PASS
rounds_used: 0
qa: run
intake_sha256: 0d5b6d952418a2b3889c6a039d96a2c9ca6ea95194962b5252fa61c456421596
---

# envlint — ship report

Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial
ledger, the verdict artifacts, the board — never from a summary of the run.

## Outcome

| | |
|---|---|
| Verdict | **PASS** |
| Rounds used | 0 |
| Board | 4/4 tasks done |
| T0 artifacts | 4 |
| QA | run |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| cli-composition-root | 1/1 | 0 | 1 | kept | baseline |
| parsing-engine | 1/1 | 0 | 1 | kept | baseline |
| rules-engine | 1/1 | 0 | 1 | kept | baseline |
| test-surface-suite | 1/1 | 0 | 1 | kept | baseline |

## Ratchet

Measured over this run's trial ledger. A monotone series is a ratchet working; a flat or
sawtooth series says the loop is still a budgeted retry loop wearing a ratchet's shape.

| | |
|---|---|
| Trials | 4 across 4 scope(s), 0 with more than one attempt |
| Improvement rate | 0 — kept ÷ trials after the first |
| Monotone rate | 0 — multi-trial scopes whose score never decreased |
| Sawtooth count | 0 — a revert immediately after a keep |
| Mean trials to green | 1 |
| Statuses | kept 4 |

> No scope needed a second attempt, so the rates above are vacuous rather than bad:
> the ratchet was never asked to climb. The Day-1 question — does the loop measurably
> improve across attempts — needs a run where at least one scope retries.

## Evaluation

| Criterion | Dimension | Verdict | Confidence | Reprobed | Evidence |
|---|---|---|---|---|---|
| UC-01 Steps 1-8 (parse/read/validate/render/exit) | spec-conformance | PASS | high | n/a | `npm test` 64/64; `bin/envlint.mjs:9-89` matches steps; direct CLI probe above |
| INV-01 extra key never a finding | spec-conformance | PASS | high | n/a | TS-INV-01 pass; `src/rules.mjs:52` only iterates `Object.keys(schema)` |
| INV-02 dedup: last occurrence wins | spec-conformance | PASS | high | n/a | TS-INV-02/02b pass; `src/rules.mjs:47-49` `lastByKey` overwrite semantics |
| INV-03 exit code always 0/1/2, no stack trace | spec-conformance | PASS | high | n/a | TS-INV-03 pass; `bin/envlint.mjs:9-12` `fail()` always sets `process.exitCode`, no throw paths reach top level |
| INV-04 --json changes only rendering | spec-conformance | PASS | high | n/a | TS-INV-04 pass; direct probe above shows same exit codes across `--json` on/off |
| INV-05 every exit-2 msg `Error: `, one line, stderr | spec-conformance | PASS | high | n/a | TS-INV-05 pass; `bin/envlint.mjs:9-12` |
| INV-06 E3 required-vs-not-required ok/exit split | spec-conformance | PASS | high | n/a | TS-INV-06 + TS-ERR-E3 both pass |
| Error Cases E_NOFLAG/E_SCHEMA_UNREADABLE/E2/E1/E3/E4/E5 | spec-conformance | PASS | high | n/a | TS-ERR-* rows all pass; direct probe confirms E_NOFLAG/E_SCHEMA_UNREADABLE live |
| Test Surface (25 rows TS-INV-*/TS-ERR-*/TS-REQ-*/TS-TYPE-*/TS-NOGO-*) | test-surface-conformance | PASS | high | n/a | all 25 corresponding test names present and passing in `npm test` output above, 1:1 by ID |
| domain-model.md aggregate rules (Finding/LintReport shape) | spec-conformance | PASS | high | n/a | `report = {ok, findings, checked}` in `bin/envlint.mjs:73`; `Finding {line,key,message}` in `src/rules.mjs:39-43,58,64` |
| scope-summary.md Done-when | spec-conformance | PASS | high | n/a | all 4 scopes (parsing-engine, rules-engine, cli-composition-root, test-surface-suite) have source + passing tests |
| _index.md Non-Go (no interpolation, no file writes, no TUI/color, no network) | spec-conformance | PASS | high | n/a | TS-NOGO-01..04 all pass |

### Refuted criteria and bugs

None found.

## QA findings

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary overflow | C-01 (encoding/size), C-02 (schema shape/type edges), C-03 (argv edges) | 5 | 0 |
| ② Concurrency | C-04 (not executed — read-only, no shared mutable resource per TS-NOGO-02) | 0 | 0 |
| ③ State interruption | (single-process invocation, no persistence — inapplicable, confirmed not hunted beyond reasoning) | 0 | 0 |
| ④ Cross-UC journey | (single UC in this feature — no journey to chain) | 0 | 0 |
| ⑤ No-go probing | C-05 (directory-as-path, path-shape breaches) | 0 | 0 |
| ⑥ Data residue | (no persistence per TS-NOGO-02/04 — inapplicable) | 0 | 0 |

→ details live in `.shapeup/envlint/discovery/ledger.md` under the `## Discovered` section ingest
  appends for this hunt's order.

## Discovered, not built

+ [ORIENT] A naive url-type check that omits the http/https protocol gate (try{new URL(v)}catch{} alone) silently passes ftp:// and mailto:// values -- Test Surface needs a non-http(s)-scheme case, not just a malformed-string case.
+ [ORIENT] EXPECTED.md never states the combined form `export KEY="value"` -- worth an explicit fixture so parse order (strip export, trim, strip quotes) is unambiguous.
+ [ORIENT] Duplicate-key override interacting with a Rules check (e.g. a later PORT= assignment that itself fails validation) is unspecified by EXPECTED.md -- confirm Rules evaluates the winning value, not the first.
+ [ORIENT] An empty schema object {} against a non-empty env file is not in EXPECTED.md's E1-E5 list -- should exit 0 with 'ok: N keys checked'; worth an explicit fixture.
~ [ORIENT] --json findings array ordering (file order vs schema-key order) is not pinned by EXPECTED.md -- confirm with PO/BA before an implementation picks one.

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
