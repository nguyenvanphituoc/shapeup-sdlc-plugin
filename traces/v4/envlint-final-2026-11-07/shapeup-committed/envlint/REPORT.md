---
type: ship-report
feature: envlint
date: 2026-11-07
verdict: PASS
rounds_used: 1
rounds_judged: 1
qa: not-hunted
intake_sha256: 0d5b6d952418a2b3889c6a039d96a2c9ca6ea95194962b5252fa61c456421596
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
| Board | 4/4 tasks done |
| T0 artifacts | 3 |
| QA | not-hunted |

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

**20/22 PASS · 2 no evidence (REQ-1 ← pitch.md — The pitch (split 1/4), REQ-16 ← pitch.md — Parsing (split 7/7))** · run `envlint-20261107T143005Z-8bd251a0`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.md — The pitch (split 1/4) | no evidence | UC-EvaluateRules: `validateSchema` accepts `{KEY: {required?, type?, enum?}}` objects and returns `[]` for a valid one (covers: REQ-1) | — | — |
| REQ-2 | pitch.md — The pitch (split 2/4) | PASS | UC-EvaluateRules: Every finding names the key and its line (or `null` for `required`), so output can be key by key, line by line (covers: REQ-2) (+1) | UC-LintEnvFile TS-ERR-FINDINGS (+3) → PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-3 | pitch.md — The pitch (split 3/4) | PASS | UC-LintEnvFile: Exit 1 when anything is printed, exit 0 with empty stdout when clean (covers: REQ-3) | UC-LintEnvFile TS-ERR-FINDINGS (+5) → PASS,PASS,PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-4 | pitch.md — The pitch (split 4/4, edge 1/3) | PASS | UC-LintEnvFile: A missing env file → exit 2, `envlint: cannot read <path>: …` on stderr (covers: REQ-4) (+1) | UC-LintEnvFile TS-ERR-ENV_UNREADABLE (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-5 | pitch.md — The pitch (edge 2/3) | PASS | UC-LintEnvFile: A missing schema file, a schema that is not JSON, or one `validateSchema` rejects → exit 2, `envlint: cannot read …` / `envlint: invalid schema <path>: …` (covers: REQ-5) (+1) | UC-LintEnvFile TS-ERR-SCHEMA_UNREADABLE (+3) → PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-6 | pitch.md — The pitch (edge 3/3) | PASS | UC-ParseEnvText: `parse("")` and `parse("# only\n\n")` return `{pairs: [], problems: []}` (covers: REQ-6) (+3) | UC-LintEnvFile TS-INV-03 (+7) → PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-7 | pitch.md — The pitch | PASS | UC-ParseEnvText: `parse` does not throw for malformed input (`=x`, `"open`, `KEY`, `1A=b`, random bytes) (covers: REQ-7) (+3) | UC-LintEnvFile TS-INV-01 (+7) → PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-8 | pitch.md — arguments paragraph (split 1/2) | PASS | UC-LintEnvFile: `test/cli.test.mjs` exists, spawns `node bin/envlint.mjs` against fixtures it writes to a temp directory, and `node --test test/cli.test.mjs` exits 0 (covers: REQ-8) (+2) | UC-LintEnvFile TS-REQ-arg-order (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-9 | pitch.md — arguments paragraph (split 2/2) | PASS | UC-LintEnvFile: With no env path given, it exits 2 with the usage line and never reads `./.env` in the working directory (covers: REQ-9) (+1) | UC-LintEnvFile TS-INV-02 (+3) → PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-10 | pitch.md — The three pieces / Parsing (split 1/7) | PASS | UC-ParseEnvText: `KEY=value` yields a pair with the trimmed text after the first `=` as value (covers: REQ-10) | UC-ParseEnvText TS-REQ-text-forms (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-11 | pitch.md — Parsing (split 2/7) | PASS | UC-ParseEnvText: Lines whose trimmed text starts with `#` are ignored (covers: REQ-11) | UC-ParseEnvText TS-REQ-text-forms (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-12 | pitch.md — Parsing (split 3/7) | PASS | UC-ParseEnvText: Blank and whitespace-only lines are ignored (covers: REQ-12) | UC-ParseEnvText TS-REQ-text-forms (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-13 | pitch.md — Parsing (split 4/7) | PASS | UC-ParseEnvText: `export KEY=value` yields the same pair as `KEY=value` (covers: REQ-13) | UC-ParseEnvText TS-REQ-text-forms (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-14 | pitch.md — Parsing (split 5/7) | PASS | UC-ParseEnvText: `K='a b'` and `K="a b"` both yield value `a b`; a `#…` comment after the closing quote is allowed (covers: REQ-14) | UC-ParseEnvText TS-REQ-text-forms (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-15 | pitch.md — Parsing (split 6/7) | PASS | UC-ParseEnvText: A line with no `=`, an invalid key, an unterminated quote, or trailing text after a closing quote yields `{line, message}` in `problems` with its 1-based line (covers: REQ-15) | UC-ParseEnvText TS-ERR-PARSE_NO_EQUALS (+7) → PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-16 | pitch.md — Parsing (split 7/7) | no evidence | UC-ParseEnvText: `src/parse.mjs` exists and exports a named function `parse` (covers: REQ-16) (+1) | — | — |
| REQ-17 | pitch.md — The three pieces / Rules (split 1/4) | PASS | UC-EvaluateRules: A `required: true` key absent from pairs yields one finding `{key, line: null, rule: "required", message}` (covers: REQ-17) | UC-EvaluateRules TS-ERR-REQUIRED_MISSING (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-18 | pitch.md — Rules (split 2/4) | PASS | UC-EvaluateRules: `type: int` accepts `12`, `-3` and flags `1.5`, `x`; `type: bool` accepts `true`, `false` and flags `yes`, `TRUE`; `type: string` accepts anything (covers: REQ-18) (+1) | UC-EvaluateRules TS-INV-03 (+3) → PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-19 | pitch.md — Rules (split 3/4) | PASS | UC-EvaluateRules: `enum: ["a","b"]` flags value `c` with a finding at that value's line (covers: REQ-19) | UC-EvaluateRules TS-ERR-ENUM_MISMATCH (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-20 | pitch.md — Rules (split 4/4) | PASS | UC-EvaluateRules: `src/rules.mjs` exists and exports named functions `validateSchema` and `lint` (covers: REQ-20) (+1) | UC-EvaluateRules TS-REQ-pairs-duplicate (+1) → PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-21 | pitch.md — The three pieces / The CLI | PASS | UC-LintEnvFile: `bin/envlint.mjs` exists, imports `parse` from `../src/parse.mjs` and `validateSchema`, `lint` from `../src/rules.mjs` (covers: REQ-21) (+2) | UC-LintEnvFile TS-ERR-USAGE (+3) → PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |
| REQ-22 | pitch.md — The three pieces | PASS | UC-ParseEnvText: `test/parse.test.mjs` exists; `node --test test/parse.test.mjs` exits 0 run on its own (covers: REQ-22) (+3) | UC-ParseEnvText TS-INV-02 (+3) → PASS,PASS,PASS,PASS | d9b092467045, 02c386ba4468, 1f2e4df74344 |

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

All 30 Test Surface rows (UC-LintEnvFile 13, UC-ParseEnvText 9, UC-EvaluateRules 8) PASS; see result JSON for per-row evidence. Non-Go (no .env writing, no interpolation, no dotenv loading) PASS: no write/env-assignment calls in source; TS-NOGO-01..03 and parse TS-NOGO-02 green.

### Refuted criteria and bugs

None.

## QA findings

None. Nothing was hunted.

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
