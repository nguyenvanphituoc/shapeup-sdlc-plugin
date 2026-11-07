---
type: ship-report
feature: envlint
date: 2026-11-07
verdict: ~
rounds_used: 2
rounds_judged: 1
qa: skipped
intake_sha256: 7a70801d41c890a141685f8bd7e410389cd6cbc23508db02b4d9c294d12ed4cf
---

# envlint — ship report

> **Shipped without a passing verdict (~).** No criterion was graded as passing; GATE H's baseline comparison cleared it (census: cannot-ship) with 0 items cut. Nothing below is evidence that this feature works.

Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial
ledger, the verdict artifacts, the board — never from a summary of the run.

## Outcome

| | |
|---|---|
| Verdict | **~** |
| Rounds used | 2 |
| Rounds judged | 1 |
| Board | 4/4 tasks done |
| T0 artifacts | 4 |
| QA | skipped |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| cli | 2/2 | — | 2 | kept | no change |
| parsing | 1/1 | — | 1 | kept | baseline |
| rules | 1/1 | — | 1 | kept | baseline |

## Requirements

One row per registered clause. A requirement has evidence when an acceptance criterion
covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the
path back. This is a projection, never a verdict: it never blocked this ship.

**26/26 PASS** · run `envlint-20261107T201828Z-fffef5ce`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.gate.md §The pitch | PASS | UC-CheckRules: `checkSchema` accepts a `KEY → {required,type,enum}` object and returns reasons for `[]`, `{A:1}`, `{A:{type:"float"}}`, `{A:{enum:"x"}}` (TS-ERR-SCHEMA_INVALID) (covers: REQ-1) | UC-CheckRules/TS-ERR-SCHEMA_INVALID → PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-2 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: findings and parse problems print one stdout line each, `<envfile>:<line>: <key>: <message>` (TS-ERR-FINDINGS) (covers: REQ-2) | UC-LintEnvFile Steps 1-9 (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-3 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: exit 1 when anything is printed, exit 0 with empty stdout when clean (TS-REQ-clean) (covers: REQ-3) | UC-LintEnvFile Steps 1-9 (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-4 | pitch.gate.md §The pitch (split 1/3) | PASS | UC-LintEnvFile: a missing env file or missing schema exits 2 with `envlint: cannot read <path>`, no stack trace (TS-ERR-IO) (covers: REQ-4) | UC-LintEnvFile/TS-ERR-IO → PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-5 | pitch.gate.md §The pitch (split 2/3) | PASS | UC-LintEnvFile: a schema that is a directory, not valid JSON, or fails `checkSchema` exits 2 with `envlint:` on stderr (TS-ERR-IO, TS-ERR-SCHEMA) (covers: REQ-5) | UC-LintEnvFile/TS-ERR-IO (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-6 | pitch.gate.md §The pitch (split 3/3) | PASS | UC-ParseEnv: empty string → `{pairs: [], problems: []}` (covers: REQ-6) (+1) | UC-LintEnvFile/TS-REQ-empty-file → PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-7 | pitch.gate.md §The pitch | PASS | UC-ParseEnv: `parse` never throws on malformed input, including `""`, `"=x"`, `"A"` (TS-INV-02) (covers: REQ-7) (+1) | UC-ParseEnv INV-02 (+3) → PASS,PASS,PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-8 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: `envlint --schema <schema.json> <envfile>` reads both files from argv; `--schema=x` and a schema after the env file also work (TS-REQ-schema-position) (covers: REQ-8) | UC-LintEnvFile Steps 1-9 (+2) → PASS,PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-9 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: a `.env` in the working directory is never read (TS-NOGO-01) (covers: REQ-9) | _index Non-Go list (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-10 | pitch.gate.md §The three pieces (split 1/7) | PASS | UC-ParseEnv: `KEY=value`, `# comment` lines and blank lines: pairs for assignments only, comments and blanks skipped (TS-REQ-text-forms) (covers: REQ-10) | UC-ParseEnv Steps 1-9 (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-11 | pitch.gate.md §The three pieces (split 2/7) | PASS | UC-ParseEnv: `# comment` lines produce no pair and no problem (covers: REQ-11) | UC-ParseEnv Steps 1-9 → PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-12 | pitch.gate.md §The three pieces (split 3/7) | PASS | UC-ParseEnv: blank and whitespace-only lines produce no pair and no problem (covers: REQ-12) | UC-ParseEnv Steps 1-9 → PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-13 | pitch.gate.md §The three pieces (split 4/7) | PASS | UC-ParseEnv: `export KEY=value` yields pair `{key:"KEY", value:"value"}` (covers: REQ-13) | UC-ParseEnv Steps 1-9 → PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-14 | pitch.gate.md §The three pieces (split 5/7) | PASS | UC-ParseEnv: `'single'` and `"double"` quoted values come back with the quotes stripped; an unclosed quote is a problem (TS-ERR-PARSE_UNCLOSED_QUOTE) (covers: REQ-14) | UC-ParseEnv Steps 1-9 (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-15 | pitch.gate.md §The three pieces (split 6/7) | PASS | UC-ParseEnv: a line with no `=` or an invalid key is a problem carrying its 1-based line, and every pair carries its 1-based `line` (TS-ERR-PARSE_NO_EQUALS, TS-ERR-PARSE_BAD_KEY) (covers: REQ-15) | UC-ParseEnv Steps 1-9 (+2) → PASS,PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-16 | pitch.gate.md §The three pieces (split 7/7) | PASS | UC-ParseEnv: `src/parse.mjs` exports `parse(text)` returning `{ pairs, problems }`; `node --test test/parse.test.mjs` passes with at least one test (covers: REQ-16) | UC-ParseEnv Steps 1-9 → PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-17 | pitch.gate.md §The three pieces (split 1/4) | PASS | UC-CheckRules: a `required: true` key with no pair yields a `required` finding with `line: null` (TS-ERR-RULE_REQUIRED) (covers: REQ-17) | UC-CheckRules Steps 1-7 (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-18 | pitch.gate.md §The three pieces (split 2/4) | PASS | UC-CheckRules: `type` int/bool/url/string: `1.5`, `yes`, `localhost` each yield a `type` finding with the pair's line; `-3`, `true`, `https://x.y` and any string yield none (TS-ERR-RULE_TYPE) (covers: REQ-18) | UC-CheckRules Steps 1-7 (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-19 | pitch.gate.md §The three pieces (split 3/4) | PASS | UC-CheckRules: a value outside `enum` yields an `enum` finding; a listed value yields none (TS-ERR-RULE_ENUM) (covers: REQ-19) | UC-CheckRules Steps 1-7 (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-20 | pitch.gate.md §The three pieces (split 4/4) | PASS | UC-CheckRules: `src/rules.mjs` exports `checkSchema` and `check`; `node --test test/rules.test.mjs` passes with at least one test (covers: REQ-20) | UC-CheckRules Steps 1-7 → PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-21 | pitch.gate.md §The three pieces | PASS | UC-LintEnvFile: `bin/envlint.mjs` exists with a `#!/usr/bin/env node` shebang and `node --check bin/envlint.mjs` exits 0 (covers: REQ-21) (+1) | UC-LintEnvFile Steps 1-9 (+2) → PASS,PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-22 | pitch.gate.md §The three pieces | PASS | UC-ParseEnv: `src/parse.mjs` imports neither `node:fs` nor `src/rules.mjs` (TS-INV-01) (covers: REQ-22) (+1) | UC-ParseEnv INV-01 (+3) → PASS,PASS,PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-23 | pitch.gate.md §Boundaries | PASS | UC-LintEnvFile: the fixture directory is unchanged after every run (TS-INV-01) (covers: REQ-23) | UC-LintEnvFile INV-01 (+2) → PASS,PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-24 | pitch.gate.md §Boundaries | PASS | UC-ParseEnv: `parse("A=${B}")` returns the literal value `${B}` (TS-NOGO-01) (covers: REQ-24) | _index Non-Go list (+1) → PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-25 | pitch.gate.md §Boundaries | PASS | UC-LintEnvFile: stdout and stderr carry no ANSI escapes and the CLI never reads stdin (TS-INV-03) (covers: REQ-25) | UC-LintEnvFile INV-03 (+1) → FAIL,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |
| REQ-26 | pitch.gate.md §Boundaries | PASS | UC-CheckRules: `url` is judged by `new URL()` only and opens no connection (TS-INV-02) (covers: REQ-26) | UC-CheckRules INV-02 (+2) → PASS,PASS,PASS | a3f1a3087fc8, 666293cd1fe8, f05de7a8b59e |

## Ratchet

Measured over this run's trial ledger. A monotone series is a ratchet working; a flat or
sawtooth series says the loop is still a budgeted retry loop wearing a ratchet's shape.

| | |
|---|---|
| Trials | 4 across 3 scope(s), 1 with more than one attempt |
| Improvement rate | 1 — kept ÷ trials after the first |
| Monotone rate | 1 — multi-trial scopes whose score never decreased |
| Sawtooth count | 0 — a revert immediately after a keep |
| Mean trials to green | 1 |
| Statuses | kept 4 |

## Evaluation

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

### Refuted criteria and bugs

### BUG-1 — major
criterion: SC-INV, UC-LintEnvFile INV-03 (also bears on the REQ-25 "no colors")
location: bin/envlint.mjs:57 (also :54). The echoed text comes from src/rules.mjs (`got "${pair.value}"`) and src/parse.mjs (`invalid key "${key}"`)
repro: schema `{"A":{"type":"int"}}`, env file `A=\x1b[31mred`, then `node bin/envlint.mjs --schema s.json app.env` (see evaluation/evidence/probe-r1-ansi.mjs)
expected: stdout carries no ANSI escape sequences (UC-LintEnvFile INV-03)
actual: stdout `app.env:1: A: expected int, got "\u001b[31mred"`. The same happens for an ESC in an env key (PARSE_BAD_KEY message) and in a schema key (missing-key line)
fix_hint: escape control characters (at least `\x1b`, and C0/C1 controls generally) in printed text at the CLI print site, e.g. render them as `\x1b`, and add a test with an ESC-bearing value. Retrofit note (TSC, not graded): TS-INV-03 could add an ESC-bearing input so the row matches the invariant

## Discovered, not built

+ knowledge-base file shapeup/knowledge-base/task-executor.md named by kb_rules_path does not exist

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
