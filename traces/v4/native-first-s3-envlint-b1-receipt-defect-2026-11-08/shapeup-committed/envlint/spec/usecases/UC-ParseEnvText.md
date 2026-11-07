---
type: usecase
feature: envlint
id: UC-ParseEnvText
bounded_context: EnvValidation
actor: System
entities: [EnvFile]
repositories: []
domain_events_emitted: []
tags: [parse, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: ParseEnvText

## Summary
The CLI hands `.env` text to `parse(text)` in `src/parse.mjs`, which returns the key/value pairs and the line-numbered problems, with no I/O.

## Preconditions
- `text` is a JS string (possibly empty). `src/parse.mjs` imports nothing from `src/rules.mjs`.

## Input

```typescript
type ParseInput = string   // the whole .env file contents
```

## Steps

```
1. Split text into lines on "\n"; strip one trailing "\r" from each; number lines from 1.
2. Trim the line. Empty → skip. Starts with "#" → skip (comment).
3. If the line starts with "export" followed by whitespace, drop that prefix.
4. No "=" in what remains → problem "expected KEY=value".
5. key = text before the first "=", trimmed. Not ^[A-Za-z_][A-Za-z0-9_]*$ → problem "invalid key".
6. raw = text after the first "=", leading whitespace removed.
   a. raw starts with ' → value is the text up to the next ' (taken literally, no escapes).
      No closing ' → problem "unterminated single quote".
   b. raw starts with " → value is the text up to the next unescaped ";
      escapes \n → newline, \" → ", \\ → \ ; any other backslash is kept literally.
      No closing " → problem "unterminated double quote".
   c. After a closing quote only whitespace, optionally followed by "#…", may remain;
      anything else → problem "unexpected text after closing quote".
   d. Unquoted → value is raw cut at the first whitespace-followed-by-"#", then trailing whitespace trimmed.
7. Push { key, value, line } to pairs (duplicates kept, source order).
8. Return { pairs, problems }.
```

## Output

```typescript
interface ParseOutput {
  pairs: { key: string; value: string; line: number }[]
  problems: { line: number; message: string }[]
}
```

## System Flow

```
[CLI: bin/envlint.mjs reads <envfile>]
  → [Module: src/parse.mjs parse(text)]
    ← [{ pairs, problems }]   (no I/O, no event)
```

## Invariants

- [INV-01] `parse` is pure: same text in, deep-equal result out; it performs no I/O and throws on no string input.
- [INV-02] Values are literal: `${VAR}` and `$VAR` are returned unchanged, never expanded.
- [INV-03] Every pair and every problem carries the 1-based line number of the line it came from.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `NO_EQUALS` | non-blank, non-comment line with no `=` | — | problem `{line, "expected KEY=value"}` |
| `INVALID_KEY` | key fails `^[A-Za-z_][A-Za-z0-9_]*$` | — | problem `{line, "invalid key"}` |
| `UNTERMINATED_SINGLE` | `'` opened, never closed on the line | — | problem `{line, "unterminated single quote"}` |
| `UNTERMINATED_DOUBLE` | `"` opened, never closed on the line | — | problem `{line, "unterminated double quote"}` |
| `TRAILING_AFTER_QUOTE` | non-comment text after the closing quote | — | problem `{line, "unexpected text after closing quote"}` |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | call `parse` twice on the same text | deep-equal results; suite green | D1: INV-01 |
| TS-INV-02 | test | `parse("A=${B}\nC=$D")` | values `${B}` and `$D` unchanged | D1: INV-02 |
| TS-INV-03 | test | text with blank lines, comments and a bad line at line 4 | pair/problem `line` values match their 1-based source lines | D1: INV-03 |
| TS-ERR-NO_EQUALS | test | `parse("JUSTAKEY")` | problems = [{line:1, message:"expected KEY=value"}], pairs = [] | D2 |
| TS-ERR-INVALID_KEY | test | `parse("1BAD=x")` | problem at line 1 "invalid key" | D2 |
| TS-ERR-UNTERMINATED_SINGLE | test | `parse("A='abc")` | problem at line 1 "unterminated single quote" | D2 |
| TS-ERR-UNTERMINATED_DOUBLE | test | `parse('A="abc')` | problem at line 1 "unterminated double quote" | D2 |
| TS-ERR-TRAILING_AFTER_QUOTE | test | `parse("A='x' y")` | problem at line 1 "unexpected text after closing quote" | D2 |
| TS-REQ-forms | test | `KEY=value`, `export KEY=value`, `A='x # y'`, `B="a\nb"`, `C=v # c`, `# c`, blank | pairs `KEY=value`, `KEY=value`, `A=x # y`, `B=a⏎b`, `C=v`; comments/blanks yield nothing | D3 |
| TS-REQ-empty | test | `parse("")` and comment-only text | `{pairs: [], problems: []}` | D3 |
| TS-NOGO-01 | test | grep `src/parse.mjs` imports | no import of `./rules.mjs`, no `node:fs`/`node:net`/`node:http` import | D4 |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — the CLI is the only caller
- ← [[domain-model#Value Objects]] — `Pair` / `ParseProblem` shapes
