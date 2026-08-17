---
schema_version: 1
doc_type: domain-model
feature: envlint
lens: standard
---

# Domain model — envlint

## Bounded context

**`envlint` (single context).** A zero-network CLI that reads two files (an env file, a JSON
schema file) and produces a lint report. No persistence, no external services, one process
lifetime per invocation. Per `project-profile.md`, the archetype `web-service` is a structural
mapping only — `bin/envlint.mjs` plays the role of composition root/entry point the same way a
router does, dispatching to two pure engines.

## Aggregates

### `EnvDocument` (new)
The parsed representation of the env file. Built once per run by the Parsing engine.
- `pairs: EnvPair[]` — last-assignment-wins map of key → value + line number.
- `problems: ParseProblem[]` — lines that could not be parsed as `KEY=VALUE`.
- Invariant: a key appearing more than once retains only the **last** assignment; earlier
  assignments of the same key never appear in `problems` (EXPECTED.md, Parsing rules).

### `RuleSchema` (new)
The parsed JSON schema describing required keys, types, and enums. Built once per run by the
CLI from the schema file's JSON.
- `keys: Record<string, SchemaKeyRule>`.
- Invariant: a key present in `EnvDocument.pairs` but absent from `RuleSchema.keys` produces no
  finding (EXPECTED.md, Schema format).

### `LintReport` (new)
The output of the Rules engine: `EnvDocument` + `RuleSchema` → `findings[]`. Consumed by the CLI
for both human and `--json` rendering.
- `findings: Finding[]`.
- `checked: number` — count of schema keys checked (definition pinned in TS-INV-03 below;
  `discovered-seed.md` item 3 resolved here: `checked` = number of keys in `RuleSchema.keys`,
  since that is the only count both the `ok: N keys checked` message and the JSON `checked`
  field can share without depending on how many keys happen to be present in the file).
- `ok: boolean` — `findings.length === 0`.

## Value objects

- **`EnvPair`** — `{ key: string, value: string, line: number }`. Immutable, quote-stripped,
  whitespace-trimmed per the Parsing rules.
- **`ParseProblem`** — `{ line: number, rawText: string }` for a line that is not `KEY=VALUE`,
  a comment, or blank.
- **`SchemaKeyRule`** — `{ required?: boolean, type?: "string"|"int"|"bool"|"url", enum?: string[] }`.
- **`Finding`** — `{ key: string, line: number, message: string }`. `line` is `0` when the
  finding has no source line (a required key missing entirely from the file — EXPECTED.md).

## Domain events

None. `envlint` is a single-shot, stateless pipeline (`read → parse → validate → report → exit`)
with no persistence and no downstream subscribers — there is nothing for a domain event to notify.

## Repository interfaces

Two file-system reads, treated as repositories only for reachability-tracing symmetry with the
`web-service` archetype (`project-profile.md`); both are plain `fs.readFileSync` calls behind a
named seam so tasks/tests can substitute fixture paths (the pitch's core constraint: no implicit
`.env` lookup).

- **`EnvFileReader.read(path: string): string`** — throws/returns an error the CLI maps to E1.
- **`SchemaFileReader.read(path: string): object`** — throws/returns an error the CLI maps to E2
  (invalid JSON) or E1-shaped "missing" (file not found).

## Engines → the three pieces

| Engine | Owns | Imports | EXPECTED.md sections |
|---|---|---|---|
| **Parsing** (`lib/parse.mjs`) | `EnvDocument` construction | nothing else in-tree | Parsing rules, E3, E4 |
| **Rules** (`lib/rules.mjs`) | `LintReport` construction from `{pairs, schema}` | nothing else in-tree | Type rules, Schema format |
| **CLI** (`bin/envlint.mjs`) | argv, file reads, exit codes, rendering | both `lib/parse.mjs` and `lib/rules.mjs` | Interface, E1, E2, E5 |

Parsing and Rules import nothing from each other (pitch constraint, verified by `code-surface.md`
import-graph inspection once files exist — enforced again at Map Scopes as substrate
disjointness).
