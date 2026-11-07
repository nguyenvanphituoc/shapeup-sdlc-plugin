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
| Board | 3/4 tasks done |
| T0 artifacts | 3 |
| QA | run |

> **1 task(s) did not finish** — use cases: UC-CheckEnvAgainstSchema.
> The verdict above grades what was built, not what was planned.

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

**18/25 PASS · 7 no evidence (REQ-9 ← pitch.gate.md §The three pieces — Parsing (split 1/7), REQ-10 ← pitch.gate.md §The three pieces — Parsing (split 2/7), REQ-11 ← pitch.gate.md §The three pieces — Parsing (split 3/7), …)** · run `envlint-20261107T192157Z-60b7d658`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.gate.md §The pitch | PASS | UC-CheckEnvAgainstSchema: every finding carries `key` and `line`, so the CLI can report key by key, line by line (covers: REQ-1) (+2) | UC-LintEnvFile TS-ERR-FINDINGS → PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-2 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: `PORT=abc` with schema `{"PORT":{"type":"int"}}` prints a stdout line naming `PORT` and line 1, and exits 1 (covers: REQ-1, REQ-2) (+1) | UC-LintEnvFile TS-ERR-FINDINGS → PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-3 | pitch.gate.md §The pitch (split 1/3) | PASS | UC-LintEnvFile: a missing env file exits 2 with stderr naming the file and no stack trace (covers: REQ-3, REQ-6) (+1) | UC-LintEnvFile TS-ERR-ENV_NOT_FOUND → PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-4 | pitch.gate.md §The pitch (split 2/3) | PASS | UC-LintEnvFile: a missing schema file, and a schema file holding `{not json`, each exit 2 with stderr naming the schema file and no stack trace (covers: REQ-4, REQ-6) (+1) | UC-LintEnvFile TS-ERR-SCHEMA_UNREADABLE → PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-5 | pitch.gate.md §The pitch (split 3/3) | PASS | UC-ParseEnvText: `parse("")` returns `{pairs: [], problems: []}` (covers: REQ-5) (+2) | UC-ParseEnvText TS-REQ-text-empty (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-6 | pitch.gate.md §The pitch | PASS | UC-ParseEnvText: malformed lines (`=`, an unterminated quote, a line with no `=`) never throw; each is one problem with its line (covers: REQ-6, REQ-14) (+3) | UC-ParseEnvText TS-INV-01 (+3) → PASS,PASS,PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-7 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: `node bin/envlint.mjs --schema <schema.json> <envfile>` reads both files given as arguments; `node --test test/cli.test.mjs` exits 0 (covers: REQ-7, REQ-20) (+1) | UC-LintEnvFile Steps 1-7 / Error Cases → PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-8 | pitch.gate.md §The pitch | PASS | UC-LintEnvFile: a run with no env file argument exits 2 with a usage line, even when the cwd holds a `.env` (covers: REQ-8) | UC-LintEnvFile TS-INV-03 → PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-9 | pitch.gate.md §The three pieces — Parsing (split 1/7) | no evidence | UC-ParseEnvText: `KEY=value` yields `{key:"KEY", value:"value", line:1}` (covers: REQ-9) (+1) | — | — |
| REQ-10 | pitch.gate.md §The three pieces — Parsing (split 2/7) | no evidence | UC-ParseEnvText: `#` comment lines are skipped and produce no pair and no problem (covers: REQ-10) | — | — |
| REQ-11 | pitch.gate.md §The three pieces — Parsing (split 3/7) | no evidence | UC-ParseEnvText: blank lines are skipped and do not shift line numbers of later pairs (covers: REQ-11) | — | — |
| REQ-12 | pitch.gate.md §The three pieces — Parsing (split 4/7) | no evidence | UC-ParseEnvText: `export KEY=value` yields key `KEY` (covers: REQ-12) | — | — |
| REQ-13 | pitch.gate.md §The three pieces — Parsing (split 5/7) | no evidence | UC-ParseEnvText: `K='a b'` and `K="a b"` both yield value `a b` (covers: REQ-13) | — | — |
| REQ-14 | pitch.gate.md §The three pieces — Parsing (split 6/7) | PASS | UC-ParseEnvText: `"A=1\nbad line\nB=2"` yields one problem at line 2 (1-based) and pairs on lines 1 and 3 (covers: REQ-14) (+1) | UC-ParseEnvText TS-INV-01 (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-15 | pitch.gate.md §The three pieces — Parsing (split 7/7) | no evidence | UC-ParseEnvText: `src/parse.mjs` exports `parse(text)` returning `{pairs, problems}`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-15) | — | — |
| REQ-16 | pitch.gate.md §The three pieces — Rules (split 1/4) | PASS | UC-CheckEnvAgainstSchema: a `required: true` key with no pair yields one `MISSING_REQUIRED` finding with `line: null` (covers: REQ-16) (+1) | UC-CheckEnvAgainstSchema TS-ERR-MISSING_REQUIRED → PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-17 | pitch.gate.md §The three pieces — Rules (split 2/4) | PASS | UC-CheckEnvAgainstSchema: `type: "int"` rejects `abc`, accepts `-42`; `type: "bool"` rejects `yes`, accepts `true`/`false`; `type: "string"` accepts anything — each rejection is a `TYPE_MISMATCH` with the pair's line (covers: REQ-17) (+2) | UC-CheckEnvAgainstSchema TS-ERR-TYPE_MISMATCH (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-18 | pitch.gate.md §The three pieces — Rules (split 3/4) | PASS | UC-CheckEnvAgainstSchema: `enum: ["dev","prod"]` rejects `staging` with `NOT_IN_ENUM` and the pair's line (covers: REQ-18) (+1) | UC-CheckEnvAgainstSchema TS-ERR-NOT_IN_ENUM → PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-19 | pitch.gate.md §The three pieces — Rules (split 4/4) | no evidence | UC-CheckEnvAgainstSchema: `src/rules.mjs` exports `check(pairs, schema)` returning an array of findings; `node --test test/rules.test.mjs` exits 0 (covers: REQ-19) | — | — |
| REQ-20 | pitch.gate.md §The three pieces — The CLI | PASS | UC-LintEnvFile: `node bin/envlint.mjs --schema <schema.json> <envfile>` reads both files given as arguments; `node --test test/cli.test.mjs` exits 0 (covers: REQ-7, REQ-20) (+1) | UC-LintEnvFile TS-REQ-clean (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-21 | pitch.gate.md §The three pieces | PASS | UC-ParseEnvText: `src/parse.mjs` has no import of `rules` or `bin/` — `grep -E "import .*(rules\|bin/)" src/parse.mjs` finds nothing (covers: REQ-21) (+1) | UC-ParseEnvText TS-INV-02 (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-22 | pitch.gate.md §Boundaries (split 1/4) | PASS | UC-LintEnvFile: after any run the env file's bytes and the fixture directory listing are unchanged (covers: REQ-22) | UC-LintEnvFile TS-INV-01 (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-23 | pitch.gate.md §Boundaries (split 2/4) | PASS | UC-ParseEnvText: `A=${HOME}` keeps the literal value `${HOME}` (covers: REQ-23) (+1) | UC-ParseEnvText TS-NOGO-01 (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-24 | pitch.gate.md §Boundaries (split 3/4) | PASS | UC-LintEnvFile: stdout and stderr contain no `\x1b[` escape sequence; the process never waits on stdin (covers: REQ-24) | UC-LintEnvFile TS-INV-02 (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |
| REQ-25 | pitch.gate.md §Boundaries (split 4/4) | PASS | UC-CheckEnvAgainstSchema: the url check uses only string parsing (`URL`); `grep -E "fetch\|node:http\|node:https\|node:net\|node:dns" src/rules.mjs` finds nothing (covers: REQ-25) (+1) | UC-CheckEnvAgainstSchema TS-INV-01 (+1) → PASS,PASS | bfae9be3a398, 0ab52739bdeb, 3410aad4ecd6 |

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
| UC-ParseEnvText TS-INV-01 | test-surface-conformance | PASS | high | T0 r1-a1-t2 green, node --test test/parse.test.mjs pass; independent `node --test` 29/29 pass; malformed never throw test; src/parse.mjs:4-35 no throw path |
| UC-ParseEnvText TS-INV-02 | completeness | PASS | high | src/parse.mjs has no import statements (read lines 1-35) |
| UC-ParseEnvText TS-ERR-PARSE_ERROR | test-surface-conformance | PASS | high | T0 r1-a1-t2 green, node --test test/parse.test.mjs pass; independent `node --test` 29/29 pass; bad line in the middle |
| UC-ParseEnvText TS-REQ-text-empty | test-surface-conformance | PASS | high | test empty passes in T0 r1-a1-t2 |
| UC-ParseEnvText TS-NOGO-01 | test-surface-conformance | PASS | high | test no interpolation passes; src/parse.mjs keeps value literal |
| UC-CheckEnvAgainstSchema TS-INV-01 | completeness | PASS | high | url check via new URL only, src/rules.mjs:7-14; test url unreachable host passes in T0 r1-a1-t1 |
| UC-CheckEnvAgainstSchema TS-INV-02 | completeness | PASS | high | src/rules.mjs has no import statements (read lines 1-40) |
| UC-CheckEnvAgainstSchema TS-ERR-MISSING_REQUIRED | test-surface-conformance | PASS | high | test missing required key has line null passes, T0 r1-a1-t1; CLI probe printed REQ missing |
| UC-CheckEnvAgainstSchema TS-ERR-TYPE_MISMATCH | test-surface-conformance | PASS | high | test type mismatches carry the pair line passes; CLI probe PORT=abc -> e.env:1 TYPE mismatch |
| UC-CheckEnvAgainstSchema TS-ERR-NOT_IN_ENUM | test-surface-conformance | PASS | high | test enum rejects values outside the list passes; CLI probe A=${HOME} -> e.env:2 NOT_IN_ENUM |
| UC-CheckEnvAgainstSchema TS-REQ-type-valid | test-surface-conformance | PASS | high | test valid typed values produce no findings passes |
| UC-CheckEnvAgainstSchema TS-NOGO-01 | test-surface-conformance | PASS | high | test url on an unreachable host accepted on shape alone passes; no network code in src/rules.mjs |
| UC-LintEnvFile TS-INV-01 | test-surface-conformance | PASS | high | probe in temp dir: directory listing and env bytes unchanged after run; CLI only calls readFileSync (bin/envlint.mjs:30,37) |
| UC-LintEnvFile TS-INV-02 | test-surface-conformance | PASS | high | probe: no ANSI in stdout/stderr on findings run; stdin closed, process exits |
| UC-LintEnvFile TS-INV-03 | test-surface-conformance | PASS | high | probe: cwd .env with errors, `--schema s.json` alone -> exit 2 usage |
| UC-LintEnvFile TS-INV-04 | test-surface-conformance | PASS | high | probe: random-byte file exit 1 and empty file exit 1 (required key missing), stderr empty, no stack |
| UC-LintEnvFile TS-ERR-USAGE | test-surface-conformance | PASS | high | probe: no args and --schema only -> exit 2, usage line on stderr |
| UC-LintEnvFile TS-ERR-ENV_NOT_FOUND | test-surface-conformance | PASS | high | probe: exit 2, stderr names missing.env, no stack |
| UC-LintEnvFile TS-ERR-SCHEMA_UNREADABLE | test-surface-conformance | PASS | high | probe: missing schema and `{not json` both exit 2 naming schema file, no stack |
| UC-LintEnvFile TS-ERR-FINDINGS | test-surface-conformance | PASS | high | probe: stdout `e.env:1: PORT: PORT must be int, got "abc"` plus missing-key line, exit 1 |
| UC-LintEnvFile TS-REQ-clean | test-surface-conformance | PASS | high | probe: valid env exit 0, empty stdout |
| UC-LintEnvFile TS-REQ-no-assignments | test-surface-conformance | PASS | high | probe: comments-only env exit 1, one MISSING_REQUIRED line, no crash |
| UC-LintEnvFile TS-NOGO-01 | test-surface-conformance | PASS | high | probe: env bytes unchanged after run |
| UC-LintEnvFile TS-NOGO-02 | test-surface-conformance | PASS | high | probe: no ANSI codes in stdout or stderr |
| UC-LintEnvFile TS-NOGO-03 | test-surface-conformance | PASS | high | probe: finding line `A must be one of x, got "${HOME}"` quotes literal |
| UC-LintEnvFile Steps 1-7 / Error Cases | spec-conformance | PASS | high | all CLI probes match Steps and exit-code table; bin/envlint.mjs:14-62 |
| Suite: node --test (project test command) | tdd-surface | PASS | high | node --test exit 0, 29 pass 0 fail; per-scope fixtures green in T0 r1-a1-t1..t3 |

### Refuted criteria and bugs

None.

## QA findings

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01, C-04 | 3 | 0 |
| ② Concurrency | none (single-shot CLI, read-only) | 0 | 0 |
| ③ State interruption | none | 0 | 0 |
| ④ Cross-UC | C-02 | 2 | 1 |
| ⑤ No-go | C-03 | 1 | 0 |
| ⑥ Data residue | none (no state kept) | 0 | 0 |

Findings: QA-001 inline comments; QA-002 CR-only line endings; QA-003 unknown schema type accepted silently; QA-004 control/ANSI bytes echoed (contradicts TS-NOGO-02); QA-005 duplicate keys flagged on a shadowed earlier line; QA-006 repeated --schema silently last-wins.
Details with repro are in the WorkResult discoveries[].

## Discovered, not built

~ [lens:①boundary] [QA-001] [UC-ParseEnvText] Inline trailing comments are kept in the value (A=1 # c fails int; B="a" # c reports unterminated quote)
    repro: 1. printf 'A=1 # c\n' > e.env; echo '{"A":{"type":"int"}}' > s.json
2. node bin/envlint.mjs --schema s.json e.env
3. exit 1: e.env:1: A: A must be int, got "1 # c"; with B="a" # c the line is reported 'unterminated quote'
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-ParseEnvText] CR-only line endings are not split; whole file becomes one value
    repro: 1. printf 'A=1\rB=abc\r' > e.env
2. node bin/envlint.mjs --schema s.json e.env (s.json: A int)
3. exit 1: A must be int, got "1\rB=abc" (B never parsed)
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-CheckEnvAgainstSchema] Unknown or prototype-named schema type is silently accepted (type float / toString / constructor never flag)
    repro: 1. echo '{"A":{"type":"float"},"B":{"type":"toString"}}' > s.json; printf 'A=zzz\nB=zzz\n' > e.env
2. node bin/envlint.mjs --schema s.json e.env
3. exit 0, no output; a typo in the schema disables the check with no warning. 'toString' resolves via TYPE_CHECKS prototype lookup (src/rules.mjs:~34)
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:④cross-UC] [QA-004] [UC-LintEnvFile] Control/ANSI bytes in an env value are echoed raw to stdout, so output can carry ANSI escapes
    repro: 1. printf 'A=abc\033[31mred\n' > e.env; s.json: A int
2. node bin/envlint.mjs --schema s.json e.env | od -c | head
3. stdout contains ESC [ 31 m from the input value
    severity-hint: boundary-breach
    test-gap: integration
    contradicts: UC-LintEnvFile TS-NOGO-02
~ [lens:④cross-UC] [QA-005] [UC-LintEnvFile] Duplicate keys: an earlier shadowed line is flagged even when the last value is valid
    repro: 1. printf 'A=abc\nA=1\n' > e.env; s.json: A int
2. node bin/envlint.mjs --schema s.json e.env
3. exit 1 flags line 1 although the effective (last) value is 1; reverse order (A=1 then A=abc) flags line 2. Contract silent on duplicates
    severity-hint: ux-degradation
    test-gap: integration
~ [lens:⑤no-go] [QA-006] [UC-LintEnvFile] Repeated --schema silently last-wins; bare '--' is treated as the env filename
    repro: 1. node bin/envlint.mjs --schema s3.json --schema s10.json e1.env -> exit 0, first schema ignored without notice
2. node bin/envlint.mjs --schema s10.json -- e1.env -> exit 2 usage (-- is taken as envfile, then e1.env is an extra arg)
    severity-hint: cosmetic
    test-gap: unit

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
