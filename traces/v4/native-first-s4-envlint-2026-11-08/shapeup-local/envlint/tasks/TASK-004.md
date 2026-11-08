---
type: task
feature: envlint
id: TASK-004
title: "End-to-end tests driving the envlint binary against temp fixtures"
package: test
status: done
priority: 3
depends_on: [TASK-003]
unlocks: []
use_case_refs: [UC-03]
entities: []
repositories: []
linked_docs: [usecases/UC-03-lint-env-file]
estimated_hours: 2
tags: [TEST, integration]
files: [test/cli.test.mjs]
---

# TASK-004: End-to-end tests driving the envlint binary against temp fixtures

## Context
The integration-test task. Spawns `process.execPath bin/envlint.mjs …` with `spawnSync` against files
written to a fresh `fs.mkdtempSync(os.tmpdir())` directory, one probe per UC-03 Test Surface row.
Reference: [[usecases/UC-03-lint-env-file#Test Surface]].

## Acceptance Criteria

### ✅ Baseline
- [ ] `node --test test/cli.test.mjs` exits 0 and covers every UC-03 Test Surface row by id in its test names (covers: REQ-1)

### 🧪 BDD Scenarios
- [ ] Mixed violations → expected stdout lines in order, exit 1 (covers: REQ-2, REQ-3)
- [ ] Missing env file → exit 2, stderr names path + `ENOENT`, no stack trace (covers: REQ-4, REQ-7)
- [ ] Missing / non-JSON / invalid schema → exit 2 with the documented message (covers: REQ-5, REQ-7)
- [ ] Env file with no assignments → exit 0 with schema `{}`, exit 1 listing missing required keys otherwise (covers: REQ-6)
- [ ] No env positional in a cwd holding a `.env` → exit 2 usage, the `.env` is not read (covers: REQ-8, REQ-9)
- [ ] Temp cwd listing is unchanged after a run; no `\x1b` in output; `${HOME}` compared literally (covers: REQ-25, REQ-26, REQ-28, REQ-29)
