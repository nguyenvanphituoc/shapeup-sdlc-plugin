---
type: usecase
feature: envlint
id: UC-LintEnvFile
bounded_context: envlint
actor: Developer
entities: [EnvPair, ParseProblem, Schema, Finding]
repositories: []
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: LintEnvFile

## Summary
A developer (or CI) runs `envlint --schema <schema.json> <envfile>` and gets every problem printed line by line, with a non-zero exit if anything is wrong.

## Preconditions
- Node is on the PATH; the binary is `bin/envlint.mjs`.

## Input

```typescript
interface LintEnvFileInput {
  schemaPath: string; // --schema <schema.json>, required
  envPath: string;    // positional <envfile>, required — no implicit .env lookup
}
```

## Steps

```
1. Parse argv; missing --schema value or missing env path → USAGE
2. Read the env file; failure → ENV_NOT_FOUND
3. Read and JSON.parse the schema; failure → SCHEMA_UNREADABLE
4. parse(text) → {pairs, problems}       ([[usecases/UC-ParseEnvText]])
5. check(pairs, schema) → findings       ([[usecases/UC-CheckEnvAgainstSchema]])
6. Print problems and findings per [[ux-behavior#Screen: Terminal]], plain text
7. Exit 1 if any problem or finding, else 0
```

## Output

```typescript
interface LintEnvFileOutput {
  stdout: string;   // one line per problem / finding
  stderr: string;   // usage or I/O error line
  exitCode: 0 | 1 | 2;
}
```

## System Flow

```
[Terminal: envlint --schema s.json app.env]
  → [CLI: bin/envlint.mjs — argv, node:fs reads]
    → [parse(text) — src/parse.mjs]
    → [check(pairs, schema) — src/rules.mjs]
  ← [stdout lines + exit code]
```

## Invariants
- [INV-01] The CLI never writes any file (the env file and schema are read only).
- [INV-02] Output carries no ANSI escape codes and the CLI never prompts.
- [INV-03] The CLI reads only the env file named on argv — never an implicit `.env` in the cwd.
- [INV-04] No input file makes the CLI crash: every failure exits 1 or 2 with no stack trace.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `USAGE` | `--schema` or the env file argument is missing | — | usage line on stderr, exit 2 |
| `ENV_NOT_FOUND` | the env file does not exist or cannot be read | — | stderr names the env file, exit 2 |
| `SCHEMA_UNREADABLE` | the schema file is missing or is not valid JSON | — | stderr names the schema file, exit 2 |
| `FINDINGS` | at least one parse problem or rule finding | — | one stdout line each, exit 1 |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | run on temp fixtures, list the temp dir before and after | exit 1/0 as per input; no file created or modified | D1: INV-01 |
| TS-INV-02 | process | run with findings | stdout has no `\x1b[` sequence; process exits without stdin | D1: INV-02 |
| TS-INV-03 | process | cwd holds a `.env` with errors; run with `--schema s.json` and no env arg | exit 2 usage — the cwd `.env` is not read | D1: INV-03 |
| TS-INV-04 | process | run on a binary-garbage env file and on an empty env file | exit 1 or 0, no stack trace on stderr | D1: INV-04 |
| TS-ERR-USAGE | process | run with no arguments; with `--schema` only | exit 2, usage on stderr | D2 + D3 (dedup) |
| TS-ERR-ENV_NOT_FOUND | process | `--schema s.json missing.env` | exit 2, stderr names `missing.env`, no stack trace | D2 |
| TS-ERR-SCHEMA_UNREADABLE | process | schema path missing; schema file holding `{not json` | exit 2, stderr names the schema file, no stack trace | D2 |
| TS-ERR-FINDINGS | process | env `PORT=abc` with schema `{PORT:{type:"int"}}`, plus a missing required key | exit 1, stdout names `PORT` with line 1 and the missing key | D2 |
| TS-REQ-clean | process | valid env matching schema | exit 0, empty stdout | D3 |
| TS-REQ-no-assignments | process | env file of only comments and blank lines; schema with one required key | exit 1, one MISSING_REQUIRED line, no crash | D3 |
| TS-NOGO-01 | process | any run | env file bytes unchanged afterwards | D4: never writes a `.env` file |
| TS-NOGO-02 | process | run with findings | no ANSI color codes in stdout or stderr | D4: no colors / TUI / prompts |
| TS-NOGO-03 | process | env `A=${HOME}`, schema `{A:{enum:["x"]}}` | finding quotes the literal `${HOME}` | D4: no `${VAR}` interpolation |

## Integration Points
- ← [[ux-behavior#Screen: Terminal]] — triggered by the command line
- → [[usecases/UC-ParseEnvText]] and [[usecases/UC-CheckEnvAgainstSchema]] — composed here
