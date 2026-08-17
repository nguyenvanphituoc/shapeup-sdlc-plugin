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
| T0 artifacts | 6 |
| QA | run |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| cli-composition-root | 1/1 | 0 | 1 | kept | baseline |
| parsing-engine | 1/1 | 0 | 2 | kept | no change |
| rules-engine | 1/1 | 0 | 2 | kept | no change |
| test-surface-suite | 1/1 | 0 | 1 | kept | baseline |

## Ratchet

Measured over this run's trial ledger. A monotone series is a ratchet working; a flat or
sawtooth series says the loop is still a budgeted retry loop wearing a ratchet's shape.

| | |
|---|---|
| Trials | 6 across 4 scope(s), 2 with more than one attempt |
| Improvement rate | 1 — kept ÷ trials after the first |
| Monotone rate | 1 — multi-trial scopes whose score never decreased |
| Sawtooth count | 0 — a revert immediately after a keep |
| Mean trials to green | 1 |
| Statuses | kept 6 |

## Evaluation

| Criterion | Probe | Verdict | Confidence | Evidence |
|---|---|---|---|---|
| UC-01 Steps 1-8 (argv parse → schema read → env read → parseEnv → evaluate → compose → render → exit) | [cmd] | PASS | high | `node --test` — `cli.test.mjs` all 10 pass; `bin/envlint.mjs:1-90` matches Steps order |
| INV-01 (extra key never a finding) | [cmd] | PASS | high | TS-INV-01 pass, `test/test-surface.test.mjs:34-40` |
| INV-02 (dedup: last wins, earlier produces nothing) | [cmd] | PASS | high | TS-INV-02 / TS-INV-02b pass, `test/test-surface.test.mjs:42-58` |
| INV-03 (exit code always 0/1/2, no stack trace) | [cmd] | PASS | high | TS-INV-03 pass |
| INV-04 (`--json` changes only rendering, not branch/exit) | [cmd] | PASS | high | TS-INV-04 pass |
| INV-05 (exit-2 stderr `Error: ` prefix, single line, no stack) | [cmd] | PASS | high | TS-INV-05 pass |
| INV-06 (E3 zero-required exemption) | [cmd] | PASS | high | TS-INV-06 pass |
| Error Cases E_NOFLAG/E_SCHEMA_UNREADABLE/E2/E1/E3/E4/E5 | [cmd] | PASS | high | TS-ERR-* (7 rows) all pass |
| Type rules: int/bool/url/enum/empty-value | [cmd] | PASS | high | TS-TYPE-* (7 rows) all pass |
| Non-Go: no interpolation / no `.env` writes / no colors-TUI-prompts / no network | [cmd] | PASS | high | TS-NOGO-01..04 all pass |
| domain-model.md value objects (`EnvPair`/`ParseProblem`/`SchemaRule`/`Finding`/`LintReport`) | [cmd] | PASS | high | `parsing.test.mjs` + `rules.test.mjs` unit-level assertions on each shape, all pass |
| scope-summary.md Wave 3 Done-when (`test/test-surface.test.mjs` drives binary per TS-* row) | [cmd] | PASS | high | file exists, 26 tests, `child_process.spawnSync` against real fixtures — round-1 defect resolved |

### Refuted criteria and bugs

None found this round.

## QA findings

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01, C-02, C-03 | 3 | 1 |
| ⑤ No-go | C-04 | 0 | 0 |
| ⑥ Data residue | C-05 | 0 | 0 |

→ full finding details land in `.shapeup/envlint/discovery/ledger.md` under the `## Discovered`
  section ingest appends for this hunt's order.

## Discovered, not built

~ [lens:①boundary] [QA-001] [UC-01] An unrecognized argv flag (e.g. --unknown-flag) between --schema <path> and the real envfile argument is silently treated as the positional envPath, dropping the real envfile argument entirely
    repro: 1. schema.json: {"X":{"type":"int"}}
2. envfile.env: X=1
3. Run: node bin/envlint.mjs --schema schema.json --unknown-flag envfile.env
4. Observed: stderr "Error: cannot read env file: --unknown-flag", exit 2 -- envfile.env is never read
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-01] A schema rule value that is not an object (e.g. {"X":"int"} instead of {"type":"int"}) silently disables all type/enum checking for that key -- an otherwise-invalid value is reported ok
    repro: 1. schema.json: {"X":"int"}
2. envfile.env: X=notanumber
3. Run: node bin/envlint.mjs --schema schema.json --json envfile.env
4. Observed: {"ok":true,"findings":[],"checked":1}, exit 0 -- an equivalent well-formed rule {"type":"int"} would fail this value
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-01] A schema document that parses as valid JSON but is not an object (e.g. the literal null) crashes with an uncaught TypeError and a full stack trace on stderr, exit code 1 -- violates INV-03 (never a stack trace, exit code always 0/1/2) and INV-05 (exit-2 tool errors: single-line Error: -prefixed stderr)
    repro: 1. schema.json content: null (valid JSON)
2. envfile.env: X=1
3. Run: node bin/envlint.mjs --schema schema.json --json envfile.env
4. Observed stderr: "TypeError: Cannot convert undefined or null to object" plus full multi-line Node stack trace (at Object.keys, at main, bin/envlint.mjs:68:26), no "Error: " prefix
5. Observed exit code: 1 (not 2)
    severity-hint: data-integrity
    test-gap: unit
    contradicts: INV-03, INV-05

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
