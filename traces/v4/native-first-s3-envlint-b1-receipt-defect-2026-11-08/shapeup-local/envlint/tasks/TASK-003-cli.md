---
type: task
feature: envlint
id: TASK-003
title: "Build the envlint CLI in bin/envlint.mjs and wire package.json"
lens: lite
package: bin
status: done
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-LintEnvFile]
entities: [EnvFile, Schema, Finding]
repositories: []
linked_docs: ["[[usecases/UC-LintEnvFile]]", "[[ux-behavior#Screen: TerminalOutput]]"]
estimated_hours: 3
tags: [cli]
completed_at: 2026-11-07
eval_verdict: fail
eval_at: 2026-11-07
---

# TASK-003: Build the envlint CLI in bin/envlint.mjs and wire package.json

## Context
Implements [[usecases/UC-LintEnvFile#Steps]] and the output contract in [[ux-behavior#Screen: TerminalOutput]].
`bin/envlint.mjs` is the composition root: it imports `parse` from `src/parse.mjs` and
`validateSchema`/`evaluate` from `src/rules.mjs`. `package.json` gets `"name": "envlint"` and
`"bin": {"envlint": "bin/envlint.mjs"}`.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `node --check bin/envlint.mjs` exits 0; `bin/envlint.mjs` starts with `#!/usr/bin/env node`
- [x] `node bin/envlint.mjs --schema <schema.json> <envfile>` reads exactly those two paths; `--schema` may come before or after the envfile (covers: REQ-1, REQ-8, REQ-23)
- [x] With no envfile argument it exits 2 with the usage line and never reads `./.env` (covers: REQ-9)
- [x] Output lines follow RULE-01/RULE-02 exactly: line-numbered items ascending, then missing-required in schema order (covers: REQ-2)
- [x] Exit 0 with no output when clean, 1 on any problem or finding, 2 on usage/read/schema errors (covers: REQ-3)
- [x] A missing envfile and a missing schema each exit 2 with `envlint: cannot read <path>` on stderr (covers: REQ-4)
- [x] A schema that is not JSON, or fails `validateSchema`, exits 2 with `envlint: invalid schema <path>: <reason>` (covers: REQ-5)
- [x] An empty or comment-only envfile is judged normally (exit 0 if nothing is required) (covers: REQ-6)
- [x] No input produces a stack trace: every unexpected error is caught and reported as one `envlint:` line with exit 2 (covers: REQ-7)
- [x] `package.json` has `"name": "envlint"`, `"bin": {"envlint": "bin/envlint.mjs"}`, and keeps `"type": "module"` and `"scripts.test": "node --test"` (covers: REQ-23)

### 🔁 Inverse Conditions
- [x] Nothing is written to stderr when the run produced findings or was clean; nothing to stdout on exit 2
- [ ] Output contains no `\x1b[` and the CLI never reads stdin (covers: REQ-29)

### 🧪 BDD Scenarios

**Scenario: a broken env file fails CI**
Given `bad.env` = `PORT=abc` / `BAD LINE` and `s.json` = `{"PORT":{"type":"int"},"HOST":{"required":true}}`
When  `node bin/envlint.mjs --schema s.json bad.env` runs
Then  stdout is the three lines in [[usecases/UC-LintEnvFile#Test Surface]] TS-ERR-FINDINGS and the exit code is 1

**Scenario: a missing file is reported, not crashed on**
Given `nope.env` does not exist
When  `node bin/envlint.mjs --schema s.json nope.env` runs
Then  stderr is `envlint: cannot read nope.env` and the exit code is 2

## Non-Go (not in this task)
- Writing any file (covers nothing new; see REQ-26 in TASK-004), interpolation, loading into `process.env`.
- Colors, `--fix`, `--json`, watch mode.


## Execution Log — 2026-11-07 (envlint/cli-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `node --check bin/envlint.mjs` exits 0; `bin/envlint.mjs` starts with `#!/usr/bin/env node`: pass (node --check bin/envlint.mjs -> exit 0; first line of bin/envlint.mjs is `#!/usr/bin/env node`; the `node --check` fixture is green in T0 r1-a1 trial 3 (2/2))
- `node bin/envlint.mjs --schema <schema.json> <envfile>` reads exactly those two paths; `--schema` may come before or after the envfile (covers: REQ-1, REQ-8, REQ-23): pass (test/cli.test.mjs TS-ERR-FINDINGS runs `--schema s envfile` and `envfile --schema s`: identical stdout, exit 1; TS-INV-02 shows the cwd's own .env is never read)
- With no envfile argument it exits 2 with the usage line and never reads `./.env` (covers: REQ-9): pass (TS-ERR-USAGE and TS-INV-02 (no-args and `--schema s` runs in a cwd holding a sentinel .env): exit 2, stderr is exactly the usage line, sentinel never in output)
- Output lines follow RULE-01/RULE-02 exactly: line-numbered items ascending, then missing-required in schema order (covers: REQ-2): pass (TS-ERR-FINDINGS: stdout is exactly `<f>:1: PORT: expected int, got "abc"`, `<f>:2: parse error: expected KEY=value`, `<f>: HOST: required key is missing`)
- Exit 0 with no output when clean, 1 on any problem or finding, 2 on usage/read/schema errors (covers: REQ-3): pass (TS-REQ-clean -> {code:0, stdout:'', stderr:''}; TS-ERR-FINDINGS -> 1; TS-ERR-USAGE / READ_FAILED / SCHEMA_INVALID -> 2)
- A missing envfile and a missing schema each exit 2 with `envlint: cannot read <path>` on stderr (covers: REQ-4): pass (TS-ERR-READ_FAILED: a missing envfile and a missing schema each give exit 2 and stderr `envlint: cannot read <that path>`, with empty stdout)
- A schema that is not JSON, or fails `validateSchema`, exits 2 with `envlint: invalid schema <path>: <reason>` (covers: REQ-5): pass (TS-ERR-SCHEMA_INVALID: `{not json` and `{"A":{"type":"float"}}` each give exit 2, stderr starting `envlint: invalid schema <path>: `; TS-INV-01 does the same for schema `[]`)
- An empty or comment-only envfile is judged normally (exit 0 if nothing is required) (covers: REQ-6): pass (TS-REQ-no-assignments: empty and comment-only files give exit 0 with no output when nothing is required, and exit 1 with one `<f>: A: required key is missing` line otherwise)
- No input produces a stack trace: every unexpected error is caught and reported as one `envlint:` line with exit 2 (covers: REQ-7): pass (TS-INV-01: garbage-bytes envfile, schema `[]`, schema `"x"`, directory envfile -> exit in {1,2}, stderr has no `at ` frame and no `Error:`; main() wrapped in try/catch writing one `envlint:` line with exitCode 2)
- `package.json` has `"name": "envlint"`, `"bin": {"envlint": "bin/envlint.mjs"}`, and keeps `"type": "module"` and `"scripts.test": "node --test"` (covers: REQ-23): pass (package.json = {"name":"envlint","version":"0.0.0","type":"module","bin":{"envlint":"bin/envlint.mjs"},"scripts":{"test":"node --test"}})
- Nothing is written to stderr when the run produced findings or was clean; nothing to stdout on exit 2: pass (TS-ERR-FINDINGS / TS-REQ-clean / TS-REQ-no-assignments assert stderr === '' on exit 0/1; TS-ERR-USAGE / READ_FAILED / SCHEMA_INVALID assert stdout === '' on exit 2)
- Output contains no `\x1b[` and the CLI never reads stdin (covers: REQ-29): pass (TS-INV-03: runs spawned with stdin ignored exit promptly; no `\x1b[` in stdout/stderr of findings, usage and read-failed runs; bin/envlint.mjs never references stdin)
