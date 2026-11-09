---
type: ux-behavior
feature: envlint
status: draft
---

# UX behavior — envlint CLI

The deliverable has no browser and no breadboard: there are no Places and no interactive UI affordances. Its
only surface is the command line, specified here so it can be asserted on (no colors, no TUI, no prompts).

**Deferred Places:** none (no breadboard).

## Invocation

```
envlint --schema <schema.json> <envfile>
```

Both paths are required and are the only files read. No implicit `.env` lookup.

## State table — one invocation

| State | Trigger | stdout | stderr | exit |
|---|---|---|---|---|
| success | env file parses and every rule holds | nothing | nothing | 0 |
| findings | ≥ 1 parse problem or rule violation | one line per finding | nothing | 1 |
| usage error | `--schema` missing, env path missing, or unknown argument | nothing | `envlint: error: <usage message>` | 2 |
| I/O error | env file missing/unreadable | nothing | `envlint: error: cannot read env file <path>` | 2 |
| schema error | schema missing/unreadable, not valid JSON, or not an object | nothing | `envlint: error: cannot read schema <path>` or `envlint: error: invalid schema <path>` | 2 |

## Finding line format

```
<envfile>:<line>: <message>          # a finding tied to a line (parse problem, type, enum)
<envfile>: <KEY>: <message>          # a finding with no line (missing required key)
```

Parse problems come first in line order, then rule findings in schema key order. No stack trace is ever printed
for any input.
