---
schema_version: 1
doc_type: contract
feature: envlint
engine: rules
---

# Contract — `lib/rules.mjs`

## `checkRules({ pairs, problems }, schema): { findings: Finding[], checked: number, ok: boolean }`

**Request**
```ts
pairs: Map<string, { key: string, value: string, line: number }>   // from lib/parse.mjs
problems: Array<{ line: number, rawText: string }>                 // from lib/parse.mjs
schema: Record<string, { required?: boolean, type?: "string"|"int"|"bool"|"url", enum?: string[] }>
```
Pure: data in, findings out. No file I/O, no argv knowledge.

**Response**
```ts
{
  findings: Array<{ key: string, line: number, message: string }>,
  checked: number,   // = Object.keys(schema).length — the schema-key count (discovered-seed.md item 3)
  ok: boolean         // findings.length === 0
}
```

**Rule evaluation, in order**
1. Every entry in `problems` becomes a finding: `message = "not a KEY=VALUE assignment"`,
   `key = ""` (E4 — the CLI renders `<file>:<line>: <truncated line>: not a KEY=VALUE assignment`;
   Rules supplies the line/rawText, CLI does the truncation-and-render since truncation is a
   rendering concern, not a data concern — see TS-INV-05 for the open truncation-semantics
   question from `discovered-seed.md` item 1).
2. For each `key` in `schema` with `required: true` absent from `pairs` → finding, `line: 0`
   (EXPECTED.md: "Line is 0 for a finding with no line").
3. For each `key` present in both `pairs` and `schema`, apply `type`/`enum` from `SchemaKeyRule`
   against `pairs.get(key).value`, using the winning (last) value only (duplicate-key resolution
   already happened in Parsing — resolves `discovered-seed.md` item 4: type/enum checks run only
   against the last-assignment value).
4. A key in `pairs` but not in `schema` → no finding (EXPECTED.md, Schema format).

**Type checks** (exact regex/parse rules, verified in `spike-parsing-type-rules.md`)
- `int`: `/^-?\d+$/` — `"01"` passes, `"1.5"`/`"1e3"`/`""` fail.
- `bool`: `/^(true|false|1|0)$/i`.
- `url`: `new URL(value)` succeeds **and** `.protocol` is `http:` or `https:` (try/catch AND
  explicit protocol allow-list — neither alone is sufficient).
- `string`: always passes, including empty.
- `enum`: exact string match against the listed values.
- An empty value (`KEY=`) satisfies `string`; fails `int`/`bool`/`url`/`enum`.

**Errors**: none — this function never throws.
