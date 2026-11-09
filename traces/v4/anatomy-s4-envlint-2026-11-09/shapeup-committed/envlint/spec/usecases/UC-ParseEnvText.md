---
type: usecase
feature: envlint
id: UC-ParseEnvText
bounded_context: EnvValidation
actor: System
entities: [EnvPair, ParseProblem]
repositories: []
domain_events_emitted: []
tags: [pure, parsing]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: ParseEnvText

## Summary
The CLI hands `.env` text to `parseEnv`, which returns the key/value pairs and a problem for every line it cannot parse.

## Preconditions
- None: the input is any string (possibly empty). Module `src/parse.mjs` imports nothing.

## Input

```typescript
type ParseEnvTextInput = string   // the whole file content, LF or CRLF line endings
```

## Steps

```
1. Split the text into lines on /\r?\n/; number them from 1.
2. Per line, trim surrounding whitespace.
   a. empty → skip (blank line).
   b. starts with "#" → skip (comment).
3. Strip a leading "export" followed by whitespace, if present.
4. Split at the first "=": the left side, trimmed, is the key; it must match /^[A-Za-z_][A-Za-z0-9_]*$/.
   No "=" or an invalid key → ParseProblem{line, message}.
5. The right side, with leading whitespace removed, is the raw value:
   a. starts with ' or " → the value is everything up to the matching closing quote (no escape processing);
      after it only whitespace or a "#" comment may follow, else ParseProblem; no closing quote → ParseProblem "unterminated quote".
   b. otherwise → cut at the first whitespace-then-"#", trim; the rest is the value (may be "").
6. Emit EnvPair{key, value, line}. Duplicate keys are all emitted in file order (SD-1).
7. Return {pairs, problems}, both in line order.
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
[CLI: bin/envlint.mjs reads <envfile>]
  → [parseEnv(text) in src/parse.mjs]
    ← {pairs, problems}
```

## Invariants
- [INV-01] `parseEnv` never throws, for any string input: malformed text becomes a problem, never an exception.
- [INV-02] `parseEnv` is pure: same input → deeply equal output; it performs no I/O and imports no module.
- [INV-03] `${VAR}` in a value is returned verbatim, never interpolated.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `PARSE_NO_EQUALS` | non-blank, non-comment line with no `=` | n/a | ParseProblem with the 1-based line |
| `PARSE_BAD_KEY` | key does not match `/^[A-Za-z_][A-Za-z0-9_]*$/` (incl. empty) | n/a | ParseProblem with the line |
| `PARSE_UNTERMINATED_QUOTE` | value opens a quote that never closes on that line | n/a | ParseProblem with the line |
| `PARSE_TRAILING_TEXT` | non-comment text after a closing quote | n/a | ParseProblem with the line |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | call `parseEnv` on `"=\n'\n\"abc\nexport\n\u0000"` and on `""` | returns `{pairs, problems}`, no throw; `""` → both arrays empty | D1: INV-01 |
| TS-INV-02 | test | call `parseEnv` twice on the same text; inspect the module's import statements | outputs deeply equal; `src/parse.mjs` has no `import` | D1: INV-02 |
| TS-INV-03 | test | parse `A=${HOME}/x` | pair value is exactly `${HOME}/x` | D1: INV-03 + D4: NOGO-02 |
| TS-ERR-PARSE_NO_EQUALS | test | parse `A=1\nNOEQUALS\n` | one problem, `line: 2`; pair A kept | D2 |
| TS-ERR-PARSE_BAD_KEY | test | parse `1A=x` and `=x` | one problem each, `line: 1` | D2 |
| TS-ERR-PARSE_UNTERMINATED_QUOTE | test | parse `\n\nA="abc` | one problem, `line: 3` | D2 |
| TS-ERR-PARSE_TRAILING_TEXT | test | parse `A="x" y` | one problem, `line: 1` | D2 |
| TS-REQ-forms | test | parse `A=1`, `# c`, blank, `export B=2`, `C='q # r'`, `D="s"`, `E=t # u`, `F=` | pairs A=1/l1, B=2, C=`q # r`, D=`s`, E=`t`, F=`` with correct lines; no problems | D3: Input + Steps |
| TS-REQ-dup | test | parse `A=1\nA=2` | two pairs, lines 1 and 2, in order | D3 (SD-1) |
| TS-REQ-crlf | test | parse `A=1\r\nB=2\r\n` | values `1` and `2` (no `\r`), lines 1, 2 | D3: Input |

## Integration Points
- ← [[usecases/UC-LintEnvFile]] — the CLI calls `parseEnv` with the env file's text
- → [[usecases/UC-CheckRules]] — its `pairs` are that use case's input (shape SD-1)
