---
type: domain-model
feature: envlint
lens: lite
---

# Domain model — envlint

One bounded context, **Env Validation**, with no persistence and no third party. Three modules,
matching the pitch's three pieces; the only things two of them share are the **data shapes** below
(C1–C3). No `src/` module is shared: `src/parse.mjs` and `src/rules.mjs` import nothing from each
other (or from anywhere), and only `bin/envlint.mjs` imports both.

Back to [[_index]] · use cases: [[usecases/UC-01-parse-env-text]] · [[usecases/UC-02-check-pairs-against-schema]] · [[usecases/UC-03-lint-env-file]]

## Modules

| Module | Kind | Exports | Imports |
|---|---|---|---|
| `src/parse.mjs` | pure function | `parseEnv(text)` | nothing |
| `src/rules.mjs` | pure functions | `checkSchema(schema)`, `checkPairs(pairs, schema)` | nothing (the global `URL` only) |
| `bin/envlint.mjs` | composition root | — (executable, `#!/usr/bin/env node`) | `src/parse.mjs`, `src/rules.mjs`, `node:fs`, `node:util` |

## Value objects and data contracts

These contracts are the planner's resolution of what the pitch leaves open (see
[[_index#Planning decisions]]). They are binding for every scope.

### C1 — `ParseResult` (Parsing → Rules, via the CLI)

```js
parseEnv(text: string) → {
  pairs:    Array<{ key: string, value: string, line: number }>,   // in file order, duplicates kept
  problems: Array<{ line: number, message: string }>                // in file order
}
```

Line rules, applied per physical line (1-based numbering; a leading UTF-8 BOM is stripped; lines split
on `\n` with an optional preceding `\r`):

1. A line that is empty or whitespace-only is skipped.
2. A line whose first non-whitespace character is `#` is a comment and is skipped.
3. A leading `export` followed by at least one space or tab is removed.
4. The line must contain `=`; otherwise problem `missing '='`.
5. The key is the text before the first `=`, trimmed; it must match `^[A-Za-z_][A-Za-z0-9_]*$`,
   otherwise problem `invalid key`.
6. The raw value is the text after the first `=`, trimmed.
   - Starts with `"` or `'`: it must be at least two characters and end with the same quote character;
     the value is the text between the quotes, verbatim (no escape processing). Otherwise problem
     `unterminated quote`.
   - Otherwise the raw value is the value, verbatim (`${VAR}` stays literal; no inline-comment stripping).
7. A line that yields a problem yields no pair.

### C2 — `Schema` (user file → Rules)

A JSON object whose keys are env keys and whose values are rule objects:

```json
{ "PORT": { "required": true, "type": "int" },
  "MODE": { "enum": ["dev", "prod"] },
  "API_URL": { "type": "url" } }
```

| Field | Type | Meaning |
|---|---|---|
| `required` | boolean, optional | the key must be present |
| `type` | one of `string` · `int` · `bool` · `url`, optional | the value's shape |
| `enum` | non-empty array of strings, optional | the value must equal one member exactly (case-sensitive) |

`checkSchema(schema)` returns an array of error strings (empty = valid). Invalid: the top level is not a
plain object (array, null, scalar); a rule is not a plain object; an unknown rule field; `required` not a
boolean; `type` not one of the four; `enum` not a non-empty array of strings. Env keys that the schema does
not mention are ignored.

Type predicates (shape only — never a network call):

| type | accepts |
|---|---|
| `string` | any value, including empty |
| `int` | `^-?[0-9]+$` (so `1.0`, `0x10`, `1e3`, ` 7` and the empty string are rejected) |
| `bool` | exactly `true` or `false` |
| `url` | `new URL(value)` succeeds **and** its protocol is `http:` or `https:` **and** its hostname is non-empty |

### C3 — `Finding` (Rules → CLI)

```js
checkPairs(pairs, schema) → Array<{ key: string, line: number | null, rule: "required" | "type" | "enum", message: string }>
```

- When a key occurs more than once, the **last** occurrence is checked, and its line is reported.
- A schema key with `required: true` absent from `pairs` → `{rule: "required", line: null, message: "required key is missing"}`.
- A present key: `type` failure → `message: "expected <type>, got \"<value>\""`; `enum` failure →
  `message: "expected one of <a>, <b>, …, got \"<value>\""`. Both may be reported for one key (type first).
- Order: findings with a line, ascending by line; then the `required` findings in schema key order.

The CLI's output and exit-code contract is in [[ux-behavior]].

## Domain events, repositories

None: the tool is a pure read → report pipeline with no state and no storage.
