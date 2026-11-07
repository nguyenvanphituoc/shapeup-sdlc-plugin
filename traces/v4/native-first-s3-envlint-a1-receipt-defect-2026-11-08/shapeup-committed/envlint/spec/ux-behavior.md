---
type: ux-spec
feature: envlint
entities: [Finding, ParseProblem]
usecases: [UC-LintEnvFile]
screens: [Terminal]
tags: [ux, cli]
depends_on: ["[[domain-model]]"]
status: ready
---

# UX behavior — envlint

## Screen Flow

```
$ envlint --schema <schema.json> <envfile>
   ├─ bad arguments        → usage line on stderr, exit 2
   ├─ env file missing     → one-line error naming the file on stderr, exit 2
   ├─ schema unreadable    → one-line error naming the file on stderr, exit 2
   ├─ problems or findings → one line per item on stdout, exit 1
   └─ clean                → no findings printed, exit 0
```

## Screen: Terminal

- **Visual & Layout Specs**: plain text, one item per line, no colors, no ANSI escape codes, no TUI,
  no prompts.
- **Design Tokens**: none (no styling).

### States

| State | Output | Exit |
|---|---|---|
| idle | — (single invocation, no interactive state) | — |
| error | one line on stderr naming the cause and the file, no stack trace | 2 |
| findings | one line per parse problem and per finding on stdout | 1 |
| success | nothing on stdout | 0 |

### Behavior Rules
- A parse problem prints as `<envfile>:<line>: <message>`.
- A finding with a line prints as `<envfile>:<line>: <KEY>: <message>`; a missing key prints as
  `<envfile>: <KEY>: <message>`.
- Items print in line order; missing keys follow, in schema order.

### Error States

| Condition | Message | Action |
|---|---|---|
| no `--schema`, or no env file argument | usage line | exit 2 |
| env file does not exist / cannot be read | names the env file | exit 2 |
| schema file missing or not valid JSON | names the schema file | exit 2 |
