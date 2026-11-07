---
type: usecase
feature: envlint
id: UC-LintEnvFile
bounded_context: EnvValidation
actor: Developer
entities: [EnvFile, Schema, Finding]
repositories: []
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]", "[[usecases/UC-ParseEnvText]]", "[[usecases/UC-EvaluateRules]]"]
status: ready
---

# Use Case: LintEnvFile

## Summary
A developer (or CI) runs `node bin/envlint.mjs --schema <schema.json> <envfile>` and gets every problem printed one per line, with an exit code that says clean (0), findings (1) or could-not-run (2).

## Preconditions
- `src/parse.mjs` and `src/rules.mjs` exist with the interfaces in [[domain-model#Module Interfaces]].

## Input

```typescript
argv: ["--schema", schemaPath, envPath]   // "--schema <p>" may come before or after <envfile>
```

## Steps

```
1. Parse argv: exactly one "--schema <path>" and exactly one positional <envfile>. Anything else → USAGE (exit 2).
2. Read <envfile> as UTF-8. Failure (missing, directory, unreadable) → READ_FAILED naming <envfile> (exit 2).
3. Read <schema.json> as UTF-8. Failure → READ_FAILED naming the schema path (exit 2).
4. JSON.parse the schema. Failure → SCHEMA_INVALID "<path>: not valid JSON" (exit 2).
5. validateSchema(schema). Non-empty → one SCHEMA_INVALID stderr line per message (exit 2).
6. { pairs, problems } = parse(envText); findings = evaluate(pairs, schema).
7. Print per [[ux-behavior#Screen: TerminalOutput]] RULE-01/02 on stdout.
8. Exit 1 if any problem or finding was printed, else exit 0 with no output.
```

## Output

```typescript
{ stdout: string; stderr: string; exitCode: 0 | 1 | 2 }
```

## System Flow

```
[Shell: node bin/envlint.mjs --schema s.json .env]
  → [CLI: argv handling, node:fs readFileSync of both paths (read-only)]
    → [src/parse.mjs parse(text)]
    → [src/rules.mjs validateSchema(schema), evaluate(pairs, schema)]
  ← [stdout lines · stderr lines · process.exitCode]
```

## Invariants

- [INV-01] No input reaches the user as a stack trace or an uncaught exception; every run ends in exit 0, 1 or 2.
- [INV-02] The CLI never writes to the filesystem and never reads a file it was not given (no implicit `.env` lookup).
- [INV-03] Output contains no ANSI escape sequences and never waits on stdin.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `USAGE` | `--schema` missing, no envfile, extra/unknown argument | — | stderr usage line, exit 2 |
| `READ_FAILED` | envfile or schema missing/unreadable | — | stderr `envlint: cannot read <path>`, exit 2 |
| `SCHEMA_INVALID` | schema not JSON, or wrong shape | — | stderr `envlint: invalid schema <path>: <reason>`, exit 2 |
| `FINDINGS` | ≥1 parse problem or finding | — | stdout lines, exit 1 |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | run with a binary/garbage envfile, a schema of `[]`, a schema of `"x"`, and an envfile that is a directory | exit ∈ {1,2}; stderr has no `at ` stack frame and no `Error:` trace | D1: INV-01 |
| TS-INV-02 | process | run in a temp dir that contains its own `.env`, passing other fixture paths | the temp dir's files are byte-identical before/after; its `.env` content never appears in output | D1: INV-02 |
| TS-INV-03 | process | run any findings case with stdin closed | stdout/stderr contain no `\x1b[`; process exits without input | D1: INV-03 |
| TS-ERR-USAGE | process | no args; `--schema s.json` only; envfile only; an extra positional; `--color` | exit 2, stderr `envlint: usage: envlint --schema <schema.json> <envfile>` | D2 |
| TS-ERR-READ_FAILED | process | envfile path that does not exist; schema path that does not exist | exit 2, stderr `envlint: cannot read <that path>` | D2 |
| TS-ERR-SCHEMA_INVALID | process | schema file with `{not json`; schema `{"A":{"type":"float"}}` | exit 2, stderr starts `envlint: invalid schema <path>: ` | D2 |
| TS-ERR-FINDINGS | process | envfile `PORT=abc\nBAD LINE` with schema `{"PORT":{"type":"int"},"HOST":{"required":true}}` | exit 1; stdout exactly `<f>:1: PORT: expected int, got "abc"`, `<f>:2: parse error: expected KEY=value`, `<f>: HOST: required key is missing` in that order | D2 |
| TS-REQ-clean | process | valid envfile satisfying its schema | exit 0, empty stdout and stderr | D3 |
| TS-REQ-no-assignments | process | empty envfile and comment-only envfile, against a schema with no required keys and one with a required key | exit 0 with no output; exit 1 with one missing-required line respectively | D3 |
| TS-NOGO-01 | process | envfile `A=${B}` with schema `{"A":{"enum":["${B}"]}}` | exit 0 (no interpolation) | D4 |
| TS-NOGO-02 | test | grep `bin/` and `src/` | no `writeFile`, `appendFile`, `process.env[...] =`, `node:net`, `node:http`, `node:https`, `fetch(` | D4 |

## Integration Points
- ← [[ux-behavior#Screen: TerminalOutput]] — output format and states
- → [[usecases/UC-ParseEnvText]], [[usecases/UC-EvaluateRules]] — the two pure modules it composes
