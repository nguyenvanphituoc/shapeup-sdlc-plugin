---
type: ux-spec
feature: envlint
entities: [EnvFile, Schema, Finding]
usecases: [UC-LintEnvFile]
screens: [CommandLine]
tags: [ux, cli]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX Behavior — envlint

## Screen Flow

```
$ envlint --schema schema.json .env.ci
   │
   ├─ bad usage / unreadable input ──► stderr "envlint: …" ─► exit 2
   ├─ problems or findings ──────────► stdout, one line each ─► exit 1
   └─ clean ─────────────────────────► no output ─────────────► exit 0
```

## Screen: CommandLine

- **Visual & Layout Specs**: plain text lines, no colors, no TUI, no prompts.
- **Design Tokens**: none; the output contains no ANSI escape codes.

### States

| State | Output | Exit |
|---|---|---|
| clean | nothing | 0 |
| findings | one line per problem/finding (format in [[contracts/envlint.contract]]) | 1 |
| error | `envlint: <message>` on stderr | 2 |

### Behavior Rules
- Both files are explicit arguments. There is no implicit `.env` lookup.
- Output is deterministic and ordered by line.

### Error States

| Condition | Message (stderr) | Action |
|---|---|---|
| missing `--schema` or env path | `envlint: …` + usage line | fix the invocation |
| env file missing | `envlint: cannot read env file <path>` | fix the path |
| schema unreadable / invalid JSON / bad shape | `envlint: invalid schema <path>: …` | fix the schema |
