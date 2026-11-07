---
type: usecase
feature: envlint
id: UC-ParseEnvText
bounded_context: env-validation
actor: System
entities: [EnvFile, Assignment]
repositories: []
domain_events_emitted: []
tags: [parsing, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: ParseEnvText

## Summary
The system turns `.env` text into ordered key/value pairs and a list of 1-based line problems,
per [[contracts/parse.contract]].

## Preconditions
- The caller holds the file's text as a string (reading the file is the CLI's job, [[usecases/UC-LintEnvFile]]).

## Input

```typescript
interface ParseEnvTextInput {
  text: string; // whole file contents
}
```

## Steps

```
1. Split text into lines (\n or \r\n); number them from 1
2. For each line, trim it; skip empty lines and lines starting with #
3. Strip a leading `export ` prefix
4. Split at the first `=`; validate KEY against [A-Za-z_][A-Za-z0-9_]*
5. Read the value: quoted (single or double) up to the matching quote, else the trimmed remainder
6. Append {key, value, line} to pairs, or {line, message} to problems when any step 4–5 rule fails
7. Return {pairs, problems}
```

## Output

```typescript
interface ParseEnvTextOutput {
  pairs: { key: string; value: string; line: number }[];
  problems: { line: number; message: string }[];
}
```

## System Flow

```
[CLI: bin/envlint.mjs reads envfile text]
  → [Module: parse(text) in src/parse.mjs]
    ← [{pairs, problems} returned to the CLI]
```

## Invariants
- [INV-01] `parse` never throws for any string input — a malformed line becomes a problem, never an exception.
- [INV-02] `src/parse.mjs` imports nothing from `src/rules.mjs`, and is verifiable alone against its own fixtures.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `PARSE_NO_EQUALS` | non-comment, non-blank line with no `=` | — | problem `{line, message}` |
| `PARSE_BAD_KEY` | key does not match `[A-Za-z_][A-Za-z0-9_]*` | — | problem `{line, message}` |
| `PARSE_UNTERMINATED_QUOTE` | quoted value has no matching closing quote | — | problem `{line, message}` |
| `PARSE_TRAILING_TEXT` | text other than whitespace or `#…` after a closing quote | — | problem `{line, message}` |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | Feed `parse` malformed text (`=x`, `"open`, `KEY`, `1A=b`, binary noise) | suite green: returns `{pairs, problems}`, no throw | D1: INV-01 |
| TS-INV-02 | test | Check `src/parse.mjs` import graph and run its test file alone (`node --test test/parse.test.mjs`) | suite green; no import of `rules` | D1: INV-02 |
| TS-ERR-PARSE_NO_EQUALS | test | `parse("JUSTAKEY\n")` | one problem with `line: 1`, no pairs | D2 |
| TS-ERR-PARSE_BAD_KEY | test | `parse("A=1\n1BAD=2\n")` | one pair (A, line 1), one problem with `line: 2` | D2 |
| TS-ERR-PARSE_UNTERMINATED_QUOTE | test | `parse("A=\"open\n")` | one problem with `line: 1` | D2 |
| TS-ERR-PARSE_TRAILING_TEXT | test | `parse("A='x' y\n")` | one problem with `line: 1` | D2 |
| TS-REQ-text-forms | test | `parse` over `KEY=value`, `# c`, blank, `export K=v`, `K='a b'`, `K="a b"` | pairs `[{KEY,value,1},{K,v,4},{K,a b,5},{K,a b,6}]`-shaped, no problems | D3 |
| TS-REQ-text-empty | test | `parse("")` and `parse("# only\n\n")` | `{pairs: [], problems: []}` | D3 |
| TS-NOGO-02 | test | `parse("A=${B}\n")` | value is the literal `${B}` — no interpolation | D4: no interpolation |

## Integration Points
- → [[usecases/UC-EvaluateRules]] — `pairs` is the input of `lint`
- ← [[usecases/UC-LintEnvFile]] — called by the CLI with the env file's text
