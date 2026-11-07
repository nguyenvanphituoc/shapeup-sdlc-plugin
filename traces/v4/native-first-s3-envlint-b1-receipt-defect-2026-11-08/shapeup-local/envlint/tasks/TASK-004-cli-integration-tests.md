---
type: task
feature: envlint
id: TASK-004
title: "Write the CLI integration tests in test/cli.test.mjs"
lens: lite
package: test
status: done
priority: 3
depends_on: [TASK-003]
unlocks: []
use_case_refs: [UC-LintEnvFile]
entities: []
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile#Test Surface]]"]
estimated_hours: 2
tags: [integration-test]
completed_at: 2026-11-07
---

# TASK-004: Write the CLI integration tests in test/cli.test.mjs

## Context
Spawns `node bin/envlint.mjs` against fixtures the test writes to a temp directory (`node:os` tmpdir)
and asserts exit code, stdout and stderr for every row of [[usecases/UC-LintEnvFile#Test Surface]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `node --test` at the repo root passes, including `test/cli.test.mjs` (covers: REQ-25)
- [x] One test per TS row of [[usecases/UC-LintEnvFile#Test Surface]], each named after its row id (covers: REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7)
- [x] TS-INV-02: a temp dir holding its own `.env` is byte-identical after the run and that `.env` never appears in output (covers: REQ-9, REQ-26)
- [x] TS-NOGO-01: `A=${B}` matches enum `["${B}"]`, exit 0 (covers: REQ-27, REQ-28)
- [x] TS-NOGO-02: a source scan of `bin/` and `src/` finds no file write, no `process.env` assignment and no network module or `fetch` (covers: REQ-26, REQ-28, REQ-30)
- [x] TS-INV-03: no `\x1b[` in any captured stream (covers: REQ-29)

### 🔗 Integration Flow

**Shell → CLI → parse/rules**
Given fixtures written by the test to a temp dir
When  the test spawns `node bin/envlint.mjs --schema <tmp>/s.json <tmp>/x.env`
Then  `src/parse.mjs` and `src/rules.mjs` are both exercised through the CLI
And   the test observes exit code + stdout + stderr only

## Non-Go (not in this task)
- Changing CLI behaviour (a failing row is a bug against the CLI, filed, not fixed here).


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node --test` at the repo root passes, including `test/cli.test.mjs` (covers: REQ-25): pass (node --test at repo root -> tests 42, pass 42, fail 0 (11 of them in test/cli.test.mjs); T0 r1-a1 trial 3 overall green, fixtures 2/2)
- One test per TS row of [[usecases/UC-LintEnvFile#Test Surface]], each named after its row id (covers: REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7): pass (test/cli.test.mjs has 11 tests, one per Test Surface row, each named with its row id first: TS-INV-01, TS-INV-02, TS-INV-03, TS-ERR-USAGE, TS-ERR-READ_FAILED, TS-ERR-SCHEMA_INVALID, TS-ERR-FINDINGS, TS-REQ-clean, TS-REQ-no-assignments, TS-NOGO-01, TS-NOGO-02; all pass)
- TS-INV-02: a temp dir holding its own `.env` is byte-identical after the run and that `.env` never appears in output (covers: REQ-9, REQ-26): pass (TS-INV-02 test: base64 snapshot of the temp cwd is identical before and after three runs (including no-args); the sentinel .env content appears in no output -> pass)
- TS-NOGO-01: `A=${B}` matches enum `["${B}"]`, exit 0 (covers: REQ-27, REQ-28): pass (TS-NOGO-01 test: `A=${B}` against enum ["${B}"] -> {code:0, stdout:'', stderr:''} -> pass)
- TS-NOGO-02: a source scan of `bin/` and `src/` finds no file write, no `process.env` assignment and no network module or `fetch` (covers: REQ-26, REQ-28, REQ-30): pass (TS-NOGO-02 test scans bin/*.mjs and src/*.mjs (3 files) for writeFile, appendFile, a process.env assignment, node:net, node:http, node:https and fetch( -> no match -> pass)
- TS-INV-03: no `\x1b[` in any captured stream (covers: REQ-29): pass (TS-INV-03 test: no `\x1b[` in stdout or stderr of a findings run, a usage run and a read-failed run; the other tests capture the same streams -> pass)
