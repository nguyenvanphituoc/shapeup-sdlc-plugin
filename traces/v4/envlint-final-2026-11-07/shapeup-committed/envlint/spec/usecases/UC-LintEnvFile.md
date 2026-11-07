---
type: usecase
feature: envlint
id: UC-LintEnvFile
bounded_context: env-validation
actor: Developer
entities: [EnvFile, Schema, Finding]
repositories: []
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: LintEnvFile

## Summary
A developer (or CI) runs `envlint --schema <schema.json> <envfile>` and gets every problem printed
key by key, line by line, with an exit code CI can fail on, per [[contracts/cli.contract]].

## Preconditions
- Node is installed; the developer names both files explicitly.

## Input

```typescript
interface LintEnvFileInput {
  schemaPath: string; // --schema <path>, required
  envPath: string;    // positional, required; never defaulted
}
```

## Steps

```
1. Parse argv; missing/extra/unknown arguments → USAGE (exit 2)
2. Read the schema file → SCHEMA_UNREADABLE on failure; JSON.parse → SCHEMA_INVALID on failure
3. validateSchema → SCHEMA_INVALID when defects
4. Read the env file → ENV_UNREADABLE on failure
5. parse(text) → {pairs, problems}; lint(pairs, schema) → findings
6. Print problems then findings per [[ux-behavior#Screen: TerminalOutput]]
7. Exit 0 when nothing printed, 1 otherwise
```

## Output

```typescript
interface LintEnvFileOutput {
  stdout: string;   // one line per problem/finding
  stderr: string;   // one "envlint: …" line on exit 2
  exitCode: 0 | 1 | 2;
}
```

## System Flow

```
[Shell: envlint --schema s.json app.env]
  → [CLI: bin/envlint.mjs argv + readFile ×2]
    → [Module: parse(text)  src/parse.mjs]
    → [Module: validateSchema / lint  src/rules.mjs]
  ← [stdout lines + exit code]
```

## Invariants
- [INV-01] No input — malformed env file, malformed schema, missing files, bad args — produces a stack trace or an uncaught exception; every failure is one `envlint: …` line and exit 2.
- [INV-02] The env file is only ever the one named on the command line: with no positional path the tool never reads `./.env`.
- [INV-03] A file with no assignments at all (empty, blank lines, comments only) does not crash: it yields only the findings its schema implies.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `USAGE` | `--schema` missing, env path missing, extra or unknown argument | exit 2 | usage line on stderr |
| `ENV_UNREADABLE` | env file missing or unreadable | exit 2 | `envlint: cannot read <path>: …` |
| `SCHEMA_UNREADABLE` | schema file missing or unreadable | exit 2 | `envlint: cannot read <path>: …` |
| `SCHEMA_INVALID` | schema not JSON, or `validateSchema` defects | exit 2 | `envlint: invalid schema <path>: …` |
| `FINDINGS` | ≥1 parse problem or finding | exit 1 | one stdout line per item |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Run the binary over a malformed env file (`=x`, `"open`), a schema `[1,2]`, and garbage bytes | exit 1 or 2 as per contract; stderr has no `at ` stack frame lines | D1: INV-01 |
| TS-INV-02 | process | In a temp dir containing `.env`, run `envlint --schema s.json` with no env path | exit 2, usage line; `.env` not read (its contents never printed) | D1: INV-02 + D2 USAGE (dedup) |
| TS-INV-03 | process | Run over an empty file, and a comments-only file, with schema `{}` and with `{A:{required:true}}` | `{}` → exit 0, no output; required → exit 1, one `A` line | D1: INV-03 |
| TS-ERR-USAGE | process | No args; `--schema` without a value; two positional paths; `--bogus` | exit 2, usage line on stderr, stdout empty | D2 + D3 (dedup) |
| TS-ERR-ENV_UNREADABLE | process | `--schema s.json missing.env` | exit 2, stderr names `missing.env` | D2 |
| TS-ERR-SCHEMA_UNREADABLE | process | `--schema missing.json app.env` | exit 2, stderr names `missing.json` | D2 |
| TS-ERR-SCHEMA_INVALID | process | schema file `{not json`, and `{"A":{"type":"float"}}` | exit 2, stderr `invalid schema` naming the path | D2 |
| TS-ERR-FINDINGS | process | env with a parse problem on line 2 and a `type` violation on line 3 | exit 1; stdout has `<env>:2: parse:` then `<env>:3: KEY:` lines | D2 |
| TS-REQ-clean | process | valid env satisfying the schema | exit 0, stdout empty | D3 |
| TS-REQ-arg-order | process | `envlint app.env --schema s.json` | same result as the canonical order | D3 |
| TS-NOGO-01 | process | Lint a file; compare its bytes and mtime before/after | file unchanged — no `.env` writing | D4: no .env writing |
| TS-NOGO-02 | process | env `B=1` and `A=${B}`, schema `A: int` | `A` reported as a `type` finding — `${B}` not interpolated | D4: no interpolation |
| TS-NOGO-03 | process | Run with an env file setting `NODE_OPTIONS=--bogus`, schema `{}` | exit 0; nothing loaded into the process environment | D4: no dotenv-compatible loading |

## Integration Points
- → [[usecases/UC-ParseEnvText]] — env file text in, pairs + problems out
- → [[usecases/UC-EvaluateRules]] — pairs + schema in, findings out
- ← [[ux-behavior#Screen: TerminalOutput]] — the only "screen"
