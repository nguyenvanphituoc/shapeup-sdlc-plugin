---
type: scope-contract
scope_id: rules-engine
feature: envlint
topology_type: ICEBERG
tasks: [TASK-002]
allowed_file_substrate: [src/rules.mjs, test/rules.test.mjs]
shared_substrate: []
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures: ["node --test test/rules.test.mjs"]
---

# Scope Contract: `rules-engine`

## Affordances

| test_id | role | idle | loading | success | error | empty |
|---|---|---|---|---|---|---|
| evaluate-pairs-against-schema | pure-function | N/A (non-interactive, no CLI surface) | N/A (non-interactive, no CLI surface) | a key present in the file but absent from the schema never produces a finding (INV-01); for a repeated key only the last occurrence in file order is evaluated, earlier occurrences never finding of their own (INV-02); a `required`+present-and-valid key, or zero `required` keys with zero pairs, yields zero findings for that key (INV-06 "ok" branch) | `required:true` + key absent after dedup → `Finding{line:0}`; `type:"int"` fails non-`/^-?\d+$/` values (`1.5`, `1e3`, `""`); `type:"bool"` fails anything but case-insensitive `true`/`false`/`1`/`0`; `type:"url"` fails a value that merely parses via `new URL()` but has a protocol other than `http:`/`https:` (the protocol-gate footgun — never a naive `try{new URL(v)}catch{}`-only check, per `spike-url-type-validation.md`); `enum` fails a value not exactly matching a listed entry; each `ParseProblem` becomes one `Finding` (`key`=truncated-to-30-chars raw text, `message`="not a KEY=VALUE assignment", E4) | a present-but-empty value (`KEY=`) satisfies `type:"string"` but fails `int`/`bool`/`url`/`enum` |

## Why this slice

Per [[usecases/_index]], `rules-engine` is the single pure-function segment of UC-01's one flow
that turns `{pairs, problems}` + a schema into `Finding[]` — TASK-002's own Implementation Notes
require it stay free of any import from `src/parsing.mjs`, so this scope owns exactly one file
plus its unit test, nothing shared. `ICEBERG`: no UI/backend pair to balance — the risk here
concentrates in the `url` type's protocol-gate spike finding (over/under-rejection relative to
`new URL()`'s WHATWG leniency, per the pitch's Rabbit Holes table) and the INV-02 last-wins
dedup semantics across repeated keys. Builds in parallel with `parsing-engine` (TASK-001 and
TASK-002 share no file and no import, per scope-summary.md's Wave 1) — highest risk of the two
engine scopes given the confirmed spike footgun.
