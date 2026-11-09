---
type: usecase
feature: envlint
id: UC-ParseEnvText
bounded_context: EnvValidation
actor: System
entities: [EnvPair, ParseProblem, ParseResult]
repositories: []
domain_events_emitted: []
tags: [pure, parser]
depends_on: ["[[domain-model]]"]
status: draft
---

# Use Case: ParseEnvText

## Summary
The parser turns `.env` text into key/value pairs plus a list of the lines it could not parse, with 1-based line numbers.

## Preconditions
- None: any string is valid input, including the empty string.

## Input

```typescript
interface ParseEnvTextInput {
  text: string // whole file contents; LF or CRLF line endings
}
```

## Steps

```
1. Split text into lines (LF or CRLF); number them from 1
2. Skip blank / whitespace-only lines
3. Skip lines whose first non-space character is '#'
4. Strip a leading 'export ' prefix
5. Match KEY=VALUE where KEY is [A-Za-z_][A-Za-z0-9_]*; anything else → ParseProblem(line)
6. VALUE: trim; if wrapped in matching single or double quotes, remove them; an opening quote with no matching
   closing quote → ParseProblem(line)
7. Emit EnvPair {key, value, line}
8. Return {pairs, problems}
```

## Output

```typescript
interface ParseEnvTextOutput {
  pairs: { key: string; value: string; line: number }[]
  problems: { line: number; message: string }[]
}
```

## System Flow

```
[Use Case: parse(text)]  — src/parse.mjs, pure, no I/O, imports nothing from src/rules.mjs
```

## Invariants
- [INV-01] Parsing never throws: any string input returns a `{pairs, problems}` object.
- [INV-02] The parser module does not import the rules module and performs no I/O.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `PARSE_INVALID_LINE` | a non-blank, non-comment line that is not `KEY=VALUE` | n/a | ParseProblem with that line's 1-based number |
| `PARSE_UNTERMINATED_QUOTE` | a value opens with `'` or `"` and does not close with the same quote | n/a | ParseProblem with that line's 1-based number |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | call `parse` with `""`, `"\n\n"`, `"="`, a binary-ish string | returns `{pairs, problems}`, no throw | D1: INV-01 |
| TS-INV-02 | test | static import graph of `src/parse.mjs` | no import of `src/rules.mjs`, no `node:fs` | D1: INV-02 |
| TS-ERR-PARSE_INVALID_LINE | test | `parse("A=1\nnot a line\n")` | one problem with `line: 2`; pair `A` with `line: 1` | D2 |
| TS-ERR-PARSE_UNTERMINATED_QUOTE | test | `parse('A="abc\n')` | one problem with `line: 1`, no pair `A` | D2 |
| TS-REQ-text-forms | test | `KEY=value`, `# c`, blank, `export K=v`, `K='a b'`, `K="a b"` | pairs `KEY=value`, `K=v`, `K=a b` (quotes removed); comment and blank yield nothing | D3 |
| TS-REQ-text-empty | test | `parse("")` and comment-only text | `{pairs: [], problems: []}` | D3 |
| TS-NOGO-01 | test | `parse("A=${B}")` | value is the literal `${B}` (no interpolation) | D4: never interpolates `${VAR}` |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — the CLI passes `pairs` to the rules checker and prints `problems`
