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
| T0 artifacts | 3 |
| QA | run |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| cli-pipeline | 2/2 | 0 | 1 | kept | baseline |
| env-parsing | 1/1 | 0 | 1 | kept | baseline |
| schema-rules | 1/1 | 0 | 1 | kept | baseline |

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

| Criterion | Dimension | Verdict | Confidence | Evidence |
|---|---|---|---|---|
| UC-01 TS-UC01-01..10 (parseEnv: comments/blank, export, quote-stripping, unterminated quote, trim, dup-key, E4, E3, never-throws) | spec-conformance | PASS | high | `node --test test/parse.test.mjs` all 10 rows pass; re-read `lib/parse.mjs` line-by-line against UC-01 Steps 1-7, matches |
| UC-02 TS-UC02-01..11 (int/bool/url/string/enum checks, empty value, schema-format, E3, checked count, dup-key-resolved-upstream, no-network url check) | spec-conformance | PASS | high | `node --test test/rules.test.mjs` all 11 rows pass; `lib/rules.mjs` matches rules-contract.md rule-evaluation order |
| UC-03 TS-UC03-01..12 (E1 env/schema unreadable, E2 bad JSON, missing-flag, E3 zero-assignment, E4 render+truncation, E5 --json, ok/findings human render, line:0 render, no-network, CLI composes UC-01+UC-02 only) | spec-conformance | PASS | high | `node --test test/cli.test.mjs test/integration.test.mjs` all pass; live probe of `bin/envlint.mjs` reproduced every branch (see below) |
| Contract triplet — parse-contract.md (Request/Response/Error) | spec-conformance | PASS | high | `lib/parse.mjs` returns `{pairs: Map, problems: Array}` exactly, never throws (TS-UC01-10 + live fuzz not needed, fixtures cover) |
| Contract triplet — rules-contract.md (Request/Response/Error, rule-evaluation order 1-4) | spec-conformance | PASS | high | `lib/rules.mjs` — problems→findings first, then required-missing, then type/enum, then extra-key-no-finding, in that order; matches |
| scope-summary.md Done-when statements | spec-conformance | PASS | high | all 3 scope T0 verdicts green (see citations); `node --test` full suite 45/45 pass |
| _index.md Non-Go list (no .env writing, no ${VAR} interpolation, no dotenv loading, no colors/TUI/prompts, no network ever) | spec-conformance | PASS | high | grep for `writeFileSync`/interpolation/`dotenv`/ANSI codes in `lib/*.mjs` `bin/*.mjs`: none found; `test/integration.test.mjs` "no network access occurs during a run" passes; `url` type check is try/catch + protocol allow-list only (TS-UC02-11/TS-UC03-11) |

### Refuted criteria and bugs

None found.

## QA findings

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01,02,03,04,05,06,07,08,11 | 4 | 0 |
| ④ Cross-UC journey | C-09 | 0 | 0 |
| ⑤ No-go probing | C-10 | 0 | 0 |

→ full finding text lives in `.shapeup/envlint/discovery/ledger.md` under the `## Discovered`
section ingest appends for this hunt's order.

### Findings (summary)

- **QA-001** [UC-01, data-integrity] A `\r\n`-terminated env file fails to parse *any* line: the
  assignment regex's `.` never matches `\r`, so every syntactically valid `KEY=value\r` line is
  captured whole (including the trailing `\r`) by nothing and instead falls through to the
  "no match" branch, becoming an E4 problem. Repro: write `FOO=bar\r\nBAZ=qux\r\n`, run
  `envlint --schema <schema requiring FOO,BAZ> <file>` → both lines reported as
  "not a KEY=VALUE assignment", both required keys reported missing, exit 1. CRLF is a common
  line ending (Windows editors, `git checkout` with `core.autocrlf`) and UC-01's contract makes no
  mention of only supporting `\n`.
- **QA-002** [UC-03 E4 render, boundary-breach] The 30-char truncation in `bin/envlint.mjs`'s
  `truncate()` slices the raw line by UTF-16 code unit (`text.slice(0, max)`), not by codepoint.
  When a multi-byte character (e.g. an emoji surrogate pair) straddles index 30, the slice cuts
  the surrogate pair in half, producing an unpaired surrogate that Node encodes to stdout as the
  UTF-8 replacement character `U+FFFD` (visible as `�`) — corrupted, not just truncated, output.
  Repro: env line = 29 `x` chars + 🎉 + more text (invalid assignment) → human-mode output shows
  `...xxxxxxxxxxxxxxxxxxxxxxxxxxxxx�: not a KEY=VALUE assignment`. Related to but goes beyond the
  EVAL's already-flagged open spec item (byte-vs-char truncation semantics); this is a concrete
  observable corruption, not just an unresolved semantics question.
- **QA-003** [UC-03 argv parsing, ux-degradation] An unrecognized flag (e.g. `--verbose`) is
  silently captured by `parseArgv`'s `else if (!envfile)` branch as the positional envfile
  argument, since it doesn't match `--schema`/`--json` and `envfile` is still unset. The real
  envfile argument that follows is dropped. Repro:
  `envlint --schema s.json --verbose real.env` → `Error: cannot read env file: --verbose`, exit 2
  — a misleading error naming a flag as a missing file, not "unknown option --verbose".
- **QA-004** [UC-03 argv parsing, ux-degradation] Passing two positional file arguments silently
  ignores the second one instead of erroring. Repro: `envlint --schema s.json a.env b.env` runs
  only against `a.env`; `b.env` is silently dropped, no warning, exit reflects only `a.env`.

## Discovered, not built

~ E4 truncation semantics (byte vs char count, ellipsis or not) remain unspecified by EXPECTED.md — no Test Surface row asserts a specific algorithm beyond '≤30 chars of the line text'; flagged in shapeup/envlint/spec/synthesis.md risk register for PO/TL decision before TASK-003 is graded on exact bytes.

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
