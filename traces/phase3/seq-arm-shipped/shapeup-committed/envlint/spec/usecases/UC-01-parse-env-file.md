---
schema_version: 1
doc_type: usecase
feature: envlint
id: UC-01
engine: parsing
actor: CLI (internal caller)
---

# UC-01 — Parse env file

**Actor**: the CLI (`bin/envlint.mjs`), calling `lib/parse.mjs` directly — no external actor
reaches this engine independently; it is verified alone against its own fixtures (pitch).

## Input
`text: string` — raw content of the env file already read from disk.

## Output
`{ pairs: Map<string, EnvPair>, problems: ParseProblem[] }` — see
[[contracts/parse-contract|parse-contract]].

## Steps
1. Split `text` into lines, tracking 1-based line numbers.
2. For each line: if blank or starts with `#` (after leading whitespace), skip.
3. Else match against `/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/`.
   - No match → append `{ line, rawText: line }` to `problems`.
   - Match → extract `key`, raw `value`.
4. Strip matching-pair quotes from `value` (`"..."` or `'...'`, both delimiters present) only
   when both the opening and closing quote characters exist; otherwise leave `value` as-is
   (including a lone leading quote).
5. Trim whitespace around `key` and the (post-quote-stripping) `value`.
6. Insert/overwrite `pairs.set(key, { key, value, line })` — last assignment for a given `key`
   wins; no problem/finding is recorded for the earlier assignment.
7. Return `{ pairs, problems }`.

## Error cases
| Code | Condition | Result |
|---|---|---|
| E4 | line is not blank/comment/`KEY=VALUE` | added to `problems`, not thrown |
| E3 | `text` has zero assignments | `{ pairs: empty, problems: [] }` (not an error — see UC-03 for the "still report required-missing" behavior) |

This engine never throws; every malformed line is data, not an exception (pitch: a linter that
crashes is worse than no linter).

## System Flow
`bin/envlint.mjs` (UI/entry) → reads env file text → `lib/parse.mjs::parseEnv` (UC) → returns
`{pairs, problems}` to the CLI → CLI passes to `lib/rules.mjs` (UC-02). No DB, no network
(no-go).

## Test Surface
Derived only from D1 (Invariants below) · D2 (Error Cases above) · D3 (contract shape) · D4
(no-gos) — no row without one of those sources.

| ID | Source | Assertion |
|---|---|---|
| TS-UC01-01 | D1 | `# comment` and blank lines produce no `pairs` entry and no `problems` entry |
| TS-UC01-02 | D1 | `export KEY=value` parses identically to `KEY=value` |
| TS-UC01-03 | D1 | `KEY="value"` → `value` (matching double quotes stripped) |
| TS-UC01-04 | D1 | `KEY='value'` → `value` (matching single quotes stripped) |
| TS-UC01-05 | D1 | `KEY="value` (unterminated) → value stays `"value` (leading quote kept) |
| TS-UC01-06 | D1 | `"  SPACED  =  hi  "` → key `SPACED`, value `hi` (whitespace trimmed) |
| TS-UC01-07 | D1 | duplicate key: later assignment wins; earlier one produces no `problems` entry |
| TS-UC01-08 | D2 (E4) | a line matching none of blank/comment/`KEY=VALUE` → `problems` entry with correct 1-based `line` and `rawText` |
| TS-UC01-09 | D2 (E3) | zero-assignment input (empty, or only comments/blanks) → `{ pairs: empty, problems: [] }`, no throw |
| TS-UC01-10 | D3 | this function never throws for any string input (contract: "This function never throws") |
