---
schema_version: 1
doc_type: ux-behavior
feature: envlint
lens: standard
---

# UX behavior — envlint

`envlint` has no interactive UI (no-go: "no colors, no TUI, no interactive prompts" —
`intake.md`). "UX" here is the CLI's observable state machine: what it prints, to which stream,
and what it exits with, for every reachable state.

## State table

| State | Trigger | stdout | stderr | Exit |
|---|---|---|---|---|
| **missing-schema-flag** | `--schema` not given | — | `Error: ...` | 2 |
| **env-unreadable** | env file missing/unreadable | — | `Error: cannot read env file: <path>` | 2 |
| **schema-unreadable** | schema file missing/unreadable | — | `Error: cannot read env file: <path>` (schema path, same prefix pattern) | 2 |
| **schema-invalid-json** | schema file not valid JSON | — | `Error: schema is not valid JSON: <path>` | 2 |
| **clean** | 0 findings, human mode | `ok: N keys checked` | — | 0 |
| **clean-json** | 0 findings, `--json` | `{"ok":true,"findings":[],"checked":N}` | — | 0 |
| **findings** | ≥1 finding, human mode | one `<envfile>:<line>: <KEY>: <message>` line per finding + `N problem(s)` | — | 1 |
| **findings-json** | ≥1 finding, `--json` | `{"ok":false,"findings":[...],"checked":N}` | — | 1 |
| **empty-file** | zero assignments (E3) | every `required` key reported missing (same shape as `findings`), never `ok` | — | 1 |

## Error cases (message + action)

| Case | Condition | Message | User action |
|---|---|---|---|
| E1 | env file path does not exist / unreadable | `Error: cannot read env file: <path>` | fix the path or file permissions |
| E1-schema | schema file path does not exist / unreadable | `Error: cannot read env file: <path>` pattern applied to the schema path | fix the path |
| E2 | schema file content is not valid JSON | `Error: schema is not valid JSON: <path>` | fix the schema file |
| missing-flag | `--schema` omitted | `Error: ...` (no implicit `.env` lookup — pitch constraint) | pass `--schema <path>` |
| E4 | a line is not `KEY=VALUE`, comment, or blank | `<file>:<line>: <line text truncated to 30 chars>: not a KEY=VALUE assignment` | fix the line |

All error text is a single message line, never a stack trace (no-go, EXPECTED.md).

## ASCII flow

```
argv ─▶ has --schema? ──no──▶ [missing-schema-flag] exit 2
   │yes
   ▼
read envfile ──fail──▶ [env-unreadable] exit 2
   │ok
   ▼
read schema  ──fail──▶ [schema-unreadable] exit 2
   │ok
   ▼
parse schema JSON ──invalid──▶ [schema-invalid-json] exit 2
   │ok
   ▼
parse envfile (lib/parse.mjs) ──▶ {pairs, problems}
   ▼
validate (lib/rules.mjs) {pairs, schema} + problems→findings ──▶ {findings, checked}
   ▼
render (human | --json) ──▶ stdout
   ▼
findings.length === 0 ? exit 0 : exit 1
```
