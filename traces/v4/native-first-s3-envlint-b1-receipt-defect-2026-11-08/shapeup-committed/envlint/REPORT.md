---
type: ship-report
feature: envlint
date: 2026-11-07
verdict: ~
rounds_used: 1
rounds_judged: 1
qa: skipped
intake_sha256: 7a70801d41c890a141685f8bd7e410389cd6cbc23508db02b4d9c294d12ed4cf
---

# envlint — ship report

> **Shipped without a passing verdict (~).** No criterion was graded as passing; GATE H's baseline comparison cleared it (census: cannot-ship) with 1 item cut. Nothing below is evidence that this feature works.

Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial
ledger, the verdict artifacts, the board — never from a summary of the run.

## Outcome

| | |
|---|---|
| Verdict | **~** |
| Rounds used | 1 |
| Rounds judged | 1 |
| Board | 4/4 tasks done |
| T0 artifacts | 3 |
| QA | skipped |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| cli | 2/2 | — | 1 | kept | baseline |
| parse-env | 2/2 | — | 1 | kept | baseline |
| rules-engine | 2/2 | — | 1 | kept | baseline |

## Requirements

One row per registered clause. A requirement has evidence when an acceptance criterion
covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the
path back. This is a projection, never a verdict: it never blocked this ship.

**27/31 PASS · 4 no evidence (REQ-10 ← pitch.gate.md §The three pieces, Parsing (split 1/8), REQ-17 ← pitch.gate.md §The three pieces, Parsing (split 8/8), REQ-22 ← pitch.gate.md §The three pieces, Rules (split 5/5), …)** · run `envlint-20261107T193500Z-159af909`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.gate.md §The pitch ¶1 (split 1/4) | PASS | UC-LintEnvFile: `node bin/envlint.mjs --schema <schema.json> <envfile>` reads exactly those two paths; `--schema` may come before or after the envfile (covers: REQ-1, REQ-8, REQ-23) | UC-LintEnvFile Steps 1-8 + ux RULE-01/02/03/06 → PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-2 | pitch.gate.md §The pitch ¶1 (split 2/4) | PASS | UC-LintEnvFile: Output lines follow RULE-01/RULE-02 exactly: line-numbered items ascending, then missing-required in schema order (covers: REQ-2) (+1) | UC-LintEnvFile Steps 1-8 + ux RULE-01/02/03/06 (+2) → PASS,FAIL,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-3 | pitch.gate.md §The pitch ¶1 (split 3/4) | PASS | UC-LintEnvFile: Exit 0 with no output when clean, 1 on any problem or finding, 2 on usage/read/schema errors (covers: REQ-3) (+1) | UC-LintEnvFile Steps 1-8 + ux RULE-01/02/03/06 (+3) → PASS,PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-4 | pitch.gate.md §The pitch ¶1 (split 4/4, edge 1/3) | PASS | UC-LintEnvFile: A missing envfile and a missing schema each exit 2 with `envlint: cannot read <path>` on stderr (covers: REQ-4) (+1) | UC-LintEnvFile TS-ERR-READ_FAILED → PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-5 | pitch.gate.md §The pitch ¶1 (edge 2/3) | PASS | UC-EvaluateRules: `validateSchema` returns ≥1 message for every malformed shape in [[usecases/UC-EvaluateRules#Test Surface]] TS-ERR-SCHEMA_INVALID and `[]` for a valid one (covers: REQ-5) (+2) | UC-EvaluateRules Steps (validateSchema, evaluate) (+2) → PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-6 | pitch.gate.md §The pitch ¶1 (edge 3/3) | PASS | UC-ParseEnvText: `parse("")` and comment-only text return `{ pairs: [], problems: [] }` (covers: REQ-6) (+2) | UC-ParseEnvText TS-REQ-empty (+1) → PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-7 | pitch.gate.md §The pitch ¶1 | PASS | UC-LintEnvFile: No input produces a stack trace: every unexpected error is caught and reported as one `envlint:` line with exit 2 (covers: REQ-7) (+1) | UC-LintEnvFile INV-01 / ux RULE-05 (+1) → PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-8 | pitch.gate.md §The pitch ¶2 (split 1/2) | PASS | UC-LintEnvFile: `node bin/envlint.mjs --schema <schema.json> <envfile>` reads exactly those two paths; `--schema` may come before or after the envfile (covers: REQ-1, REQ-8, REQ-23) | UC-LintEnvFile Steps 1-8 + ux RULE-01/02/03/06 → PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-9 | pitch.gate.md §The pitch ¶2 (split 2/2) | PASS | UC-LintEnvFile: With no envfile argument it exits 2 with the usage line and never reads `./.env` (covers: REQ-9) (+1) | UC-LintEnvFile INV-02 (+2) → PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-10 | pitch.gate.md §The three pieces, Parsing (split 1/8) | no evidence | UC-ParseEnvText: `src/parse.mjs` exports `parse(text)` returning `{ pairs: {key,value,line}[], problems: {line,message}[] }` (covers: REQ-10, REQ-17) | — | — |
| REQ-11 | pitch.gate.md §The three pieces, Parsing (split 2/8) | PASS | UC-ParseEnvText: `KEY=value` lines yield a pair with the 1-based line number (covers: REQ-11) | UC-ParseEnvText Steps 1-8 (+2) → PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-12 | pitch.gate.md §The three pieces, Parsing (split 3/8) | PASS | UC-ParseEnvText: `#` comment lines and an unquoted value's trailing ` # comment` yield nothing / are stripped (covers: REQ-12) | UC-ParseEnvText Steps 1-8 (+1) → PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-13 | pitch.gate.md §The three pieces, Parsing (split 4/8) | PASS | UC-ParseEnvText: Blank and whitespace-only lines yield nothing and still advance the line count (covers: REQ-13) | UC-ParseEnvText Steps 1-8 (+2) → PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-14 | pitch.gate.md §The three pieces, Parsing (split 5/8) | PASS | UC-ParseEnvText: `export KEY=value` yields the pair `KEY=value` (covers: REQ-14) | UC-ParseEnvText Steps 1-8 (+1) → PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-15 | pitch.gate.md §The three pieces, Parsing (split 6/8) | PASS | UC-ParseEnvText: Single-quoted values are literal; double-quoted values support `\n`, `\"`, `\\`; a `#` inside quotes is part of the value (covers: REQ-15) | UC-ParseEnvText Steps 1-8 (+1) → PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-16 | pitch.gate.md §The three pieces, Parsing (split 7/8) | PASS | UC-ParseEnvText: Every Error Case in [[usecases/UC-ParseEnvText#Error Cases]] produces exactly its message at the right 1-based line (covers: REQ-16) | UC-ParseEnvText Error Cases (+5) → PASS,PASS,PASS,PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-17 | pitch.gate.md §The three pieces, Parsing (split 8/8) | no evidence | UC-ParseEnvText: `src/parse.mjs` exports `parse(text)` returning `{ pairs: {key,value,line}[], problems: {line,message}[] }` (covers: REQ-10, REQ-17) | — | — |
| REQ-18 | pitch.gate.md §The three pieces, Rules (split 1/5) | PASS | UC-EvaluateRules: `src/rules.mjs` exports `validateSchema` and `evaluate` with the signatures in [[domain-model#Module Interfaces]] (covers: REQ-18, REQ-22) | UC-EvaluateRules Steps (validateSchema, evaluate) → PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-19 | pitch.gate.md §The three pieces, Rules (split 2/5) | PASS | UC-EvaluateRules: `required: true` with the key absent yields one `MISSING_REQUIRED` finding with `line: null`; an empty value counts as present (covers: REQ-19) | UC-EvaluateRules Steps (validateSchema, evaluate) (+3) → PASS,PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-20 | pitch.gate.md §The three pieces, Rules (split 3/5) | PASS | UC-EvaluateRules: `type` `string`/`int`/`bool`/`url` accept and reject exactly the examples in [[domain-model#Value Types]] (covers: REQ-20) | UC-EvaluateRules Steps (validateSchema, evaluate) (+3) → PASS,PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-21 | pitch.gate.md §The three pieces, Rules (split 4/5) | PASS | UC-EvaluateRules: `enum` yields `NOT_IN_ENUM` at the pair's line for a value outside the list (case-sensitive) (covers: REQ-21) | UC-EvaluateRules Steps (validateSchema, evaluate) (+1) → PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-22 | pitch.gate.md §The three pieces, Rules (split 5/5) | no evidence | UC-EvaluateRules: `src/rules.mjs` exports `validateSchema` and `evaluate` with the signatures in [[domain-model#Module Interfaces]] (covers: REQ-18, REQ-22) | — | — |
| REQ-23 | pitch.gate.md §The three pieces, The CLI | no evidence | UC-LintEnvFile: `node bin/envlint.mjs --schema <schema.json> <envfile>` reads exactly those two paths; `--schema` may come before or after the envfile (covers: REQ-1, REQ-8, REQ-23) (+1) | — | — |
| REQ-24 | pitch.gate.md §The three pieces ¶2 (split 1/2) | PASS | UC-ParseEnvText: `src/parse.mjs` has no import of `./rules.mjs` and no `node:` I/O import; `test/parse.test.mjs` imports only `src/parse.mjs` and `node:test`/`node:assert` (covers: REQ-24, REQ-25) (+1) | UC-ParseEnvText TS-NOGO-01 (+1) → PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-25 | pitch.gate.md §The three pieces ¶2 (split 2/2) | PASS | UC-ParseEnvText: `src/parse.mjs` has no import of `./rules.mjs` and no `node:` I/O import; `test/parse.test.mjs` imports only `src/parse.mjs` and `node:test`/`node:assert` (covers: REQ-24, REQ-25) (+2) | TDD-1 suite green (node --test) → PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-26 | pitch.gate.md §Boundaries (split 1/6) | PASS | UC-LintEnvFile: TS-INV-02: a temp dir holding its own `.env` is byte-identical after the run and that `.env` never appears in output (covers: REQ-9, REQ-26) (+1) | UC-LintEnvFile INV-02 (+3) → PASS,PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-27 | pitch.gate.md §Boundaries (split 2/6) | PASS | UC-ParseEnvText: `${VAR}` and `$VAR` are returned literally (covers: REQ-27) (+1) | UC-ParseEnvText Invariants INV-01..03 (+2) → PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-28 | pitch.gate.md §Boundaries (split 3/6) | PASS | UC-LintEnvFile: TS-NOGO-01: `A=${B}` matches enum `["${B}"]`, exit 0 (covers: REQ-27, REQ-28) (+1) | _index Non-Go (+2) → PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-29 | pitch.gate.md §Boundaries (split 4/6) | PASS | UC-LintEnvFile: Output contains no `\x1b[` and the CLI never reads stdin (covers: REQ-29) (+1) | UC-LintEnvFile INV-03 / ux RULE-04 (no ANSI escape sequences in output) (+1) → FAIL,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-30 | pitch.gate.md §Boundaries (split 5/6) | PASS | UC-EvaluateRules: `url` is decided from the string alone — no `node:dns`/`node:net`/`node:http(s)` import and no `fetch` (covers: REQ-31, REQ-30) (+1) | _index Non-Go (+3) → PASS,PASS,PASS,PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |
| REQ-31 | pitch.gate.md §Boundaries (split 6/6) | PASS | UC-EvaluateRules: `url` is decided from the string alone — no `node:dns`/`node:net`/`node:http(s)` import and no `fetch` (covers: REQ-31, REQ-30) | UC-EvaluateRules TS-INV-01 → PASS | f2221c8736aa, 64e1632fae7d, 02be007e1e80 |

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

### Refuted criteria and bugs

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

## Discovered, not built

+ TS-NOGO-01 (import grep) cannot run inside test/parse.test.mjs: reading the source needs node:fs, which the REQ-25 AC forbids in that file; it was verified by grep outside the suite

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
