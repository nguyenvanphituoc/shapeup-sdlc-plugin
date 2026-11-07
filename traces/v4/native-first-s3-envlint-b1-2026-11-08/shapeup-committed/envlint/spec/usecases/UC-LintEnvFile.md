---
type: usecase
feature: envlint
id: UC-LintEnvFile
bounded_context: envlint
actor: Admin
entities: [EnvFile, Schema]
repositories: []
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: LintEnvFile

## Summary
A developer (or CI) runs `envlint --schema <schema.json> <envfile>` and gets every problem printed
key by key and line by line, with an exit code CI can fail on.

## Preconditions
- Node is installed; `bin/envlint.mjs` is executable through `node`.

## Input

```typescript
// argv: envlint --schema <schema.json> <envfile>
interface LintEnvFileInput {
  schema: string;  // path, required; `--schema x` or `--schema=x`, before or after the env file
  envfile: string; // path, required, exactly one positional
}
```

## Steps

```
1. Parse argv with node:util parseArgs (strict); unknown option → USAGE
2. Require --schema with a value and exactly one positional → else USAGE
3. Read the schema file; missing / directory → IO; JSON.parse fails → SCHEMA
4. checkSchema(schema) non-empty → SCHEMA
5. Read the env file; missing / directory → IO
6. parse(text) → { pairs, problems }
7. check(pairs, schema) → findings
8. Print problems and findings to stdout per PD-14, ordered by line (missing-key findings last)
9. Exit 1 if anything was printed, else 0
```

## Output

```typescript
interface LintEnvFileOutput {
  stdout: string;   // one line per problem or finding, no ANSI codes
  stderr: string;   // one `envlint: …` line (plus usage line on USAGE), never a stack trace
  exitCode: 0 | 1 | 2;
}
```

## System Flow

```
[Terminal: envlint --schema s.json app.env]
  → [bin/envlint.mjs: parseArgs → readFileSync ×2]
    → [src/parse.mjs: parse]  → [src/rules.mjs: checkSchema, check]
      ← [stdout lines + exit code]
```

## Invariants
- [INV-01] envlint writes no file: the directory holding the env file and schema is byte-identical after any run.
- [INV-02] No input makes envlint crash: every failure path ends with exit 2 and a one-line `envlint:` message, never a stack trace.
- [INV-03] Output carries no ANSI escape sequences and the process never waits for stdin.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `USAGE` | `--schema` missing or empty, no env file, two env files, unknown option | exit 2 | stderr `envlint: …` + usage line |
| `IO` | env file or schema missing, or a directory | exit 2 | stderr `envlint: cannot read <path>` |
| `SCHEMA` | schema not valid JSON, or fails `checkSchema` | exit 2 | stderr `envlint: invalid schema <path>: <reason>` |
| `FINDINGS` | at least one parse problem or rule finding | exit 1 | one stdout line each per PD-14 |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | run envlint over fixtures in a temp dir (clean, findings, bad schema) and list the dir before/after | exit per case; directory listing and contents unchanged | D1: INV-01 + D4: never writes a `.env` |
| TS-INV-02 | process | run with a binary-garbage env file and with a schema of `null` | exit 2 or 1, stderr has no `at ` stack frame lines | D1: INV-02 |
| TS-INV-03 | process | run the findings fixture with stdin closed | stdout has no `\x1b[`; process exits without input | D1: INV-03 + D4: no colors / prompts |
| TS-ERR-USAGE | process | no args · `--schema` with no value · schema but no env file · two env files · `--bogus` | exit 2, stderr starts `envlint:` and contains `usage:` | D2 + D3 |
| TS-ERR-IO | process | env file path does not exist · schema path does not exist · schema path is a directory | exit 2, stderr names the path, no stack trace | D2 |
| TS-ERR-SCHEMA | process | schema file `{not json` · schema `{"A":{"type":"float"}}` | exit 2, stderr `envlint: invalid schema <path>` | D2 |
| TS-ERR-FINDINGS | process | env `A=x\nGARBAGE\n`, schema `{"A":{"type":"int"},"B":{"required":true}}` | exit 1; stdout has `<env>:1: A: …`, `<env>:2: …`, `<env>: B: …` | D2 |
| TS-REQ-clean | process | env `A=1`, schema `{"A":{"type":"int","required":true}}` | exit 0, stdout empty | D3 |
| TS-REQ-empty-file | process | empty env file and a comments-only env file, schema with no required keys; then a schema with a required key | exit 0 then exit 1 naming the key | D3 + pitch edge "no assignments" |
| TS-REQ-schema-position | process | `envlint app.env --schema=s.json` | same result as `--schema s.json app.env` | D3 |
| TS-NOGO-01 | process | run in a temp cwd that contains a `.env` with errors, passing a different clean env file | exit 0 — the cwd `.env` is never read | D4: no implicit `.env` lookup |

## Integration Points
- ← [[ux-behavior#Screen: Terminal]] — the argv / stdout / exit contract
- → [[usecases/UC-ParseEnv]], [[usecases/UC-CheckRules]] — composed here
