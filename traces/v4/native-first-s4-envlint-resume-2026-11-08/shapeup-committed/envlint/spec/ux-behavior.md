---
type: ux-behavior
feature: envlint
lens: lite
---

# UX behavior — envlint (the terminal is the only screen)

LITE lens: this file is the primary spec for the user-visible surface. There is no breadboard and no
graphical UI; the one "screen" is the process's stdout, stderr and exit code. Plain text only — no ANSI
escape sequences, no TUI, no prompts, nothing read from stdin.

Back to [[_index]] · contracts: [[domain-model]] · use case: [[usecases/UC-03-lint-env-file]]

## Invocation

```
envlint --schema <schema.json> <envfile>
```

Exactly one positional (the env file) and exactly one `--schema <path>` (also `--schema=<path>`). There
is no default env file and no default schema: nothing is looked up implicitly.

## State table

| State | Trigger | stdout | stderr | exit |
|---|---|---|---|---|
| usage error | no args, missing `--schema`, zero or several positionals, unknown flag | — | `envlint: <reason>` then `usage: envlint --schema <schema.json> <envfile>` | 2 |
| io error (env) | env file missing / a directory / unreadable | — | `envlint: cannot read env file <path>: <ENOENT\|EISDIR\|EACCES\|code>` | 2 |
| io error (schema) | schema file missing / a directory / unreadable | — | `envlint: cannot read schema file <path>: <code>` | 2 |
| schema error | schema not valid JSON | — | `envlint: invalid schema <path>: not valid JSON` | 2 |
| schema error | schema fails `checkSchema` | — | `envlint: invalid schema <path>: <first error>` | 2 |
| clean | no parse problems and no findings (including an env file with no assignments and no required keys) | nothing | nothing | 0 |
| findings | ≥ 1 parse problem or finding | one line per item (format below) | — | 1 |
| internal error | anything unexpected | — | `envlint: internal error: <message>` (never a stack trace) | 2 |

## Output lines (findings state)

```
<envfile>:<line>: parse error: <message>      ← a C1 problem
<envfile>:<line>: <KEY>: <message>            ← a C3 finding with a line
<envfile>: <KEY>: <message>                   ← a C3 finding with line null (missing required key)
```

`<envfile>` is the path exactly as given on the command line. Order: every item that has a line,
ascending by line (a parse problem before a finding on the same line); then the line-less findings in
schema key order.

## Error cases (message + action)

| Case | Message | User action |
|---|---|---|
| forgot `--schema` | `envlint: missing --schema` | add `--schema <file>` |
| forgot the env file | `envlint: expected exactly one env file` | pass the env file path |
| env file not found | `envlint: cannot read env file <p>: ENOENT` | fix the path |
| schema not JSON | `envlint: invalid schema <p>: not valid JSON` | fix the schema |
