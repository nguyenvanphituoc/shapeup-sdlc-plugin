---
type: ux-behavior
feature: envlint
screens: []
tags: [cli]
depends_on: ["[[domain-model]]"]
status: draft
---

# UX Behaviour: envlint (CLI)

The deliverable has no screens and no interactive elements, so no use case carries an affordance manifest.
The "surface" is the process contract below; every line is plain text with no ANSI escape codes (NOGO-04).

## Invocation
`node bin/envlint.mjs --schema <schema.json> <envfile>` — `--schema` may appear before or after the env-file
argument. Exactly one env-file argument. No default for either path.

## States

| State | Trigger | stdout | stderr | Exit |
|---|---|---|---|---|
| clean | no parse problems, no findings | empty | empty (or the zero-assignment notice) | 0 |
| findings | ≥ 1 parse problem or rule finding | one line per item (format below) | empty (or the notice) | 1 |
| usage error | `--schema` missing or without a value, env-file argument missing, extra positional, unknown flag | empty | `envlint: usage: envlint --schema <schema.json> <envfile>` | 2 |
| env file unreadable | env file missing or not readable | empty | `envlint: cannot read env file <path>: <reason>` | 2 |
| schema unreadable | schema file missing or not readable | empty | `envlint: cannot read schema <path>: <reason>` | 2 |
| schema invalid JSON | `JSON.parse` fails | empty | `envlint: invalid schema <path>: <reason>` | 2 |
| schema invalid shape | `checkSchema` returns problems | empty | one `envlint: invalid schema <path>: <message>` line per problem | 2 |
| no assignments | parse yields zero pairs | per the rules | `envlint: <envfile>: no assignments found` | 0 or 1 by the rules |

No state prints a stack trace.

## Output line format (stdout)
- Parse problem: `<envfile>:<line>: parse error: <message>`
- Finding with a line: `<envfile>:<line>: <KEY>: <message>`
- Finding with no line (missing required key): `<envfile>: <KEY>: <message>`

Order: parse problems and line-bearing findings sorted by line ascending (parse problem first on a tie, then
findings in schema key order); then line-less findings in schema key order. Messages:
`missing required key` · `expected <type>, got "<value>"` · `expected one of <a>|<b>|…, got "<value>"`.
