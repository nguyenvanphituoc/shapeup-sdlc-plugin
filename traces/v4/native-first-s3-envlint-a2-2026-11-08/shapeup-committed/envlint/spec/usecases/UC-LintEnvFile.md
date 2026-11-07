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
A developer, or CI, runs `envlint --schema <schema.json> <envfile>` and gets every problem printed one
per line, with an exit code that CI can fail on.

## Preconditions
- Node is installed. Both paths are given explicitly as arguments.

## Input

```typescript
interface LintEnvFileInput {
  argv: string[]; // ["--schema", "<schema.json>", "<envfile>"]
}
```

## Steps

```
1. Parse argv with node:util parseArgs; any parse error, missing --schema or not exactly one positional → usage error, exit 2
2. Read the env file; failure → "envlint: cannot read env file <path>", exit 2
3. Read and JSON.parse the schema; failure → "envlint: invalid schema <path>: …", exit 2
4. parseEnv(text) → {pairs, problems}
5. checkRules(pairs, schema) → {findings, schemaErrors}; schemaErrors → "envlint: invalid schema <path>: …", exit 2
6. Print problems and findings to stdout in line order (contract §4)
7. Exit 1 if anything was printed, else 0
```

## Output

```typescript
interface LintEnvFileOutput {
  exitCode: 0 | 1 | 2;
  stdout: string; // one line per problem/finding
  stderr: string; // "envlint: …" for exit 2
}
```

## System Flow

```
[CLI: envlint --schema s.json .env]
  → [bin/envlint.mjs: parseArgs → fs.readFileSync ×2 → JSON.parse]
    → [src/parse.mjs parseEnv(text)]
    → [src/rules.mjs checkRules(pairs, schema)]
  ← [stdout lines + exit code]
```

## Invariants
- [INV-01] No input combination makes the process print a stack trace or exit with a code outside {0,1,2}.
- [INV-02] The CLI reads only the two paths it is given. It never reads `./.env` implicitly and never writes a file.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `USAGE` | missing `--schema`, `--schema` with no value, unknown option, zero or 2+ positionals | n/a | stderr `envlint: …` + usage line, exit 2 |
| `ENV_UNREADABLE` | env file missing or unreadable | n/a | stderr names the env path, exit 2 |
| `SCHEMA_UNREADABLE` | schema file missing or unreadable | n/a | stderr names the schema path, exit 2 |
| `SCHEMA_INVALID_JSON` | schema is not valid JSON | n/a | stderr names the schema path, exit 2 |
| `SCHEMA_INVALID_SHAPE` | rules report schemaErrors | n/a | stderr names the schema path, exit 2 |
| `FINDINGS` | at least one parse problem or rule finding | n/a | lines on stdout, exit 1 |

## Test Surface
<!-- DERIVED — D1 Invariants · D2 Error Cases · D3 contract shape · D4 no-gos. Oracle: process (CLI). -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | run the binary over each error-case input below plus a binary-garbage env file | exit ∈ {0,1,2}; stderr has no `at ` stack frames | D1: INV-01 |
| TS-INV-02 | process | run in a temp cwd that contains a `.env`, pointing at other fixture paths; list cwd after | output reflects only the given files; no file created or changed | D1: INV-02 + D4: no implicit `.env` lookup, never writes `.env` |
| TS-ERR-USAGE | process | no args; `--schema s.json` only; `--schema` with no value; `--bogus`; two positionals | exit 2, stderr starts `envlint:` and contains `usage:` | D2 + D3: argv shape |
| TS-ERR-ENV_UNREADABLE | process | `--schema s.json missing.env` | exit 2, stderr names `missing.env` | D2 |
| TS-ERR-SCHEMA_UNREADABLE | process | `--schema missing.json .env` | exit 2, stderr names `missing.json` | D2 |
| TS-ERR-SCHEMA_INVALID_JSON | process | schema file contains `{not json` | exit 2, stderr names the schema path | D2 |
| TS-ERR-SCHEMA_INVALID_SHAPE | process | schema `{"A":{"type":"float"}}` | exit 2, stderr names the schema path | D2 |
| TS-ERR-FINDINGS | process | env `PORT=abc\nBROKEN\n`, schema `{"PORT":{"type":"int"},"HOST":{"required":true}}` | exit 1; stdout has `<env>:1: PORT: expected int…`, `<env>:2: missing '='`, `<env>: HOST: required key is missing` | D2 + D3: contract §4 output |
| TS-REQ-clean | process | a valid env against a schema it satisfies | exit 0, empty stdout | D3: contract §4 exit codes |
| TS-REQ-no-assignments | process | env file with only comments/blank lines; schema with no required keys / with one required key | exit 0 / exit 1 with the required finding; no crash | D3 + pitch edge "no assignments" |
| TS-NOGO-01 | process | any findings run | stdout/stderr contain no `\x1b[` escape codes and the process does not wait on stdin | D4: no colors, no TUI, no prompts |

## Integration Points
- ← [[usecases/UC-ParseEnvText]] — `parseEnv`
- ← [[usecases/UC-EvaluateRules]] — `checkRules`
- ← [[ux-behavior#Screen: CommandLine]] — the only surface
