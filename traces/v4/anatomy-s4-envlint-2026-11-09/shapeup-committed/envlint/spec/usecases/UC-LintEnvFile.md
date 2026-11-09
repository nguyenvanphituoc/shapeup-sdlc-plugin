---
type: usecase
feature: envlint
id: UC-LintEnvFile
bounded_context: EnvValidation
actor: Developer (or CI)
entities: [EnvPair, Finding]
repositories: []
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]", "[[usecases/UC-ParseEnvText]]", "[[usecases/UC-CheckRules]]"]
status: draft
---

# Use Case: LintEnvFile

## Summary
A developer or CI runs `envlint --schema <schema.json> <envfile>` and gets each problem on its own line and an exit code that says clean, findings, or could-not-run.

## Preconditions
- Node runs `bin/envlint.mjs`. Both paths are given explicitly; nothing is looked up implicitly.

## Input

```typescript
interface LintEnvFileInput {
  argv: string[]        // e.g. ["--schema", "s.json", ".env"]; --schema may come before or after the env file
  schemaPath: string    // required
  envPath: string       // required, exactly one positional
}
```

## Steps

```
1. Parse argv: exactly one `--schema <path>` and exactly one positional env path; anything else → USAGE (exit 2).
2. Read the schema file (UTF-8) → unreadable: SCHEMA_UNREADABLE. JSON.parse → fails: SCHEMA_INVALID_JSON.
3. checkSchema(schema) → any problem: SCHEMA_INVALID (one stderr line per problem).
4. Read the env file (UTF-8) → unreadable: ENV_UNREADABLE.
5. parseEnv(text) → {pairs, problems}. Zero pairs → stderr notice "envlint: <envfile>: no assignments found" (SD-5).
6. checkRules(pairs, schema) → findings.
7. Print problems + findings to stdout per [[ux-behavior#Output line format (stdout)]], in the order given there.
8. Exit 1 if anything was printed to stdout, else 0. Any unexpected exception → one stderr line, exit 2, no stack trace.
```

## Output

```typescript
interface LintEnvFileOutput { stdout: string; stderr: string; exitCode: 0 | 1 | 2 }
```

## System Flow

```
[Shell / CI: node bin/envlint.mjs --schema s.json .env]
  → [bin/envlint.mjs: argv → fs.readFileSync(schema) → JSON.parse → checkSchema]
  → [fs.readFileSync(env) → parseEnv → checkRules]
    ← stdout lines + process.exitCode
```

## Invariants
- [INV-01] No input file, however malformed, produces a stack trace or an exit code other than 0, 1 or 2.
- [INV-02] envlint never writes any file (the env file and schema are byte-identical after a run, and no new file appears).
- [INV-03] envlint never reads `./.env` or any path it was not given.
- [INV-04] Output contains no ANSI escape sequences and the process never waits on stdin.
- [INV-05] The run makes no network access.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `USAGE` | `--schema` missing / valueless, no env path, two env paths, unknown flag | exit 2 | usage line on stderr |
| `ENV_UNREADABLE` | env file does not exist or cannot be read | exit 2 | `cannot read env file` line on stderr |
| `SCHEMA_UNREADABLE` | schema file does not exist or cannot be read | exit 2 | `cannot read schema` line on stderr |
| `SCHEMA_INVALID_JSON` | schema text is not valid JSON | exit 2 | `invalid schema` line on stderr |
| `SCHEMA_INVALID` | `checkSchema` returns problems | exit 2 | one `invalid schema` line per problem |
| `FINDINGS` | ≥ 1 parse problem or rule finding | exit 1 | one stdout line per item |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | run on a binary-garbage env file, on an empty schema `{}` + env `\u0000=\n"`, and on schema `[1]` | exit ∈ {1, 2}; stderr has no `    at ` stack line | D1: INV-01 |
| TS-INV-02 | process | hash the tmp dir's files, run a findings case, re-hash and list | identical hashes, no new file | D1: INV-02 + D4: NOGO-01 |
| TS-INV-03 | process | in a tmp cwd holding a `.env` with `A=1`, run with no env-path argument | exit 2 usage; the `.env` content never appears in output | D1: INV-03 + D4: NOGO-03 |
| TS-INV-04 | process | run a findings case with stdin closed and with `FORCE_COLOR=1` | exits without waiting; stdout/stderr contain no `\x1b[` | D1: INV-04 + D4: NOGO-04 |
| TS-INV-05 | process | run with a url-typed key `U=https://example.invalid` via `node --import <preload>` where the preload makes `net` connect and `dns.lookup` throw | exit 0 | D1: INV-05 + D4: NOGO-05 |
| TS-ERR-USAGE | process | argv `[]`, `[".env"]`, `["--schema"]`, `["--schema","s.json"]`, `["--schema","s.json","a","b"]`, `["--bogus","x"]` | exit 2, stderr starts `envlint: usage:` | D2 |
| TS-ERR-ENV_UNREADABLE | process | env path that does not exist | exit 2, stderr names the path | D2 |
| TS-ERR-SCHEMA_UNREADABLE | process | schema path that does not exist | exit 2, stderr names the path | D2 |
| TS-ERR-SCHEMA_INVALID_JSON | process | schema text `{not json` | exit 2, stderr `invalid schema` | D2 |
| TS-ERR-SCHEMA_INVALID | process | schema `{"A":{"type":"float"}}` | exit 2, stderr names `A` | D2 |
| TS-ERR-FINDINGS | process | schema `{"PORT":{"required":true,"type":"int"},"MODE":{"enum":["dev","prod"]},"DB":{"required":true}}`, env `PORT=abc\nMODE=test\nBAD LINE\n` | exit 1; stdout lines `<env>:1: PORT: …`, `<env>:2: MODE: …`, `<env>:3: parse error: …`, `<env>: DB: missing required key` in that order | D2 + D3 |
| TS-REQ-clean | process | schema `{"PORT":{"type":"int"}}`, env `PORT=80` | exit 0, stdout empty | D3 |
| TS-REQ-schema-after | process | argv `[env, "--schema", s]` on the clean case | exit 0 | D3: Input |
| TS-REQ-empty-file | process | env file with only comments/blank lines, schema `{"A":{"required":true}}` | stderr `no assignments found`; stdout `<env>: A: missing required key`; exit 1 | D3 (SD-5) |

## Integration Points
- → [[usecases/UC-ParseEnvText]] — calls `parseEnv`
- → [[usecases/UC-CheckRules]] — calls `checkSchema`, `checkRules`
