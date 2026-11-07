---
type: ux-spec
feature: envlint
entities: [EnvFile, Schema]
usecases: [UC-LintEnvFile]
screens: [Terminal Output]
tags: [ux, cli]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX Behavior — envlint (CLI)

## Screen Flow

```
$ envlint --schema schema.json .env
   ├── clean            → (no output)                                  exit 0
   ├── problems/findings→ one line per item on stdout                  exit 1
   └── usage / IO error → one "envlint: …" line on stderr, no trace    exit 2
```

## Screen: Terminal Output

- **Visual & Layout Specs**: plain text, one item per line, no colors, no ANSI escapes, no TUI, never
  prompts.
- **Design Tokens**: none (plain text).

### States

| State | Trigger | Output | Exit |
|---|---|---|---|
| clean | no parse problem, no finding | nothing | 0 |
| findings | ≥ 1 parse problem or finding | `<envfile>:<line>: <KEY>: <message>` / `<envfile>: <KEY>: <message>` / `<envfile>:<line>: <message>` | 1 |
| usage error | `--schema` or the env-file argument missing, or an unknown option | `envlint: usage: envlint --schema <schema.json> <envfile>` on stderr | 2 |
| env file unreadable | env file missing or unreadable | `envlint: cannot read env file <path>: <reason>` on stderr | 2 |
| schema unreadable | schema missing, unreadable, not JSON, or not the schema shape | `envlint: cannot read schema <path>: <reason>` on stderr | 2 |

### Behavior Rules
- The tool reads exactly the two files named on the command line and nothing else.
- A file with no assignments is not an error: every required key is reported missing; with no required
  key the run is clean.

### Error States

| Error | Message | Action |
|---|---|---|
| USAGE | `envlint: usage: envlint --schema <schema.json> <envfile>` | re-run with both arguments |
| ENV_UNREADABLE | `envlint: cannot read env file <path>: <reason>` | fix the path |
| SCHEMA_UNREADABLE | `envlint: cannot read schema <path>: <reason>` | fix the path or the JSON |
