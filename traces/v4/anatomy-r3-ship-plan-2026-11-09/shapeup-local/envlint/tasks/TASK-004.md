---
type: task
feature: envlint
id: TASK-004
title: "End-to-end CLI test suite over written fixtures"
package: test
status: ready
priority: 3
depends_on: [TASK-003]
unlocks: []
use_case_refs: [UC-LintEnvFile]
entities: []
repositories: []
linked_docs: ["shapeup/envlint/spec/usecases/UC-LintEnvFile.md"]
estimated_hours: 2
tags: [integration-test]
---

# TASK-004: End-to-end CLI test suite over written fixtures

## Context
The integration-test task: `test/cli.test.mjs` writes throwaway fixtures to a temp dir, spawns `node bin/envlint.mjs`, and asserts exit code, stdout and stderr for every row of [[usecases/UC-LintEnvFile#Test Surface]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `node --test test/cli.test.mjs` exits 0 and has one test per UC-LintEnvFile Test Surface row
- [ ] a binary-junk env file, an empty env file and a schema of `[]` each end with exit 0, 1 or 2 and no `at ` stack frame on stderr (covers: REQ-7)
- [ ] after a run with findings the env file bytes are unchanged and no new file appears in the fixture dir (covers: REQ-23)
- [ ] stdout never contains `\x1b[` and the process exits without stdin input (covers: REQ-26)
- [ ] the CLI leaves `process.env` of the child unchanged for keys in the env file, and `package.json` declares no dependencies (covers: REQ-25)

### 🔗 Integration Flow

**CLI → parser → rules**
Given an env file with a bad line 3, a wrong-type key on line 5, and a schema requiring a missing key
When  `node bin/envlint.mjs --schema <schema> <env>` is spawned
Then  stdout has the line-3 problem, the line-5 finding and the missing-key finding
And   the exit code is 1 (covers: REQ-2, REQ-3)

## Non-Go (not in this task)
- Unit tests of the pure modules (TASK-001, TASK-002)
