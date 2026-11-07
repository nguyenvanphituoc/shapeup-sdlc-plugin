---
type: repository-contract
source_type: be-service
feature: "envlint"
repository: "parse"
service: "src/parse.mjs (pure module)"
status: confirmed
---

# Module Contract — parse (`src/parse.mjs`)

## Source Type: pure module — no I/O, imports nothing from `src/rules.mjs`

## Method: parse

### Request

| Field | Type | Validation | Source | Notes |
|-------|------|-----------|--------|-------|
| text | string | required | UC-ParseEnvText.input.text | whole file contents; `\n` or `\r\n` line endings |

### Response

| Field | Type | Invariant | Used By |
|-------|------|-----------|---------|
| pairs | `{key, value, line}[]` | file order; duplicates kept; `line` 1-based | [[contracts/rules.contract]] `lint` |
| problems | `{line, message}[]` | ascending `line`; one per unparseable line | CLI output |

### Line grammar

| Line (after trimming surrounding whitespace) | Result |
|---|---|
| empty | ignored |
| starts with `#` | comment, ignored |
| `export ` prefix | stripped, then parsed as an assignment |
| `KEY=value` where KEY matches `[A-Za-z_][A-Za-z0-9_]*` | pair; unquoted value is the text after the first `=`, trimmed |
| value starting with `"` or `'` | quoted: value is the text up to the matching closing quote of the same kind; after it only whitespace or a `#…` comment may follow |
| no `=`, an invalid KEY, an unterminated quote, or text after a closing quote | problem at that line |

### Error Responses
`parse` never throws for any string input. Non-string input is a programming error outside this
contract.
