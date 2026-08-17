---
type: scope-contract
scope_id: parsing-engine
feature: envlint
topology_type: ICEBERG
tasks: [TASK-001]
allowed_file_substrate: [src/parsing.mjs, test/parsing.test.mjs]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/parsing.test.mjs"]
---

# Scope Contract: `parsing-engine`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| parse-env-text | pure-function | N/A (non-interactive, no CLI surface) | N/A (non-interactive, no CLI surface) | valid `[export] KEY=VALUE` lines (optionally quoted, optional `export` prefix, trimmed whitespace) yield one `EnvPair` per occurrence in file order with correct 1-based `line`; repeated keys are never deduped here (Rules' job, INV-02) | a non-blank/non-comment line that is not `[export] KEY=VALUE` yields one `ParseProblem` with the correct 1-based `line` and the raw, untrimmed `text` | comments and blank lines produce neither a pair nor a problem; an entirely empty file or a comments/blanks-only file returns `{ pairs: [], problems: [] }` (the E3 precondition Rules consumes downstream) |

## Why this slice

Per [[usecases/_index]] ("scope-architect maps Parsing/Rules/CLI to their own scope contracts
against this single UC's `use_case_refs`"), `parsing-engine` is the single pure-function segment
of UC-01's one flow that turns raw `.env` text into `{pairs, problems}` — TASK-001's own
Implementation Notes require it stay free of any import from `src/rules.mjs` or
`bin/envlint.mjs`, so this scope owns exactly one file plus its unit test, nothing shared.
`ICEBERG`: no UI/backend pair to balance — all the risk here is concentrated in one place, the
quote-stripping / `export`-prefix / whitespace-trim edge cases (domain-model.md's `EnvPair`
invariants) and the line-numbering that every downstream `Finding` traces back to. Builds in
parallel with `rules-engine` (TASK-001 and TASK-002 share no file and no import, per
scope-summary.md's Wave 1).
