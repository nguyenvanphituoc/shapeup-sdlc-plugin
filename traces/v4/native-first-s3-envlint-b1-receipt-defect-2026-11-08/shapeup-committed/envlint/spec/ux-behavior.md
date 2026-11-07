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

# UX Behavior: envlint

## Screen Flow

```
[shell: envlint --schema <schema.json> <envfile>]
    │
    ├─ bad arguments / unreadable file / bad schema ──► [stderr: "envlint: <reason>"]  exit 2
    │
    └─ both files read, schema valid ──► parse + evaluate
                                             │
                                   ┌─────────┴─────────┐
                                   │                   │
                              no findings        ≥1 problem or finding
                                   │                   │
                          [no output] exit 0   [stdout: one line each] exit 1
```

---

## Screen: TerminalOutput

### States

| State | Trigger | Behavior | Exit |
|-------|---------|----------|------|
| `usage-error` | `--schema` missing, no envfile, extra or unknown argument | one line on stderr: `envlint: usage: envlint --schema <schema.json> <envfile>` | 2 |
| `io-error` | envfile or schema file cannot be read | one line on stderr naming the path: `envlint: cannot read <path>` | 2 |
| `schema-error` | schema is not JSON, or fails `validateSchema` | one line on stderr per problem, each starting `envlint: invalid schema <path>: ` | 2 |
| `clean` | no parse problems and no findings | nothing on stdout or stderr | 0 |
| `findings` | ≥1 parse problem or finding | one line per item on stdout (format below); nothing on stderr | 1 |

### Behavior Rules

- [RULE-01] Output lines (stdout):
  - parse problem: `<envfile>:<line>: parse error: <message>`
  - finding with a line: `<envfile>:<line>: <KEY>: <message>`
  - missing required key: `<envfile>: <KEY>: required key is missing`
- [RULE-02] Lines with a line number come first, ascending by line; missing-required lines follow, in schema key order.
- [RULE-03] `<envfile>` is printed exactly as given on the command line.
- [RULE-04] No ANSI escape sequences, no prompts, no reading from stdin; output never depends on a TTY.
- [RULE-05] No input ever produces a stack trace or an uncaught exception; every failure is one of the states above.
- [RULE-06] A file with no assignments (empty, blank lines or comments only) is parsed to zero pairs and judged normally: clean when the schema requires nothing, one missing-required line per required key otherwise.

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `USAGE` | arguments do not match `--schema <schema.json> <envfile>` | `envlint: usage: envlint --schema <schema.json> <envfile>` | fix the command line |
| `READ_FAILED` | a file is missing or unreadable | `envlint: cannot read <path>` | fix the path |
| `SCHEMA_INVALID` | schema not JSON / wrong shape | `envlint: invalid schema <path>: <reason>` | fix the schema |
