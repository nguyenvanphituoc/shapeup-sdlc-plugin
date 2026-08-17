---
type: scope-contract
scope_id: env-parsing
feature: envlint
topology_type: ICEBERG
tasks: [TASK-001]
allowed_file_substrate: [lib/parse.mjs, test/parse.test.mjs]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/parse.test.mjs"]
---

# Scope Contract: `env-parsing`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| parse-comment-blank | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | `#` comment lines and blank lines produce no `pairs` entry and no `problems` entry | n/a — never throws | n/a |
| parse-export-prefix | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | `export KEY=value` parses identically to `KEY=value` | n/a | n/a |
| parse-quote-stripping | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | `KEY="value"` / `KEY='value'` strip matching-pair quotes only; whitespace around `KEY` and value trimmed | `KEY="value` (unterminated) keeps the leading quote rather than stripping or throwing | `KEY=""` → `pairs.get("KEY").value === ""` |
| parse-duplicate-key | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | duplicate key: last assignment wins in `pairs`; earlier assignment produces no `problems` entry | n/a | n/a |
| parse-malformed-line | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | n/a — this row is the error path | a line that is not blank/comment/`KEY=VALUE` is added to `problems` with correct 1-based `line` and `rawText`; never throws | n/a |
| parse-empty-input | engine-function | N/A (pure function, non-interactive) | N/A (pure function, non-interactive) | n/a | n/a | empty string, or comments/blanks-only input → `{ pairs: new Map(), problems: [] }` |

## Why this slice

`ICEBERG` — the parsing rules (quote-stripping, duplicate-key last-wins, malformed-line
detection with 1-based line numbers, never-throw) carry all the real complexity of this scope;
its own test file is thin by comparison. `lib/parse.mjs` is exclusive to this scope per
`domain-model.md`'s Engines table and `scope-summary.md`'s substrate-disjointness constraint —
it imports nothing from `lib/rules.mjs` and no other scope's `allowed_file_substrate` may touch
it. This is one of the two scopes `scope-summary.md` calls out as independently buildable in
parallel with `schema-rules` (no `depends_on` between TASK-001 and TASK-002).
