---
type: usecase
feature: envlint
id: UC-ParseEnv
bounded_context: envlint
actor: System
entities: [EnvFile]
repositories: []
domain_events_emitted: []
tags: [parsing, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: ParseEnv

## Summary
The system turns `.env` text into ordered key/value pairs plus a list of the lines it could not
parse, each with its 1-based line number.

## Preconditions
- The caller holds the env file's text as a string (no file access happens here).

## Input

```typescript
type ParseEnvInput = string; // the full .env text
```

## Steps

```
1. Split the text into lines on \r?\n (PD-1); number them from 1
2. Skip a line that is blank or whose first non-blank character is `#`
3. Strip an optional leading `export ` prefix
4. Split at the first `=`; no `=` → ParseProblem(line) (PD-3)
5. Trim the key; a key not matching [A-Za-z_][A-Za-z0-9_]* → ParseProblem(line) (PD-2)
6. Trim the value; a matching '…' or "…" wrapper is stripped; an unclosed quote → ParseProblem(line) (PD-4)
7. Keep `#` after `=` as part of the value (PD-5)
8. Append { key, value, line } to pairs, in file order, duplicates kept (PD-6)
9. Return { pairs, problems }
```

## Output

```typescript
interface ParseEnvOutput {
  pairs: { key: string; value: string; line: number }[];
  problems: { line: number; message: string }[];
}
```

## System Flow

```
[CLI: bin/envlint.mjs reads env text]
  → [src/parse.mjs: parse(text)]
    ← { pairs, problems }
```

## Invariants
- [INV-01] `parse` is pure: the module imports neither `node:fs` nor the rules module, and the same text always yields the same output.
- [INV-02] `parse` never throws on any string input; anything it cannot read becomes a problem with a 1-based line.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `PARSE_NO_EQUALS` | non-blank, non-comment line with no `=` | n/a | ParseProblem with that line number |
| `PARSE_BAD_KEY` | key empty or not `[A-Za-z_][A-Za-z0-9_]*` | n/a | ParseProblem with that line number |
| `PARSE_UNCLOSED_QUOTE` | value opens `'` or `"` and does not close with the same quote | n/a | ParseProblem with that line number |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | import `src/parse.mjs`; check its imports and call `parse` twice on the same text | suite green: no `node:fs` / rules import; identical outputs | D1: INV-01 |
| TS-INV-02 | test | call `parse` on malformed and odd strings (`"=x"`, `"\u0000"`, `"A"`, `""`) | suite green: no throw; each bad line yields a problem with its 1-based line | D1: INV-02 |
| TS-ERR-PARSE_NO_EQUALS | test | `parse("A=1\nGARBAGE\n")` | suite green: problems = [{line: 2}] , pairs = [A] | D2 |
| TS-ERR-PARSE_BAD_KEY | test | `parse("1BAD=x")` | suite green: one problem at line 1, no pairs | D2 |
| TS-ERR-PARSE_UNCLOSED_QUOTE | test | `parse("A=\"open")` | suite green: one problem at line 1 | D2 |
| TS-REQ-text-forms | test | text with `KEY=value`, `# comment`, blank line, `export K=v`, `'single'`, `"double"`, CRLF | suite green: pairs with stripped quotes and correct 1-based lines, no problems | D3 |
| TS-NOGO-01 | test | `parse("A=${B}")` | suite green: value is the literal `${B}` (no interpolation) | D4: no `${VAR}` interpolation |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — pairs and problems flow to the CLI
- → [[usecases/UC-CheckRules]] — pairs (shape in [[domain-model#Value Objects]]) are its input
