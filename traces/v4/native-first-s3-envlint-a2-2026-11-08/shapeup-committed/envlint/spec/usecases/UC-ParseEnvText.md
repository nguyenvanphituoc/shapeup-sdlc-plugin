---
type: usecase
feature: envlint
id: UC-ParseEnvText
bounded_context: env-validation
actor: System
entities: [EnvFile]
repositories: []
domain_events_emitted: []
tags: [parsing, pure]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: ParseEnvText

## Summary
The parsing module turns `.env` text into ordered key/value pairs, plus the 1-based line numbers of the
lines it cannot parse.

## Preconditions
- The caller holds the file's text as a string. The module does no IO.

## Input

```typescript
interface ParseEnvTextInput {
  text: string; // full .env file contents
}
```

## Steps

```
1. Split text into lines on "\n" (strip a trailing "\r"); number lines from 1
2. Skip blank lines and lines whose first non-space char is "#"
3. Drop a leading "export " prefix
4. Split on the first "="; no "=" → problem "missing '='"
5. Trim key; key not ^[A-Za-z_][A-Za-z0-9_]*$ → problem "invalid key"
6. Trim value; strip matching surrounding single/double quotes; an unclosed quote → problem "unterminated quote"
7. Append {key, value, line} to pairs
8. Return {pairs, problems}
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
[CLI: bin/envlint.mjs reads env file text]
  → [Use Case: parseEnv(text) in src/parse.mjs]
    ← [{pairs, problems} returned to CLI]
```

## Invariants
- [INV-01] `parseEnv` returns `{pairs, problems}` and never throws, for any string input.
- [INV-02] `src/parse.mjs` imports nothing from the rules module (parsing and rules share nothing).

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `MISSING_EQUALS` | a non-blank, non-comment line has no `=` | n/a | problem `{line, "missing '='"}`, line skipped |
| `INVALID_KEY` | key does not match `^[A-Za-z_][A-Za-z0-9_]*$` | n/a | problem `{line, "invalid key"}`, line skipped |
| `UNTERMINATED_QUOTE` | value opens a quote that is not closed on the line | n/a | problem `{line, "unterminated quote"}`, line skipped |

## Test Surface
<!-- DERIVED — D1 Invariants · D2 Error Cases · D3 contract shape · D4 no-gos. Oracle: test (library module). -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | test | call `parseEnv` with `""`, `"\n\n"`, `"=\n'\n\"x"` and a binary-ish string | returns `{pairs, problems}` arrays, no throw; `""` → both empty | D1: INV-01 |
| TS-INV-02 | test | grep `src/parse.mjs` imports in a test | no import of `rules` | D1: INV-02 |
| TS-ERR-MISSING_EQUALS | test | `parseEnv("A=1\nBROKEN\n")` | problems `[{line:2,…"missing '='"}]`, pairs has A only | D2 |
| TS-ERR-INVALID_KEY | test | `parseEnv("1BAD=x")` | problems `[{line:1,…"invalid key"}]` | D2 |
| TS-ERR-UNTERMINATED_QUOTE | test | `parseEnv("A=\"open")` | problems `[{line:1,…"unterminated quote"}]` | D2 |
| TS-REQ-forms | test | text with `KEY=v`, `# c`, blank, `export E=1`, `S='a b'`, `D="c d"` | pairs `KEY=v`, `E=1`, `S=a b`, `D=c d` with their 1-based lines; no problems | D3: contract §1 line rules |
| TS-REQ-empty-value | test | `parseEnv("K=")` | pair `{key:"K", value:"", line:1}` | D3: contract §1 |
| TS-NOGO-01 | test | `parseEnv("A=${HOME}")` | value is the literal `${HOME}` (no interpolation) | D4: no `${VAR}` interpolation |

## Integration Points
- → [[usecases/UC-LintEnvFile]] — pairs feed the rules; problems are printed by the CLI
- ← [[contracts/envlint.contract]] — §1 line rules
