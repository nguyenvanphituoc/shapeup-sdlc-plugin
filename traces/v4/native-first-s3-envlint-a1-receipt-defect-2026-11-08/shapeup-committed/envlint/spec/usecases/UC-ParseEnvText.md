---
type: usecase
feature: envlint
id: UC-ParseEnvText
bounded_context: envlint
actor: System
entities: [EnvPair, ParseProblem]
repositories: []
domain_events_emitted: []
tags: [parsing, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: ParseEnvText

## Summary
The CLI hands `parse(text)` the raw `.env` text, which returns its key/value pairs and the 1-based line of every line it could not parse.

## Preconditions
- `text` is a string (possibly empty).

## Input

```typescript
interface ParseEnvTextInput {
  text: string;
}
```

## Steps

```
1. Split text into lines; number them from 1
2. Skip blank lines and lines whose first non-space character is `#`
3. Strip a leading `export ` prefix
4. Split on the first `=`; the key must be non-empty and contain no whitespace
5. Value: a value wrapped in matching single or double quotes has the quotes removed;
   an opening quote with no closing quote is a problem; `${VAR}` text is kept literally
6. Any line that fails steps 3–5 becomes {line, message} in problems
7. Return {pairs, problems}
```

## Output

```typescript
interface ParseEnvTextOutput {
  pairs: Array<{ key: string; value: string; line: number }>;
  problems: Array<{ line: number; message: string }>;
}
```

## System Flow

```
[CLI: bin/envlint.mjs reads env file]
  → [Use Case: parse(text) — src/parse.mjs]
    ← [{pairs, problems}]
```

## Invariants
- [INV-01] `parse` never throws for any string input; an unreadable line becomes a problem.
- [INV-02] `src/parse.mjs` imports nothing from `src/rules.mjs` or `bin/`.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `PARSE_ERROR` | a non-blank, non-comment line has no `=`, an empty key, or an unterminated quote | — | `{line, message}` appended to problems, parsing continues |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | call `parse` with malformed text (`"=\n'unterminated\nno equals"`) | suite green: no throw, three problems with lines 1, 2, 3 | D1: INV-01 |
| TS-INV-02 | test | load `src/parse.mjs` imports | suite green: no import of `rules` or `bin/` | D1: INV-02 |
| TS-ERR-PARSE_ERROR | test | parse `"A=1\nbad line\nB=2"` | suite green: pairs A (line 1), B (line 3); one problem at line 2 | D2 |
| TS-REQ-text-empty | test | `parse("")` | suite green: `{pairs: [], problems: []}` | D3 |
| TS-NOGO-01 | test | parse `A=${HOME}` | suite green: value is the literal `${HOME}` (no interpolation) | D4: no `${VAR}` interpolation |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — pairs and problems flow to the CLI
- ← [[contracts/env-pairs.contract]] — the shape returned
