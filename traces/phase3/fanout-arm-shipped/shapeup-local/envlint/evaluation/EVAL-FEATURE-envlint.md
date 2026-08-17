---
type: evaluation
feature: envlint
order_id: envlint/evaluate-r1
round: 1
dimensions: [spec-conformance]
verdict: PASS
---

# EVAL — envlint (round 1, feature-level, spec-conformance)

## Verdict: PASS

## Scope of grading
- `shapeup/envlint/spec/usecases/UC-01.md` — Steps, Preconditions, Invariants (INV-01..INV-06),
  Error Cases (E_NOFLAG, E_SCHEMA_UNREADABLE, E2, E1, E3, E4, E5), Test Surface (25 rows).
- `shapeup/envlint/spec/domain-model.md`, `scope-summary.md`, `_index.md` Non-Go list.
- Implementation graded: `bin/envlint.mjs`, `src/parsing.mjs`, `src/rules.mjs`.

## Method
1. Ran the named contract command `npm test` (wraps `node --test`) against the full suite in
   `test/*.test.mjs` — 64/64 pass, 0 fail (captured below).
2. Directly probed the running CLI (`node bin/envlint.mjs ...`) for a representative slice of
   the Test Surface (INV-04 both `--json` branches, E_NOFLAG, E_SCHEMA_UNREADABLE) to confirm
   the test suite's behavior matches the actually-running binary, not just its own mocks.
3. Read `bin/envlint.mjs`, `src/parsing.mjs`, `src/rules.mjs` line-by-line against every UC-01
   Step/Invariant/Error Case to confirm the test assertions are checking the spec's actual
   claims (not a paraphrase).

## `npm test` output (verbatim, captured this run)
```
> envlint@0.0.0 test
> node --test

✔ clean env file against its schema -> exit 0, ok summary
✔ env file missing a required key -> exit 1, finding at line 0
✔ unreadable env file -> exit 2, tool error, empty stdout
✔ missing --schema -> exit 2, stderr Error prefix, single line
✔ unreadable schema file -> exit 2, specific stderr message
✔ schema file not valid JSON -> exit 2, specific stderr message
✔ >=1 finding -> stdout one line per finding then N problem(s), exit 1
✔ --json on the clean branch -> exact JSON doc, exit 0
✔ --json on the findings branch -> exact JSON doc, exit 1
✔ --json never changes exit code or which branch is taken
✔ no exit-2 path prints a raw stack trace or anything to stdout
✔ comments and blank lines produce neither a pair nor a problem
✔ export KEY=value parses identically to KEY=value
✔ export KEY="value" strips both export prefix and matching quotes
✔ KEY="value" / KEY='value' strip matching surrounding quotes only
✔ KEY="value (no closing quote) is left untouched
✔ whitespace around KEY and value is trimmed (outside quotes)
✔ invalid line produces a ParseProblem with correct line number and raw untrimmed text
✔ ParseProblem preserves raw untrimmed indentation
✔ a key assigned more than once produces one EnvPair per occurrence, in file order
✔ every EnvPair/ParseProblem carries the correct 1-based line number
✔ line 1 is reported as 1, and last line with no trailing newline is parsed and numbered
✔ an entirely empty file returns { pairs: [], problems: [] }
✔ a file that is only comments/blank lines returns { pairs: [], problems: [] }
✔ ParseProblem becomes one Finding (E4 shape)
✔ key present in file but absent from schema is never a finding (INV-01)
✔ required:true + key absent from deduped pairs -> Finding with line:0
✔ duplicate key: only LAST occurrence in file order is evaluated (INV-02)
✔ type:int matches /^-?\d+$/
✔ type:bool matches true/false/1/0 case-insensitively
✔ type:url requires new URL() to parse AND protocol http:/https:
✔ type:string accepts any value, including empty
✔ enum requires exact match against listed values
✔ present-but-empty value satisfies string, fails int/bool/url/enum
✔ zero pairs + zero required keys -> zero findings (INV-06 ok branch)
✔ boundary: int leading zero 01 is valid
✔ boundary: int invalid set 1.5/1e3/""/5-/+5 all invalid
✔ boundary: bool TRUE/False/1/0 valid, yes/2 invalid
✔ TS-INV-01: extra key not in schema -> exit 0, no finding for it
✔ TS-INV-02: earlier invalid value, later valid value -> exit 0, no finding
✔ TS-INV-02b: earlier valid value, later invalid value -> exit 1, exactly one finding
✔ TS-INV-03: exit code is always 0/1/2 across E1/E2/E3/E4/clean/findings, no uncaught exception
✔ TS-INV-04: --json vs non-json, same fixture -> both exit 1, --json prints exactly one JSON doc
✔ TS-INV-05: E_NOFLAG/E_SCHEMA_UNREADABLE/E2/E1 all exit 2 with single-line Error: stderr
✔ TS-INV-06: zero assignments, schema with zero required keys -> exit 0, ok printed
✔ TS-ERR-E_NOFLAG: no --schema -> exit 2, stderr Error: prefix
✔ TS-ERR-E_SCHEMA_UNREADABLE: nonexistent schema -> exit 2, specific stderr
✔ TS-ERR-E2: schema file invalid JSON (trailing comma) -> exit 2, specific stderr
✔ TS-ERR-E1: valid schema, nonexistent env file -> exit 2, specific stderr
✔ TS-ERR-E3: only comments/blanks, schema has >=1 required key -> exit 1, finding at line 0, no ok
✔ TS-ERR-E4: unparsable line -> exit 1, finding with truncated line text
✔ TS-ERR-E5: --json on clean and findings fixtures -> exactly one parseable JSON doc each
✔ TS-REQ-schema-missing: omit --schema entirely -> E_NOFLAG behavior
✔ TS-REQ-envfile-missing: omit positional envfile -> exit 2, tool error
✔ TS-TYPE-int: 01 passes; 1.5, 1e3, empty fail
✔ TS-TYPE-bool: TRUE/1 pass; yes fails
✔ TS-TYPE-url-scheme-gate: ftp:// URL fails the protocol gate
✔ TS-TYPE-url-leniency: http:/x.com (single slash) is not rejected
✔ TS-TYPE-enum: warn not in [debug, info] -> finding
✔ TS-TYPE-empty-value: S= satisfies string, N= fails int
✔ TS-NOGO-01: no ${VAR} interpolation -- literal string is checked
✔ TS-NOGO-02: envlint never writes to the .env file (contents/mtime unchanged)
✔ TS-NOGO-03: no ANSI colors/TUI/prompts across clean, findings and --json runs
✔ TS-NOGO-04: url type check works fully offline, no network fetch

tests 64
pass 64
fail 0
```

## Direct CLI probe (evidence beyond the test harness)
Fixture: `PORT=8080` against schema `{"PORT":{"required":true,"type":"int"}}`.
```
$ node bin/envlint.mjs --schema s.json e.env
ok: 1 keys checked
exit=0
$ node bin/envlint.mjs --schema s.json --json e.env
{"ok":true,"findings":[],"checked":1}
exit=0
$ node bin/envlint.mjs e.env
Error: --schema is required
exit=2
$ node bin/envlint.mjs --schema /nonexistent.json e.env
Error: cannot read schema file: /nonexistent.json
exit=2
```
Matches INV-04 (both branches, exit 0), E_NOFLAG (exit 2, `Error: ` prefix), and
E_SCHEMA_UNREADABLE (exit 2, exact message `cannot read schema file: <path>`) against the
live binary, independent of the test suite's own assertions.

## Criteria table (spec-conformance)

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

## Stability / flip check
No prior `.verdicts-*.jsonl` found under `.shapeup/envlint/evaluation/` — this is the first
recorded verdict for this feature; no flip to report.

## Bugs
None found.

## NEXT ACTION
Ship. No FAIL criteria; no bugs; all 4 build scopes' T0 trial history (round 1, attempt 1) is
`kept`/`baseline` with 1/1 fixtures passed and 0 regressions per the WorkOrder's
`trial_history`.
