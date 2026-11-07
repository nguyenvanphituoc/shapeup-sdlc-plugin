---
type: ux-spec
feature: envlint
entities: [EnvFile, Schema, Finding]
usecases: [UC-ParseEnv, UC-CheckRules, UC-LintEnvFile]
screens: [Terminal]
tags: [ux, cli]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX Behavior — envlint (CLI)

## Screen Flow

```
envlint --schema schema.json app.env
   │
   ├─ usage wrong ──────────────► stderr "envlint: <usage message>"     exit 2
   ├─ file missing / unreadable ► stderr "envlint: <names the file>"   exit 2
   ├─ schema invalid JSON/shape ► stderr "envlint: <names the schema>" exit 2
   ├─ findings or parse problems► stdout one line each                 exit 1
   └─ clean ────────────────────► stdout empty                         exit 0
```

## Screen: Terminal

**Visual & Layout Specs**: plain text lines, no colors, no ANSI escapes, no TUI, no prompts.
**Design Tokens**: none (plain text output).

### States

| State | Trigger | Output | Exit |
|---|---|---|---|
| clean | no findings, no parse problems | nothing on stdout | 0 |
| findings | at least one finding or parse problem | one line per item on stdout, in line order | 1 |
| usage error | `--schema` missing or without a value, no env file, more than one env file, unknown option | `envlint: <message>` + `usage: envlint --schema <schema.json> <envfile>` on stderr | 2 |
| io error | env file or schema file missing, or a directory | `envlint: cannot read <path>` on stderr | 2 |
| schema error | schema is not valid JSON, or has an invalid shape | `envlint: invalid schema <path>: <reason>` on stderr | 2 |

### Behavior Rules
- The env file and the schema are both taken from argv; nothing is looked up implicitly.
- `--schema` may come before or after the env file, as `--schema x` or `--schema=x`.
- Output never contains a stack trace.
- envlint never writes any file.

### Error States

| Error | Message | Action |
|---|---|---|
| `USAGE` | `envlint: <what is wrong>` + usage line | fix the command line |
| `IO` | `envlint: cannot read <path>` | fix the path |
| `SCHEMA` | `envlint: invalid schema <path>: <reason>` | fix the schema |
