---
type: usecase
feature: envlint
id: UC-LintEnvFile
bounded_context: env-validation
actor: Developer
entities: [EnvFile, Schema]
repositories: []
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: LintEnvFile

## Summary
A developer (or CI) runs `envlint --schema <schema.json> <envfile>` and gets one line per problem, plus an
exit code CI can fail on.

## Preconditions
- Node is installed; the two paths are given on the command line.

## Input

```typescript
interface LintEnvFileInput {
  schemaPath: string;   // --schema <schema.json>, required
  envPath: string;      // the single positional argument, required
}
```

## Steps

```
1. Parse argv: exactly one --schema <path> and one positional env path; otherwise USAGE.
2. Read the env file (UTF-8); failure → ENV_UNREADABLE.
3. Read and JSON-parse the schema; failure, or not the KeyRule shape → SCHEMA_UNREADABLE.
4. parse(text) → { pairs, problems }            (UC-ParseEnvText)
5. check(pairs, schema) → findings               (UC-CheckRules)
6. Print problems and findings, one line each, on stdout (ux-behavior Terminal Output).
7. Exit 1 when anything was printed, else 0.
```

## Output

```typescript
interface LintEnvFileOutput { stdout: string; stderr: string; exitCode: 0 | 1 | 2 }
```

## System Flow

```
[shell: envlint --schema s.json .env]
  → [CLI: bin/envlint.mjs — argv, fs.readFileSync ×2, JSON.parse]
    → [parse(text) src/parse.mjs] → [check(pairs, schema) src/rules.mjs]
      ← [stdout lines + exit code]
```

## Invariants
- [INV-01] envlint never crashes: every failure path prints one `envlint:` line on stderr and exits 2, with no stack trace.
- [INV-02] envlint reads only the two files named on the command line — no implicit `.env` lookup, never writes a file.
- [INV-03] Output contains no ANSI escape sequences and the process never waits on stdin.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `USAGE` | `--schema` or the env path missing, or an unknown option | exit 2 | usage line on stderr |
| `ENV_UNREADABLE` | the env file does not exist or cannot be read | exit 2 | `envlint: cannot read env file <path>: <reason>` |
| `SCHEMA_UNREADABLE` | the schema does not exist, is not JSON, or is not the KeyRule shape | exit 2 | `envlint: cannot read schema <path>: <reason>` |
| `FINDINGS` | at least one parse problem or rule finding | exit 1 | one stdout line per item |

## Test Surface
<!-- DERIVED — D1–D4 only. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | run with a binary-garbage env file and a schema `[]` | exit 2 or 1, stderr has no `at ` stack frame | D1: INV-01 |
| TS-INV-02 | process | run in a temp dir that holds its own `.env`, pointing at a fixture elsewhere; list the dir before and after | only the fixture is reported; the dir is unchanged | D1: INV-02 + D4: NOGO-01, NOGO-03 |
| TS-INV-03 | process | run with findings, stdin closed | exits without waiting; stdout has no `\x1b[` | D1: INV-03 + D4: NOGO-04 |
| TS-ERR-USAGE | process | run with no args; with only `--schema s.json`; with only `.env` | exit 2, usage line on stderr | D2 + D3 |
| TS-ERR-ENV_UNREADABLE | process | `--schema s.json missing.env` | exit 2, stderr names `missing.env`, no stack trace | D2 |
| TS-ERR-SCHEMA_UNREADABLE | process | schema missing; schema `{not json`; schema `{"A":{"type":"float"}}` | exit 2, stderr names the schema | D2 |
| TS-ERR-FINDINGS | process | env `PORT=abc\nJUNK` with schema `{"PORT":{"type":"int"},"DB":{"required":true}}` | exit 1; stdout `<f>:1: PORT: expected int, got "abc"`, `<f>:2: expected KEY=value`, `<f>: DB: required key is missing` | D2 |
| TS-REQ-envPath-empty-file | process | empty env file, schema with one required key; then schema with none | exit 1 with the missing-key line; then exit 0 with no output | D3 |
| TS-REQ-clean | process | valid env file satisfying its schema | exit 0, empty stdout and stderr | D3 |

## Integration Points
- ← [[usecases/UC-ParseEnvText]] — pairs and problems.
- ← [[usecases/UC-CheckRules]] — findings.
- → [[ux-behavior]] — Terminal Output.
