---
type: repository-contract
source_type: be-service
feature: "envlint"
repository: "cli"
service: "bin/envlint.mjs (entry point)"
status: confirmed
---

# Command Contract — `envlint` (`bin/envlint.mjs`)

## Source Type: process — the only module that does I/O; the sole importer of parse and rules

## Invocation

```
node bin/envlint.mjs --schema <schema.json> <envfile>
```

| Argument | Validation | Notes |
|---|---|---|
| `--schema <path>` | required, exactly once | path to the JSON schema |
| `<envfile>` | required, exactly one positional | path to the `.env` file; never defaulted, no lookup of `./.env` |

Argument order may vary (`<envfile> --schema <path>` is accepted). Any other argument is a usage error.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | parsed cleanly and no findings |
| 1 | at least one parse problem or finding |
| 2 | usage error, unreadable file, invalid-JSON or invalid schema |

## Output
Formats are those of [[ux-behavior#Screen: TerminalOutput]]: items on stdout for exit 0/1, one
`envlint: …` line on stderr for exit 2. No stack trace in any case; an unexpected internal error is
also reported as one `envlint: …` line with exit 2.

## Error Responses

| Exit | Code | Meaning | UX Action |
|---|---|---|---|
| 2 | USAGE | missing/extra/unknown arguments | print usage line |
| 2 | ENV_UNREADABLE | env file missing or unreadable | `envlint: cannot read <path>: <reason>` |
| 2 | SCHEMA_UNREADABLE | schema file missing or unreadable | `envlint: cannot read <path>: <reason>` |
| 2 | SCHEMA_INVALID | schema not JSON, or `validateSchema` returned defects | `envlint: invalid schema <path>: <reason>` |
