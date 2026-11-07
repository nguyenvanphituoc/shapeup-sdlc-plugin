---
type: contract
feature: envlint
bounded_context: env-validation
usecases: [UC-ParseEnvText, UC-EvaluateRules, UC-LintEnvFile]
tags: [contract]
depends_on: ["[[domain-model]]"]
status: ready
---

# Contract — envlint

The planner fixed every detail the pitch left open. Each one is marked *(spec decision)* so the PO can
overturn it at Board Review.

## 1. `parseEnv(text) → { pairs, problems }` (`src/parse.mjs`)

Line rules. Lines are split on `\n`, with a trailing `\r` stripped, and numbered from 1:

| Line form | Result |
|---|---|
| empty or whitespace only | ignored |
| first non-space char is `#` | ignored (comment) |
| `KEY=value` | Pair; key and unquoted value trimmed of surrounding whitespace |
| `export KEY=value` | Pair, `export ` prefix dropped |
| `KEY="value"` / `KEY='value'` | Pair; matching surrounding quotes removed, inner text verbatim (no escape processing, no interpolation) *(spec decision)* |
| no `=` | ParseProblem `missing '='` |
| key not matching `^[A-Za-z_][A-Za-z0-9_]*$` | ParseProblem `invalid key` |
| value opens a quote that is not closed at end of line | ParseProblem `unterminated quote` |

- `KEY=` gives a Pair with the empty value `""`.
- Duplicate keys are all kept in `pairs`, in file order. The rules use the last occurrence *(spec decision)*.
- No input string makes the function throw. Text with no assignments returns `{ pairs: [], problems: [] }`.

## 2. Schema shape (JSON file)

```json
{ "PORT": { "required": true, "type": "int" },
  "MODE": { "enum": ["dev", "prod"] },
  "API_URL": { "type": "url" } }
```

- The top level must be a JSON object. Each value must be an object whose only fields are among
  `required` (boolean), `type` (one of `string`, `int`, `bool`, `url`) and `enum` (an array of strings).
  Anything else is a schema error.
- Keys present in the env file but absent from the schema are not reported *(spec decision)*.

## 3. `checkRules(pairs, schema) → { findings, schemaErrors }` (`src/rules.mjs`)

| Rule | Passes when | Finding message |
|---|---|---|
| `required` | the key occurs in `pairs` (an empty value counts as present) | `required key is missing` |
| `type: string` | always | — |
| `type: int` | value matches `^-?[0-9]+$` *(spec decision)* | `expected int, got "<value>"` |
| `type: bool` | value is exactly `true` or `false` *(spec decision)* | `expected bool, got "<value>"` |
| `type: url` | value contains `://`, `new URL(value)` succeeds and its `host` is non-empty, with no network access *(spec decision, orient spike)* | `expected url, got "<value>"` |
| `enum` | value is one of the listed strings | `expected one of a\|b, got "<value>"` |

- `type` and `enum` are checked only for keys that are present.
- A non-empty `schemaErrors` means `findings` is `[]`. Neither function throws.

## 4. CLI — `envlint --schema <schema.json> <envfile>` (`bin/envlint.mjs`)

Exit codes *(spec decision)*:

| Code | When |
|---|---|
| 0 | no parse problems and no findings |
| 1 | at least one parse problem or finding |
| 2 | usage error (missing `--schema`, missing/extra positional, unknown option), env file missing or unreadable, schema missing or unreadable, schema not valid JSON, schema shape invalid |

Output *(spec decision)*:
- Findings and parse problems go to **stdout**, one per line, in line order, with problems first on a tie:
  - `<envfile>:<line>: <message>` for a parse problem
  - `<envfile>:<line>: <KEY>: <message>` for a finding with a line
  - `<envfile>: <KEY>: <message>` for a missing required key
- Exit-2 errors go to **stderr** as `envlint: <message>`. The message names the offending file path where
  there is one; usage errors are followed by the line `usage: envlint --schema <schema.json> <envfile>`.
- No ANSI escape codes, no prompts, no stack trace on any input.
- The tool reads only the two paths it is given. It never reads `./.env` implicitly and never writes a file.
