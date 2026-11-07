---
type: ux-spec
feature: envlint
entities: [Finding]
usecases: [UC-LintEnvFile]
screens: [TerminalOutput]
tags: [ux, cli]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX behaviour — envlint

## Screen Flow

```
$ envlint --schema schema.json app.env
   ├── clean            → (no output)                         exit 0
   ├── findings/problems→ one line per item on stdout          exit 1
   └── usage / IO error → one "envlint: …" line on stderr      exit 2
```

## Screen: TerminalOutput

**Visual & Layout Specs**: plain text, one item per line, no colour, no banner, no stack trace.

**Design Tokens**: none (terminal text).

### States

| State | Trigger | stdout | stderr | exit |
|---|---|---|---|---|
| clean | no parse problems, no findings | empty | empty | 0 |
| findings | ≥1 parse problem or finding | one line per item, parse problems first (by line), then findings | empty | 1 |
| usage error | missing `--schema`, missing env path, extra/unknown args | empty | `envlint: usage: envlint --schema <schema.json> <envfile>` | 2 |
| io error | env file or schema file missing/unreadable | empty | `envlint: cannot read <path>: <reason>` | 2 |
| schema error | schema not valid JSON, or not a valid schema | empty | `envlint: invalid schema <path>: <reason>` | 2 |

### Behavior Rules
- Line format for a parse problem: `<envfile>:<line>: parse: <message>`.
- Line format for a finding with a line: `<envfile>:<line>: <KEY>: <message>`.
- Line format for a missing required key: `<envfile>: <KEY>: <message>`.
- A file with no assignments (empty, blank or comments only) is not an error: it produces only the
  findings its schema implies (missing required keys) and exits 0 when there are none.

### Error States

| Condition | Message | Action for the user |
|---|---|---|
| missing file | `envlint: cannot read <path>: …` | fix the path |
| invalid schema | `envlint: invalid schema <path>: …` | fix the schema |
| bad args | usage line | re-run with both arguments |
