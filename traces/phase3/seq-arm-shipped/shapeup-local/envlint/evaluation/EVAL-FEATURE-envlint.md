---
schema_version: 1
doc_type: eval-report
feature: envlint
round: 1
verdict: PASS
---

# EVAL — envlint (round 1, feature-level, spec-conformance)

## Verdict: PASS

## T0 citations (scoped specs)

| scope_id | path | sha256 (recomputed) |
|---|---|---|
| env-parsing | .shapeup/envlint/t0/verdicts/r1-a1-t1.json | e27db73df2c746e01087ff9aaeb78aec24d666680ed4b359be39b40a363cfcdf |
| schema-rules | .shapeup/envlint/t0/verdicts/r1-a1-t2.json | 858fd4b19612bdce3d0e3831cd8819e2ad18828d1863718feecbf825d8686dc0 |
| cli-pipeline | .shapeup/envlint/t0/verdicts/r1-a1-t3.json | c31b80f7eab787a0fbb1d3a8565b62c38b801bbd6e5dea8ae32676a38e86b795 |

All three T0 artifacts are `overall: "green"`, `regression: false`.

## Criteria table

| Criterion | Dimension | Verdict | Confidence | Evidence |
|---|---|---|---|---|
| UC-01 TS-UC01-01..10 (parseEnv: comments/blank, export, quote-stripping, unterminated quote, trim, dup-key, E4, E3, never-throws) | spec-conformance | PASS | high | `node --test test/parse.test.mjs` all 10 rows pass; re-read `lib/parse.mjs` line-by-line against UC-01 Steps 1-7, matches |
| UC-02 TS-UC02-01..11 (int/bool/url/string/enum checks, empty value, schema-format, E3, checked count, dup-key-resolved-upstream, no-network url check) | spec-conformance | PASS | high | `node --test test/rules.test.mjs` all 11 rows pass; `lib/rules.mjs` matches rules-contract.md rule-evaluation order |
| UC-03 TS-UC03-01..12 (E1 env/schema unreadable, E2 bad JSON, missing-flag, E3 zero-assignment, E4 render+truncation, E5 --json, ok/findings human render, line:0 render, no-network, CLI composes UC-01+UC-02 only) | spec-conformance | PASS | high | `node --test test/cli.test.mjs test/integration.test.mjs` all pass; live probe of `bin/envlint.mjs` reproduced every branch (see below) |
| Contract triplet — parse-contract.md (Request/Response/Error) | spec-conformance | PASS | high | `lib/parse.mjs` returns `{pairs: Map, problems: Array}` exactly, never throws (TS-UC01-10 + live fuzz not needed, fixtures cover) |
| Contract triplet — rules-contract.md (Request/Response/Error, rule-evaluation order 1-4) | spec-conformance | PASS | high | `lib/rules.mjs` — problems→findings first, then required-missing, then type/enum, then extra-key-no-finding, in that order; matches |
| scope-summary.md Done-when statements | spec-conformance | PASS | high | all 3 scope T0 verdicts green (see citations); `node --test` full suite 45/45 pass |
| _index.md Non-Go list (no .env writing, no ${VAR} interpolation, no dotenv loading, no colors/TUI/prompts, no network ever) | spec-conformance | PASS | high | grep for `writeFileSync`/interpolation/`dotenv`/ANSI codes in `lib/*.mjs` `bin/*.mjs`: none found; `test/integration.test.mjs` "no network access occurs during a run" passes; `url` type check is try/catch + protocol allow-list only (TS-UC02-11/TS-UC03-11) |

## Live probe (independent of fixtures)

Ran `bin/envlint.mjs` directly against ad-hoc fixtures (env with required/optional int/bool/enum/url
keys, an extra undeclared key, and a 66-char malformed line):

- Human mode, findings present: `<path>:6: this is not valid at all it is: not a KEY=VALUE assignment` +
  `1 problem(s)`, exit 1 — truncation confirmed exactly 30 chars (`'this is not valid at all it is'.length === 30`).
- `--json` mode: `{"ok":false,"findings":[{"key":"","line":6,"message":"not a KEY=VALUE assignment"}],"checked":4}`, exit 1.
- Missing `--schema` → `Error: --schema <schema.json> is required`, exit 2.
- Missing schema file → `Error: cannot read schema file: <path>`, exit 2.
- Missing env file → `Error: cannot read env file: <path>`, exit 2.
- Invalid JSON schema → `Error: schema is not valid JSON: <path>`, exit 2.
- `grep -n "^import" bin/envlint.mjs` → imports only `node:fs`, `../lib/parse.mjs`, `../lib/rules.mjs`
  (TS-UC03-12: no direct re-implementation).
- `grep -n "import" lib/rules.mjs` → no output (rules.mjs imports nothing from parse.mjs, per UC-02 actor note).

## Stability / flips

No prior `.verdicts-*.jsonl` ledger exists for this slug — first evaluation, nothing to compare
against. No re-probes needed (zero FAILs found).

## Bugs

None found.

## refuted[]

None (nothing to refute — no FAIL evidence contradicting a task's claimed AC).

## Open spec item (not a defect, carried forward)

`_index.md` §Open questions item 1: E4 truncation semantics (byte vs character, no ellipsis
spec) remains genuinely open per `synthesis.md`'s risk register. The implementation's
`truncate()` does a plain character slice with no ellipsis, which satisfies "≤30 chars of the
line text" (TS-UC01's own Test Surface has no row pinning a stricter algorithm), so this is not
graded as a FAIL — it is a pre-existing spec gap, not new evidence of non-conformance.

## NEXT ACTION

Ship. All three scopes T0-green, all UC-01/UC-02/UC-03 Test Surface rows confirmed PASS by
fixture + independent live probe, all Non-Go constraints held.
