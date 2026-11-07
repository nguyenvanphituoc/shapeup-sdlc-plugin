---
type: repository-contract
source_type: be-service
feature: "envlint"
repository: "rules"
service: "src/rules.mjs (pure module)"
status: confirmed
---

# Module Contract — rules (`src/rules.mjs`)

## Source Type: pure module — no I/O, imports nothing from `src/parse.mjs`

## Schema shape

A JSON object; each own key is an env key name, each value a `KeyRule`:

```json
{
  "PORT":     { "required": true, "type": "int" },
  "DEBUG":    { "type": "bool" },
  "API_URL":  { "required": true, "type": "url" },
  "LOG_LEVEL":{ "enum": ["debug", "info", "warn", "error"] }
}
```

| KeyRule field | Type | Validation |
|---|---|---|
| required | boolean | optional, default false |
| type | `"string" \| "int" \| "bool" \| "url"` | optional |
| enum | string[] | optional, non-empty array of strings |

## Method: validateSchema

| Request | Response |
|---|---|
| `schema: unknown` | `string[]` — one message per defect; `[]` means valid. Defects: schema not a plain object; a KeyRule not a plain object; `required` not boolean; `type` not one of the four; `enum` not a non-empty string array. Never throws. |

## Method: lint

### Request

| Field | Type | Validation | Source |
|-------|------|-----------|--------|
| pairs | `{key, value, line}[]` | required | [[contracts/parse.contract]] Response |
| schema | Schema | required, already valid | validateSchema |

### Response — `Finding[]`

| Field | Type | Invariant |
|-------|------|-----------|
| key | string | a schema key |
| line | integer \| null | line of the assignment judged; `null` only for `required` |
| rule | `"required" \| "type" \| "enum"` | |
| message | string | names the key and what was expected |

### Rules
- When a key appears more than once, the **last** assignment is the one judged.
- `required`: key absent from pairs → one `required` finding, `line: null`.
- `type` (only when the key is present): `string` any value; `int` matches `^-?\d+$`; `bool` is
  exactly `true` or `false`; `url` parses with `new URL()` **and** its protocol is `http:` or
  `https:` — shape only, never a network call.
- `enum` (only when present): value must equal one of the listed strings.
- A key present in pairs but absent from the schema produces no finding.
- Findings are ordered by schema key order; a key may yield both a `type` and an `enum` finding.
