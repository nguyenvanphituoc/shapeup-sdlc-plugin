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
| Board | 4/4 tasks done |
| T0 artifacts | 3 |
| QA | run |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| cli | 2/2 | — | 1 | kept | baseline |
| parsing | 1/1 | — | 1 | kept | baseline |
| rules | 1/1 | — | 1 | kept | baseline |

## Requirements

One row per registered clause. A requirement has evidence when an acceptance criterion
covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the
path back. This is a projection, never a verdict: it never blocked this ship.

**23/27 PASS · 4 no evidence (REQ-1 ← pitch.gate.md — The pitch ¶1, REQ-8 ← pitch.gate.md — The pitch ¶2, REQ-20 ← pitch.gate.md — The three pieces, Rules, …)** · run `envlint-20261107T203949Z-063897fa`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.gate.md — The pitch ¶1 | no evidence | UC-EvaluateRules: a schema of the form `{KEY: {required?, type?, enum?}}` is accepted; any other shape (not an object, unknown field, unknown type, non-string-array enum) yields non-empty `schemaErrors` and `findings: []` (covers: REQ-1) | — | — |
| REQ-2 | pitch.gate.md — The pitch ¶1 | PASS | UC-LintEnvFile: findings and parse problems print one per line to stdout, in line order, as `<envfile>:<line>: <KEY>: <message>`, `<envfile>:<line>: <message>` or `<envfile>: <KEY>: <message>` (covers: REQ-2) | UC-LintEnvFile TS-ERR-FINDINGS → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-3 | pitch.gate.md — The pitch ¶1 | PASS | UC-LintEnvFile: exit 0 when nothing is printed, exit 1 when any problem or finding is printed (covers: REQ-3) | UC-LintEnvFile steps 1-7 (CLI flow and exit codes) (+2) → PASS,PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-4 | pitch.gate.md — The pitch ¶1 (split 1/3) | PASS | UC-LintEnvFile: a missing env file → exit 2, stderr names the path, no stack trace (covers: REQ-4) | UC-LintEnvFile TS-ERR-ENV_UNREADABLE → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-5 | pitch.gate.md — The pitch ¶1 (split 2/3) | PASS | UC-LintEnvFile: a missing schema file, a non-JSON schema and a schema with an unknown `type` → exit 2, stderr names the schema path, no stack trace (covers: REQ-5) | UC-LintEnvFile TS-ERR-SCHEMA_UNREADABLE (+2) → PASS,PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-6 | pitch.gate.md — The pitch ¶1 (split 3/3) | PASS | UC-ParseEnvText: `parseEnv("")` and a comments-only text return `{pairs: [], problems: []}` (covers: REQ-6) (+1) | UC-LintEnvFile TS-REQ-no-assignments → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-7 | pitch.gate.md — The pitch ¶1 | PASS | UC-ParseEnvText: `parseEnv` never throws for any string, tested over `""`, `"="`, a lone quote and non-UTF8-ish text (covers: REQ-7) (+2) | UC-ParseEnvText TS-INV-01 (+2) → PASS,PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-8 | pitch.gate.md — The pitch ¶2 | no evidence | UC-LintEnvFile: `envlint --schema <schema.json> <envfile>` reads exactly those two paths, with no implicit `./.env` lookup (covers: REQ-8) (covers: REQ-9) | — | — |
| REQ-9 | pitch.gate.md — The pitch ¶2 | PASS | UC-LintEnvFile: `envlint --schema <schema.json> <envfile>` reads exactly those two paths, with no implicit `./.env` lookup (covers: REQ-8) (covers: REQ-9) (+1) | UC-LintEnvFile TS-INV-02 → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-10 | pitch.gate.md — The three pieces, Parsing (split 1/5) | PASS | UC-ParseEnvText: `KEY=value` lines become pairs with 1-based `line`, key and value trimmed (covers: REQ-10) | UC-ParseEnvText steps 1-8 (line rules, pairs/problems) (+2) → PASS,PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-11 | pitch.gate.md — The three pieces, Parsing (split 2/5) | PASS | UC-ParseEnvText: lines whose first non-space char is `#` are ignored (covers: REQ-11) | UC-ParseEnvText TS-REQ-forms → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-12 | pitch.gate.md — The three pieces, Parsing (split 3/5) | PASS | UC-ParseEnvText: blank and whitespace-only lines are ignored (covers: REQ-12) | UC-ParseEnvText TS-REQ-forms → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-13 | pitch.gate.md — The three pieces, Parsing (split 4/5) | PASS | UC-ParseEnvText: `export KEY=value` yields the pair `KEY=value` (covers: REQ-13) | UC-ParseEnvText TS-REQ-forms → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-14 | pitch.gate.md — The three pieces, Parsing (split 5/5) | PASS | UC-ParseEnvText: `S='a b'` and `D="c d"` yield values `a b` and `c d`, with no escape processing (covers: REQ-14) | UC-ParseEnvText TS-REQ-forms → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-15 | pitch.gate.md — The three pieces, Parsing | PASS | UC-ParseEnvText: a line with no `=`, an invalid key or an unterminated quote yields a problem carrying its 1-based line number, and the line is skipped (covers: REQ-15) | UC-ParseEnvText steps 1-8 (line rules, pairs/problems) (+3) → PASS,PASS,PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-16 | pitch.gate.md — The three pieces, Parsing | PASS | UC-ParseEnvText: `src/parse.mjs` exports `parseEnv(text)` returning `{pairs: {key,value,line}[], problems: {line,message}[]}`; `node --test test/parse.test.mjs` exits 0 (covers: REQ-16) | UC-ParseEnvText steps 1-8 (line rules, pairs/problems) → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-17 | pitch.gate.md — The three pieces, Rules (split 1/3) | PASS | UC-EvaluateRules: `required: true` with the key absent yields `{key, line: null, rule: "required"}`; `K=` counts as present (covers: REQ-17) | UC-EvaluateRules steps 1-6 (schema validation, rules) (+1) → PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-18 | pitch.gate.md — The three pieces, Rules (split 2/3) | PASS | UC-EvaluateRules: `type` `string` always passes; `int` accepts `^-?[0-9]+$`; `bool` accepts exactly `true`/`false`; a failing value yields `rule: "type"` with the pair's line (covers: REQ-18) (+1) | UC-EvaluateRules steps 1-6 (schema validation, rules) (+1) → PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-19 | pitch.gate.md — The three pieces, Rules (split 3/3) | PASS | UC-EvaluateRules: `enum` rejects a value not in the list, with `rule: "enum"` (covers: REQ-19) | UC-EvaluateRules steps 1-6 (schema validation, rules) (+1) → PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-20 | pitch.gate.md — The three pieces, Rules | no evidence | UC-EvaluateRules: `src/rules.mjs` exports `checkRules(pairs, schema)` returning `{findings, schemaErrors}`; `node --test test/rules.test.mjs` exits 0 (covers: REQ-20) | — | — |
| REQ-21 | pitch.gate.md — The three pieces | PASS | UC-ParseEnvText: `src/parse.mjs` has no `import` of a rules module; a test asserts this by reading the file (covers: REQ-21) (+1) | UC-ParseEnvText TS-INV-02 (+1) → PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-22 | pitch.gate.md — The three pieces, The CLI | PASS | UC-LintEnvFile: missing `--schema`, `--schema` with no value, an unknown option, or anything other than one positional → exit 2, stderr `envlint: …` plus a `usage:` line (covers: REQ-22) | UC-LintEnvFile steps 1-7 (CLI flow and exit codes) (+1) → PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-23 | pitch.gate.md — Boundaries | PASS | UC-LintEnvFile: the CLI never writes any file and does no dotenv-style loading into `process.env` (covers: REQ-23) (covers: REQ-25) (+1) | UC-LintEnvFile TS-INV-02 → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-24 | pitch.gate.md — Boundaries | PASS | UC-ParseEnvText: `A=${HOME}` yields the literal value `${HOME}` (covers: REQ-24) | UC-ParseEnvText TS-NOGO-01 → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-25 | pitch.gate.md — Boundaries | no evidence | UC-LintEnvFile: the CLI never writes any file and does no dotenv-style loading into `process.env` (covers: REQ-23) (covers: REQ-25) | — | — |
| REQ-26 | pitch.gate.md — Boundaries | PASS | UC-LintEnvFile: output has no ANSI escape codes and the CLI never reads stdin (covers: REQ-26) | UC-LintEnvFile TS-NOGO-01 → PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |
| REQ-27 | pitch.gate.md — Boundaries | PASS | UC-EvaluateRules: `type: url` accepts `https://x.com/p` and `postgres://u@h:5432/db`, and rejects `foo:bar`, `localhost:3000`, `http://` and `not a url` (covers: REQ-27) | UC-EvaluateRules TS-INV-02 (+1) → PASS,PASS | c2262e11bd63, 4364596b4236, 095d2954a17d |

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

### Refuted criteria and bugs

None blocking.

## QA findings

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01 line endings/quotes/comments, C-02 control chars/odd bytes, C-03 enum/args | 5 | 0 |
| ② Concurrency | not hunted (stateless read-only CLI, no shared state) | 0 | 0 |
| ③ State interruption | not hunted (single-shot process); closed-stdout not run | 0 | 0 |
| ④ Cross-UC journey | C-04 parse output as rules input (`__proto__`, `constructor` keys, dup keys) | 0 | 0 |
| ⑤ No-go probing | C-05 `${VAR}`, implicit `.env`, `--` positional, `--schema=` | 0 | 0 |
| ⑥ Data residue | n/a (tool writes nothing) | 0 | 0 |

Findings: QA-001 CR-only line endings, QA-002 url `http:///x` and bare-scheme hosts, QA-003 `--help`, QA-004 inline comment, QA-005 empty enum message, QA-006 control chars echoed.
Details live in the ledger under `## Discovered`.

## Discovered, not built

~ [lens:①boundary] [QA-001] [UC-ParseEnvText] A file with CR-only (classic Mac) line endings is read as one line; every later assignment is swallowed into the first value
    repro: 1. printf 'A=1\rB=2\r' > cr.env
2. echo '{"A":{"type":"int"},"B":{"required":true}}' > s.json
3. node bin/envlint.mjs --schema s.json cr.env
=> exit 1, 'cr.env:1: A: expected int, got "1\rB=2"'; B is never parsed as its own pair, so a required B would be reported missing
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-EvaluateRules] type url accepts 'http:///x' (empty authority in the text), and bare 'a://b' / 'mailto://x'; WHATWG normalisation supplies a host the text never had
    repro: 1. echo '{"U":{"type":"url"}}' > su.json
2. printf 'U=http:///x\n' > u.env
3. node bin/envlint.mjs --schema su.json u.env
=> exit 0 (also exit 0 for U=a://b, U=mailto://x, U=http://[::1]). 'http://' alone is correctly rejected.
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-LintEnvFile] --help (and -h) is treated as an unknown option: exit 2 with node's parseArgs wording about placing '-- "--help"', not a help text
    repro: 1. node bin/envlint.mjs --help
=> exit 2, stderr "envlint: Unknown option '--help'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- \"--help\"'" followed by the usage line
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-004] [UC-ParseEnvText] Inline comment after an unquoted value is kept as part of the value, so 'PORT=8080 # http' fails an int check
    repro: 1. printf 'PORT=8080 # http\n' > c.env
2. echo '{"PORT":{"type":"int"}}' > s.json
3. node bin/envlint.mjs --schema s.json c.env
=> exit 1, 'c.env:1: PORT: expected int, got "8080 # http"'. Contract is silent on inline comments; common dotenv files use them.
    severity-hint: ux-degradation
    test-gap: exploratory-only
~ [lens:①boundary] [QA-005] [UC-EvaluateRules] Empty enum array yields the malformed message 'expected one of , got "1"'
    repro: 1. echo '{"A":{"enum":[]}}' > s.json
2. printf 'A=1\n' > ok.env
3. node bin/envlint.mjs --schema s.json ok.env
=> exit 1, 'ok.env:1: A: expected one of , got "1"'
    severity-hint: cosmetic
    test-gap: unit
~ [lens:①boundary] [QA-006] [UC-LintEnvFile] Raw control bytes from the env value (ANSI escapes, CR, NUL) are echoed unescaped into finding lines on stdout, so output can contain escape codes the contract says it never emits
    repro: 1. printf 'A=\033[31mred\n' > ansi.env
2. echo '{"A":{"type":"int"}}' > s.json
3. node bin/envlint.mjs --schema s.json ansi.env | cat -v
=> 'ansi.env:1: A: expected int, got "^[[31mred"' (the ESC byte is passed through)
    severity-hint: cosmetic
    test-gap: unit

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
