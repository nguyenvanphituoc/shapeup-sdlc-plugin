---
type: ship-report
feature: envlint
date: 2026-11-07
verdict: PASS
rounds_used: 1
rounds_judged: 1
qa: run
intake_sha256: 7a70801d41c890a141685f8bd7e410389cd6cbc23508db02b4d9c294d12ed4cf
---

# envlint — ship report

Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial
ledger, the verdict artifacts, the board — never from a summary of the run.

## Outcome

| | |
|---|---|
| Verdict | **PASS** |
| Rounds used | 1 |
| Rounds judged | 1 |
| Board | 3/3 tasks done |
| T0 artifacts | 3 |
| QA | run |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| cli | 1/1 | — | 1 | kept | baseline |
| parsing | 1/1 | — | 1 | kept | baseline |
| rules | 1/1 | — | 1 | kept | baseline |

## Requirements

One row per registered clause. A requirement has evidence when an acceptance criterion
covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the
path back. This is a projection, never a verdict: it never blocked this ship.

**32/33 PASS · 1 no evidence (REQ-8 ← pitch.gate.md §The pitch)** · run `envlint-20261107T200500Z-db1688fa`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: `envlint --schema s.json e.env` reads exactly those two fixture files (covers: REQ-1, REQ-8) | UC-LintEnvFile steps 1-7 and ux-behavior Terminal Output → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-2 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: env `PORT=abc\nJUNK` with schema `{"PORT":{"type":"int"},"DB":{"required":true}}` prints `<f>:1: PORT: expected int, got "abc"`, `<f>:2: expected KEY=value`, `<f>: DB: required key is missing` and exits 1 (covers: REQ-2, REQ-3) | UC-LintEnvFile steps 1-7 and ux-behavior Terminal Output (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-3 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: env `PORT=abc\nJUNK` with schema `{"PORT":{"type":"int"},"DB":{"required":true}}` prints `<f>:1: PORT: expected int, got "abc"`, `<f>:2: expected KEY=value`, `<f>: DB: required key is missing` and exits 1 (covers: REQ-2, REQ-3) (+1) | UC-LintEnvFile steps 1-7 and ux-behavior Terminal Output (+2) → PASS,PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-4 | pitch.gate.md §The pitch (split 1/3) | PASS | UC-LintEnvFile: a missing env file → exit 2, stderr names the path, no `    at ` stack frame (covers: REQ-4) | UC-LintEnvFile TS-ERR-ENV_UNREADABLE → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-5 | pitch.gate.md §The pitch (split 2/3) | PASS | UC-LintEnvFile: a missing schema, a schema `{not json`, and a schema `{"A":{"type":"float"}}` → exit 2, stderr names the schema, no stack frame (covers: REQ-5) | UC-LintEnvFile TS-ERR-SCHEMA_UNREADABLE → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-6 | pitch.gate.md §The pitch (split 3/3) | PASS | UC-ParseEnvText: `parse("")` and `parse("# only\n\n")` return `{pairs: [], problems: []}` (covers: REQ-6) (+1) | UC-ParseEnvText TS-REQ-text-empty (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-7 | pitch.gate.md §The pitch | PASS | UC-ParseEnvText: `parse` never throws on `"="`, `"\0\n'"`, or a long random string — asserted in the test (covers: REQ-7) (+2) | UC-ParseEnvText TS-INV-01 (+2) → PASS,PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-8 | pitch.gate.md §The pitch | no evidence | UC-LintEnvFile: `envlint --schema s.json e.env` reads exactly those two fixture files (covers: REQ-1, REQ-8) | — | — |
| REQ-9 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: run in a temp dir holding its own `.env`, pointed at a fixture elsewhere, only the fixture's problems are reported and the dir listing is unchanged afterwards (covers: REQ-9, REQ-28, REQ-30) | UC-LintEnvFile TS-INV-02 → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-10 | pitch.gate.md §The three pieces | PASS | UC-ParseEnvText: `src/parse.mjs` exports `parse(text)` returning `{ pairs, problems }`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-10, REQ-18) | tdd-surface: node --test suite green → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-11 | pitch.gate.md §The three pieces (split 1/6) | PASS | UC-ParseEnvText: `parse("A=1")` yields pair `{key:"A", value:"1", line:1}` (covers: REQ-11) | UC-ParseEnvText steps 1-8 (parse behaviour) → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-12 | pitch.gate.md §The three pieces (split 2/6) | PASS | UC-ParseEnvText: a line starting with `#` yields no pair and no problem (covers: REQ-12) | UC-ParseEnvText steps 1-8 (parse behaviour) → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-13 | pitch.gate.md §The three pieces (split 3/6) | PASS | UC-ParseEnvText: blank lines yield no pair and no problem, and later line numbers still count them (covers: REQ-13) | UC-ParseEnvText steps 1-8 (parse behaviour) → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-14 | pitch.gate.md §The three pieces (split 4/6) | PASS | UC-ParseEnvText: `parse("export A=1")` yields pair `A`=`1` (covers: REQ-14) | UC-ParseEnvText steps 1-8 (parse behaviour) → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-15 | pitch.gate.md §The three pieces (split 5/6) | PASS | UC-ParseEnvText: `parse("A='x y'")` yields value `x y` (covers: REQ-15) | UC-ParseEnvText steps 1-8 (parse behaviour) → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-16 | pitch.gate.md §The three pieces (split 6/6) | PASS | UC-ParseEnvText: `parse('A="x # y"')` yields value `x # y` (covers: REQ-16) | UC-ParseEnvText steps 1-8 (parse behaviour) → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-17 | pitch.gate.md §The three pieces | PASS | UC-ParseEnvText: `parse("A=1\nJUNK")` yields problem `{line: 2}`; `1BAD=x` and `A="open` each yield a problem at their 1-based line (covers: REQ-17) | UC-ParseEnvText steps 1-8 (parse behaviour) (+3) → PASS,PASS,PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-18 | pitch.gate.md §The three pieces (Parsing) | PASS | UC-ParseEnvText: `src/parse.mjs` exports `parse(text)` returning `{ pairs, problems }`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-10, REQ-18) (+1) | UC-ParseEnvText TS-INV-02 → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-19 | pitch.gate.md §The three pieces (split 1/6) | PASS | UC-CheckRules: `check([], {A:{required:true}})` returns one finding for `A` with `line: null` (covers: REQ-19) | UC-CheckRules steps 1-8 (rules behaviour) (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-20 | pitch.gate.md §The three pieces (split 2/6) | PASS | UC-CheckRules: `type: string` accepts any value (covers: REQ-20) | UC-CheckRules steps 1-8 (rules behaviour) (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-21 | pitch.gate.md §The three pieces (split 3/6) | PASS | UC-CheckRules: `type: int` flags `80x` and accepts `80` and `-1` (covers: REQ-21) | UC-CheckRules steps 1-8 (rules behaviour) (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-22 | pitch.gate.md §The three pieces (split 4/6) | PASS | UC-CheckRules: `type: bool` flags `yes` and accepts `true` and `false` (covers: REQ-22) | UC-CheckRules steps 1-8 (rules behaviour) (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-23 | pitch.gate.md §The three pieces (split 5/6) | PASS | UC-CheckRules: `type: url` flags `foo`, `http://`, `a:b`, `mailto:x@y` and accepts `https://example.com` (covers: REQ-23, REQ-33) | UC-CheckRules steps 1-8 (rules behaviour) (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-24 | pitch.gate.md §The three pieces (split 6/6) | PASS | UC-CheckRules: `enum: ["dev","prod"]` flags `qa` and accepts `dev` (covers: REQ-24) | UC-CheckRules steps 1-8 (rules behaviour) (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-25 | pitch.gate.md §The three pieces (Rules) | PASS | UC-CheckRules: `src/rules.mjs` exports `check(pairs, schema)` returning an array of `{key, line, message}`; `node --test test/rules.test.mjs` exits 0 (covers: REQ-25) (+1) | tdd-surface: node --test suite green (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-26 | pitch.gate.md §The three pieces | PASS | UC-LintEnvFile: `bin/envlint.mjs` starts with `#!/usr/bin/env node` and `node --test` exits 0 (covers: REQ-26) (+1) | tdd-surface: node --test suite green (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-27 | pitch.gate.md §The three pieces | PASS | UC-ParseEnvText: `src/parse.mjs` contains no `import` statement — a test reads the file and asserts it (covers: REQ-27, REQ-18) (+1) | completeness: all invariants INV-01..03 of the three UCs hold (+2) → PASS,PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-28 | pitch.gate.md §Boundaries | PASS | UC-LintEnvFile: run in a temp dir holding its own `.env`, pointed at a fixture elsewhere, only the fixture's problems are reported and the dir listing is unchanged afterwards (covers: REQ-9, REQ-28, REQ-30) | completeness: all invariants INV-01..03 of the three UCs hold (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-29 | pitch.gate.md §Boundaries | PASS | UC-ParseEnvText: `parse("A=${B}")` yields the literal value `${B}` (covers: REQ-29) | completeness: all invariants INV-01..03 of the three UCs hold (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-30 | pitch.gate.md §Boundaries | PASS | UC-LintEnvFile: run in a temp dir holding its own `.env`, pointed at a fixture elsewhere, only the fixture's problems are reported and the dir listing is unchanged afterwards (covers: REQ-9, REQ-28, REQ-30) | completeness: all invariants INV-01..03 of the three UCs hold (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-31 | pitch.gate.md §Boundaries | PASS | UC-LintEnvFile: stdout of a findings run contains no `\x1b[` and the process exits with stdin left open and unused (covers: REQ-31) | completeness: all invariants INV-01..03 of the three UCs hold (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-32 | pitch.gate.md §Boundaries | PASS | UC-CheckRules: with `globalThis.fetch` replaced by a function that throws, `type: url` checks still pass and fetch is never called (covers: REQ-32) | completeness: all invariants INV-01..03 of the three UCs hold (+1) → PASS,PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |
| REQ-33 | pitch.gate.md §Boundaries | PASS | UC-CheckRules: `type: url` flags `foo`, `http://`, `a:b`, `mailto:x@y` and accepts `https://example.com` (covers: REQ-23, REQ-33) | UC-CheckRules TS-ERR-BAD_URL → PASS | 165630b9cf01, 877eb9400d9b, a37bd88c4732 |

## Ratchet

Measured over this run's trial ledger. A monotone series is a ratchet working; a flat or
sawtooth series says the loop is still a budgeted retry loop wearing a ratchet's shape.

| | |
|---|---|
| Trials | 3 across 3 scope(s), 0 with more than one attempt |
| Improvement rate | 0 — kept ÷ trials after the first |
| Monotone rate | 0 — multi-trial scopes whose score never decreased |
| Sawtooth count | 0 — a revert immediately after a keep |
| Mean trials to green | 1 |
| Statuses | kept 3 |

> No scope needed a second attempt, so the rates above are vacuous rather than bad:
> the ratchet was never asked to climb. The Day-1 question — does the loop measurably
> improve across attempts — needs a run where at least one scope retries.

## Evaluation

All PASS, confidence high; no FAIL, so no re-probe or flips. Rows per UC: ParseEnvText 7, CheckRules 9, LintEnvFile 9 (see WorkResult for each id).

### Refuted criteria and bugs

None.

## QA findings

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| 1 Boundary | C-01 (values/syntax), C-02 (schema keys) | 2 | 0 |
| 4 Cross-UC journey | C-03 (parse -> rules -> CLI chain) | 1 | 0 |
| 5 No-go probing | C-04 (argument surface) | 1 | 0 |

## Discovered, not built

~ [lens:①boundary] [QA-001] [UC-ParseEnvText] Inline comment `A=5 # c` is parsed as value "5 # c" (int rule then fails)
    repro: 1. printf 'A=5 # c\n' > e; echo '{"A":{"type":"int"}}' > s.json
2. node bin/envlint.mjs --schema s.json e
3. observe: e:1: A: expected int, got "5 # c"
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-ParseEnvText] `A="x"y` reports "unterminated quote" though the quote is terminated
    repro: 1. printf 'A="x"y\n' > e
2. node bin/envlint.mjs --schema s.json e
3. observe: e:1: unterminated quote
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:⑤no-go] [QA-003] [UC-LintEnvFile] `--` and `-` are not accepted; env file named with leading dash or stdin cannot be linted
    repro: 1. node bin/envlint.mjs --schema s.json -- e1
2. observe usage line on stderr, exit 2
3. echo A=1 | node bin/envlint.mjs --schema s.json -  -> same usage line
    severity-hint: cosmetic
    test-gap: unit

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
