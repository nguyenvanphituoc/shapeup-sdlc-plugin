---
schema_version: 1
doc_type: contract
feature: envlint
engine: parsing
---

# Contract — `lib/parse.mjs`

## `parseEnv(text: string): { pairs: Map<string, EnvPair>, problems: ParseProblem[] }`

**Request**
- `text: string` — the raw env file content (already read from disk by the CLI; this function
  does no I/O — pure text in).

**Response**
```ts
{
  pairs: Map<string, { key: string, value: string, line: number }>,
  problems: Array<{ line: number, rawText: string }>
}
```
- `pairs` — last-assignment-wins: if `KEY` is assigned on lines 3 and 7, `pairs.get("KEY").line === 7`
  and line 3 produces no entry anywhere (not in `pairs`, not in `problems`).
- `problems` — one entry per line that is not a comment (`#...`), not blank, and does not match
  `KEY=VALUE` / `export KEY=VALUE`. 1-based line numbers.
- Quote-stripping: `KEY="value"` / `KEY='value'` → `value` only when both quote chars are present
  (matching pair). `KEY="value` (unterminated) → value stays `"value` (leading quote kept).
- Whitespace around `KEY` and around the value is trimmed (outside quotes).

**Errors**
None — this function never throws. A structurally-invalid line is reported via `problems`, not
an exception (pitch: "A linter that crashes on a malformed input is worse than no linter").

**Empty input** (E3): `text` with zero assignments (empty string, or only comments/blanks) →
`{ pairs: new Map(), problems: [] }`. The "every required key reported missing" behavior is the
Rules engine's responsibility, not Parsing's — Parsing has no concept of "required".
