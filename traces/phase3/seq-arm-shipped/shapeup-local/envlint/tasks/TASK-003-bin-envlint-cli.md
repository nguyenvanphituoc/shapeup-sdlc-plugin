---
schema_version: 1
doc_type: task
feature: envlint
id: TASK-003
title: Implement bin/envlint.mjs CLI
use_case_refs: [UC-03-run-cli-lint]
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
estimated_hours: 4
status: done
completed_at: 2026-08-17
---

# TASK-003 — Implement `bin/envlint.mjs`

Implement the argv dispatcher per [[../usecases/UC-03-run-cli-lint|UC-03]] and
[[../ux-behavior|ux-behavior]]. Calls `lib/parse.mjs::parseEnv` and
`lib/rules.mjs::checkRules` only — no re-implementation of parsing/rule logic in this file.

## Acceptance Criteria
- [x] `node --test test/cli.test.mjs` passes (drives the built binary via child_process or
      direct module import, per EXPECTED.md Verification).
- [x] `--schema` missing → stderr `Error: ...`, exit 2, no stack trace.
- [x] env file missing/unreadable → stderr `Error: cannot read env file: <path>`, exit 2.
- [x] schema file missing/unreadable → stderr error pattern, exit 2.
- [x] schema file not valid JSON → stderr `Error: schema is not valid JSON: <path>`, exit 2.
- [x] zero-assignment env file → every `required` key reported missing, exit 1, no `ok` line.
- [x] malformed line (E4) → `<envfile>:<line>: <line text truncated to 30 chars>: not a KEY=VALUE assignment`, exit 1.
- [x] `--json` prints exactly one JSON document `{"ok":bool,"findings":[...],"checked":N}`,
      nothing else on stdout; exit code unchanged by `--json`.
- [x] 0 findings, human mode → `ok: N keys checked`, exit 0.
- [x] ≥1 finding, human mode → one line per finding + `N problem(s)` trailer, exit 1.
- [x] finding with no source line renders `line` as `0`.
- [x] no network call made at any point.
- [x] top-level try/catch wraps file reads AND the UC-01/UC-02 calls (integration.md
      silent-failure risk) so any unexpected throw still renders as `Error: ...`, never a stack trace.

## 🔁 Inverse Conditions
- `--json` present vs. absent → same exit code, different stdout shape (never diverge on exit code).
- 0 findings vs. ≥1 finding → `ok`/exit-0 branch vs. findings/exit-1 branch, mutually exclusive.

## 📭 Empty & Null States
- Zero-assignment env file (E3) — see AC above; must not print `ok`.
- Empty schema (`{}`) — no findings possible from schema keys; only E4 parse-problem findings can occur.

## 🧪 BDD Scenarios
```gherkin
Feature: envlint CLI
  Scenario: clean file exits 0
    Given a schema requiring PORT:int and an envfile with PORT=8080
    When I run envlint --schema schema.json envfile
    Then exit code is 0
    And stdout is "ok: 1 keys checked"

  Scenario: missing required key exits 1
    Given a schema requiring PORT:int and an empty envfile
    When I run envlint --schema schema.json envfile
    Then exit code is 1
    And stdout contains "PORT"

  Scenario: unreadable env file exits 2
    Given a schema file and a non-existent envfile path
    When I run envlint --schema schema.json missing.env
    Then exit code is 2
    And stderr is "Error: cannot read env file: missing.env"

  Scenario: --json emits one JSON document
    Given a schema and an envfile with one finding
    When I run envlint --schema schema.json --json envfile
    Then stdout is exactly one JSON document matching {"ok":false,"findings":[...],"checked":N}
```

## 🔗 Integration Flow
argv → fs reads (env + schema) → `lib/parse.mjs` (UC-01) → `lib/rules.mjs` (UC-02) → render →
`process.exit`. Verify the full chain end-to-end against real fixture files on disk (not mocks)
per EXPECTED.md's "must be pointed at a fixture" constraint.

## Test Surface covered
TS-UC03-01 … TS-UC03-12 (full — see [[../usecases/UC-03-run-cli-lint|UC-03]] Test Surface).


## Execution Log — 2026-08-17 (envlint/cli-pipeline-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node --test test/cli.test.mjs` passes (drives the built binary via child_process or
      direct module import, per EXPECTED.md Verification).: pass (node --test test/cli.test.mjs → 11/11 pass)
- `--schema` missing → stderr `Error: ...`, exit 2, no stack trace.: pass (cli-missing-schema-flag test → exit 2, stderr matches /^Error: /, no `at ` stack frame)
- env file missing/unreadable → stderr `Error: cannot read env file: <path>`, exit 2.: pass (cli-env-unreadable test → stderr exactly `Error: cannot read env file: <path>`, exit 2)
- schema file missing/unreadable → stderr error pattern, exit 2.: pass (cli-schema-unreadable test → stderr matches /^Error: /, exit 2)
- schema file not valid JSON → stderr `Error: schema is not valid JSON: <path>`, exit 2.: pass (cli-schema-invalid-json test → stderr exactly `Error: schema is not valid JSON: <path>`, exit 2)
- zero-assignment env file → every `required` key reported missing, exit 1, no `ok` line.: pass (cli-empty-file-e3 test → stdout contains PORT and HOST, no `ok:` line, exit 1)
- malformed line (E4) → `<envfile>:<line>: <line text truncated to 30 chars>: not a KEY=VALUE assignment`, exit 1.: pass (cli-malformed-line-e4 test → first stdout line matches `<envfile>:1: <30-char text>: not a KEY=VALUE assignment`, exit 1)
- `--json` prints exactly one JSON document `{"ok":bool,"findings":[...],"checked":N}`,: pass (cli-clean-json and cli-findings-json tests → JSON.parse(stdout) succeeds, single line, shape matches)
- 0 findings, human mode → `ok: N keys checked`, exit 0.: pass (cli-clean-human test → stdout `ok: 1 keys checked`, exit 0)
- ≥1 finding, human mode → one line per finding + `N problem(s)` trailer, exit 1.: pass (cli-findings-human test → one finding line + `1 problem(s)` trailer, exit 1)
- finding with no source line renders `line` as `0`.: pass ('finding with no source line renders line as 0' test → doc.findings[0].line === 0)
- no network call made at any point.: pass ('no network access occurs during a run' integration test → url check against unresolvable host completes <5s, no fetch/http calls in bin/envlint.mjs)
- top-level try/catch wraps file reads AND the UC-01/UC-02 calls (integration.md
      silent-failure risk) so any unexpected throw still renders as `Error: ...`, never a stack trace.: pass (bin/envlint.mjs: single try/catch in main() around both fs reads and the parseEnv/checkRules calls; top-level catch in the IIFE-less entry renders `Error: ${err.message}` and exit 2)
