---
type: usecase
feature: envlint
id: UC-ParseEnvText
bounded_context: env-validation
actor: System
entities: [EnvFile]
repositories: []
domain_events_emitted: []
tags: [parsing]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: ParseEnvText

## Summary
The CLI hands `.env` text to `parse`, which returns its key/value pairs and the 1-based lines it could not
parse.

## Preconditions
- None: any string is valid input, including the empty string.

## Input

```typescript
interface ParseEnvTextInput { text: string }
```

## Steps

```
1. Split text into lines (\n or \r\n); number them from 1.
2. Skip a line that is blank or whose first non-space character is '#'.
3. Strip a leading 'export ' prefix.
4. Split at the first '='; no '=' → problem "expected KEY=value".
5. Trim the key; a key not matching [A-Za-z_][A-Za-z0-9_]* → problem "invalid key".
6. Value: wrapped in matching '…' or "…" → the text between the quotes verbatim; an opening quote with
   no matching closing quote → problem "unterminated quote"; otherwise the trimmed text, literally.
7. Record { key, value, line }; a later assignment of the same key replaces the earlier one.
8. Return { pairs, problems }.
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
[CLI: bin/envlint.mjs reads the env file]
  → [Use Case: parse(text) in src/parse.mjs]
    ← [{ pairs, problems }]
```

## Invariants
- [INV-01] `parse` never throws, for any string input.
- [INV-02] `src/parse.mjs` imports no other module (pure: text in, `{pairs, problems}` out; shares nothing with Rules).
- [INV-03] `parse` never interpolates `${VAR}`: a value containing `${OTHER}` is returned literally.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `NO_EQUALS` | a non-blank, non-comment line has no `=` | n/a | problem `{line, "expected KEY=value"}` |
| `INVALID_KEY` | the key does not match `[A-Za-z_][A-Za-z0-9_]*` | n/a | problem `{line, "invalid key"}` |
| `UNTERMINATED_QUOTE` | a value opens a quote it never closes | n/a | problem `{line, "unterminated quote"}` |

## Test Surface
<!-- DERIVED — D1–D4 only. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | call `parse` with `""`, `"="`, `"\0\n'"`, a 10k-line random string | suite green: returns `{pairs, problems}`, never throws | D1: INV-01 |
| TS-INV-02 | test | read `src/parse.mjs` imports from the test suite | suite green: no `import` statement in the module | D1: INV-02 |
| TS-INV-03 | test | `parse("A=${B}")` | suite green: value is the literal `${B}` | D1: INV-03 + D4: NOGO-02 |
| TS-ERR-NO_EQUALS | test | `parse("A=1\nJUNK\n")` | problem at line 2 | D2 |
| TS-ERR-INVALID_KEY | test | `parse("1BAD=x")` | problem at line 1 | D2 |
| TS-ERR-UNTERMINATED_QUOTE | test | `parse("A=\"open")` | problem at line 1 | D2 |
| TS-REQ-text-empty | test | `parse("")` and `parse("# only\n\n")` | `{pairs: [], problems: []}` | D3 |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — `{ pairs, problems }` flow to the CLI.
