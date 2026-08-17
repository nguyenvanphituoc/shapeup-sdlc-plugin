---
type: task
feature: envlint
id: TASK-003
title: "Create CLI composition root (bin/envlint.mjs)"
lens: standard
package: bin
status: done
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-01]
entities: []
repositories: []
linked_docs: ["[[usecases/UC-01]]", "[[ux-behavior]]"]
estimated_hours: 4
tags: [cli, composition-root]
completed_at: 2026-08-17
---

# TASK-003: Create CLI composition root (bin/envlint.mjs)

## Context
The only piece that imports both engines: argv parsing, the two `fs.readFileSync` calls,
wiring `parseEnv` → `evaluate`, rendering (human/`--json`), and setting the exit code.
Reference: [[usecases/UC-01]] full Steps/Output/Error Cases, and [[ux-behavior]]
for the exact per-mode text.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `bin/envlint.mjs` is the `package.json` `bin.envlint` entry, invocable as
      `envlint --schema <schema.json> [--json] <envfile>`
- [x] `node --test test/cli.test.mjs` passes (drives the built binary via `child_process`, per
      idea.md's "a harness run is graded by driving this binary")
- [x] Missing `--schema` → exit 2, stderr `Error: ` prefix, single line
- [x] Unreadable/missing schema file → exit 2, stderr `Error: cannot read schema file: <path>`
- [x] Schema file is not valid JSON → exit 2, stderr `Error: schema is not valid JSON: <path>`
- [x] Unreadable/missing env file → exit 2, stderr `Error: cannot read env file: <path>`
- [x] No findings → stdout `ok: N keys checked` (N = `Object.keys(schema).length`), exit 0
- [x] ≥1 finding → stdout one line per finding `<envfile>:<line>: <KEY>: <message>` (in file
      order) then `N problem(s)`, exit 1
- [x] `--json` on the clean branch → stdout exactly `{"ok":true,"findings":[],"checked":N}`,
      nothing else on stdout, exit 0
- [x] `--json` on the findings branch → stdout exactly one JSON document
      `{"ok":false,"findings":[...],"checked":N}`, nothing else on stdout, exit 1
- [x] `--json` never changes the exit code or which branch (error/clean/findings) is taken
- [x] No exit-2 path ever prints a raw stack trace to stderr or anything to stdout

### 🧪 BDD Scenarios

**Scenario: clean env file against its schema**
Given a `.env` fixture where every schema-required key is present and valid
When  `envlint --schema schema.json .env` is run
Then  the process exits 0 and stdout is exactly `ok: N keys checked`

**Scenario: env file missing a required key**
Given a `.env` fixture missing a key the schema marks `required: true`
When  `envlint --schema schema.json .env` is run
Then  the process exits 1 and stdout includes a finding for that key at line `0`

**Scenario: unreadable env file is a tool error, not a crash**
Given an `--envfile` path that does not exist on disk
When  `envlint --schema schema.json /no/such/file` is run
Then  the process exits 2, stderr starts with `Error: cannot read env file:`, and stdout is empty

### 🔗 Integration Flow

**bin/envlint.mjs → src/parsing.mjs → src/rules.mjs**
Given both input files were read successfully
When  the CLI calls `parseEnv(envText)` and feeds its result into `evaluate(pairs, problems, schema)`
Then  the CLI receives a `Finding[]` and composes `{ ok, findings, checked }` from it
And   renders exactly one of the two output modes and sets `process.exitCode` accordingly — no
      engine call result is ever discarded or re-derived by the CLI itself

## Implementation Notes
`checked` = `Object.keys(schema).length`, computed once after the schema JSON.parse succeeds —
independent of how many keys the env file itself defines.

## Non-Go (not in this task)
- No parsing logic, no rule logic — both live in TASK-001/TASK-002; this task only wires and
  renders their output.
- No `.env` writing, no `${VAR}` interpolation, no network calls (pitch no-gos).


## Execution Log — 2026-08-17 (envlint/cli-composition-root-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `bin/envlint.mjs` is the `package.json` `bin.envlint` entry, invocable as: pass (package.json bin.envlint already pointed at ./bin/envlint.mjs; bin/envlint.mjs created and invoked as `envlint --schema <schema.json> [--json] <envfile>`)
- `node --test test/cli.test.mjs` passes (drives the built binary via `child_process`, per: pass (node --test test/cli.test.mjs -> tests 11, pass 11, fail 0)
- Missing `--schema` → exit 2, stderr `Error: ` prefix, single line: pass (test 'missing --schema -> exit 2, stderr Error prefix, single line' passes)
- Unreadable/missing schema file → exit 2, stderr `Error: cannot read schema file: <path>`: pass (test 'unreadable schema file -> exit 2, specific stderr message' passes)
- Schema file is not valid JSON → exit 2, stderr `Error: schema is not valid JSON: <path>`: pass (test 'schema file not valid JSON -> exit 2, specific stderr message' passes)
- Unreadable/missing env file → exit 2, stderr `Error: cannot read env file: <path>`: pass (test 'unreadable env file -> exit 2, tool error, empty stdout' passes)
- No findings → stdout `ok: N keys checked` (N = `Object.keys(schema).length`), exit 0: pass (test 'clean env file against its schema -> exit 0, ok summary' passes)
- ≥1 finding → stdout one line per finding `<envfile>:<line>: <KEY>: <message>` (in file: pass (test '>=1 finding -> stdout one line per finding then N problem(s), exit 1' passes)
- `--json` on the clean branch → stdout exactly `{"ok":true,"findings":[],"checked":N}`,: pass (test '--json on the clean branch -> exact JSON doc, exit 0' passes)
- `--json` on the findings branch → stdout exactly one JSON document: pass (test '--json on the findings branch -> exact JSON doc, exit 1' passes)
- `--json` never changes the exit code or which branch (error/clean/findings) is taken: pass (test '--json never changes exit code or which branch is taken' passes)
- No exit-2 path ever prints a raw stack trace to stderr or anything to stdout: pass (test 'no exit-2 path prints a raw stack trace or anything to stdout' passes)
