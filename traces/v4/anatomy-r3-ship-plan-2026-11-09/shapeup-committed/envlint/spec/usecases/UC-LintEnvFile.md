---
type: usecase
feature: envlint
id: UC-LintEnvFile
bounded_context: EnvValidation
actor: Developer
entities: [ParseResult, Schema, Finding]
repositories: []
domain_events_emitted: []
tags: [cli, composition-root]
depends_on: ["[[domain-model]]", "[[ux-behavior]]", "[[usecases/UC-ParseEnvText]]", "[[usecases/UC-CheckRules]]"]
status: draft
---

# Use Case: LintEnvFile

## Summary
A developer (or CI) runs `envlint --schema <schema.json> <envfile>`; the tool prints every problem key by key and line by line and exits non-zero when there is any.

## Preconditions
- Node is installed; both paths are passed explicitly.

## Input

```typescript
interface LintEnvFileInput {
  argv: string[] // ["--schema", "<schema.json>", "<envfile>"] in any order of the flag and the positional
}
```

## Steps

```
1. Parse argv: exactly one --schema <path> and exactly one positional <envfile>; else usage error (exit 2)
2. Read the env file (node:fs); failure → I/O error (exit 2)
3. Read and JSON.parse the schema; failure or non-object → schema error (exit 2)
4. parse(envText) → {pairs, problems}
5. check(pairs, schema) → findings
6. Print problems then findings to stdout in the ux-behavior format
7. Exit 1 if any problem or finding, else 0
```

## Output

```typescript
interface LintEnvFileOutput {
  stdout: string // one line per finding, no ANSI codes
  stderr: string // "envlint: error: ..." on exit 2 only
  exitCode: 0 | 1 | 2
}
```

## System Flow

```
[CLI: bin/envlint.mjs argv]
  → [node:fs read env file + schema file]
    → [parse(text) — src/parse.mjs]
    → [check(pairs, schema) — src/rules.mjs]
      → [stdout lines + process exit code]
```

## Invariants
- [INV-01] No input file ever produces a stack trace or an uncaught exception; every outcome is exit 0, 1 or 2.
- [INV-02] The CLI never writes any file (the env file is unchanged after a run).

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `CLI_USAGE` | `--schema` or the env path missing, or an unknown argument | exit 2 | stderr `envlint: error: usage: envlint --schema <schema.json> <envfile>` |
| `CLI_ENV_UNREADABLE` | the env file does not exist or cannot be read | exit 2 | stderr names the env path |
| `CLI_SCHEMA_UNREADABLE` | the schema file does not exist, cannot be read, is not JSON, or is not an object | exit 2 | stderr names the schema path |
| `CLI_FINDINGS` | ≥ 1 parse problem or rule finding | exit 1 | one stdout line per finding with path and line |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | run against a binary-junk env file, an empty env file, and a schema of `[]` | exit ∈ {1, 2} or 0, stderr has no `at ` stack frame | D1: INV-01 |
| TS-INV-02 | process | run with findings; compare env file bytes before/after | unchanged; no new files in the fixture dir | D1: INV-02 + D4: never writes a `.env` file |
| TS-ERR-CLI_USAGE | process | run with no args; with `--schema` only; with env path only | exit 2, stderr starts `envlint: error:` | D2 + D3 (dedup: argv missing fields) |
| TS-ERR-CLI_ENV_UNREADABLE | process | `--schema ok.json missing.env` | exit 2, stderr names `missing.env`, no stack trace | D2 |
| TS-ERR-CLI_SCHEMA_UNREADABLE | process | schema path missing; schema containing `{not json` | exit 2, stderr names the schema path, no stack trace | D2 |
| TS-ERR-CLI_FINDINGS | process | env with a bad line 3 and a wrong-type key on line 5, schema requiring a missing key | exit 1; stdout lines `<env>:3: …`, `<env>:5: …`, `<env>: <KEY>: required key is missing` | D2 |
| TS-REQ-clean | process | valid env file satisfying the schema | exit 0, empty stdout | D3 |
| TS-REQ-no-assignments | process | env file with only comments/blank lines, schema with no required keys | exit 0, no crash | D3 + pitch edge "a file with no assignments" |
| TS-NOGO-01 | process | run from a cwd containing its own `.env`, passing a different env path | only the passed file is read (findings match the passed file) | D4: no implicit `.env` lookup |
| TS-NOGO-02 | process | run with findings | stdout contains no `\x1b[` escape sequences and the process does not wait for stdin | D4: no colors, TUI or prompts |

## Integration Points
- ← [[ux-behavior]] — the invocation and output contract
- → [[usecases/UC-ParseEnvText]], [[usecases/UC-CheckRules]] — composed here
