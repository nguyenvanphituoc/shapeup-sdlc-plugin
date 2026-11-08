---
type: task
feature: envlint
id: TASK-003
title: "Implement the envlint CLI composition root"
package: bin
status: done
priority: 2
depends_on: [TASK-001, TASK-002]
unlocks: [TASK-004]
use_case_refs: [UC-03]
entities: []
repositories: []
linked_docs: [ux-behavior, usecases/UC-03-lint-env-file]
estimated_hours: 3
tags: [FEAT, cli]
files: [bin/envlint.mjs, package.json]
---

# TASK-003: Implement the envlint CLI composition root

## Context
Wires `parseEnv` and `checkSchema`/`checkPairs` into the terminal contract. Reference: [[ux-behavior]] / [[usecases/UC-03-lint-env-file#Steps]].

## Acceptance Criteria

### ✅ Baseline
- [ ] `bin/envlint.mjs` exists with a `#!/usr/bin/env node` shebang, imports `../src/parse.mjs` and `../src/rules.mjs` (covers: REQ-21, REQ-24)
- [ ] `package.json` gains `"bin": {"envlint": "bin/envlint.mjs"}`, every other field unchanged (covers: REQ-21)
- [ ] Argument handling uses strict `parseArgs`: exactly one `--schema <path>` and one positional, else exit 2 with `envlint: …` and the usage line (covers: REQ-8, REQ-21)
- [ ] No default env path and no default schema path anywhere in the code (covers: REQ-9, REQ-27)
- [ ] Every read/parse error maps to one `envlint: …` stderr line and exit 2; the whole main is guarded so nothing prints a stack trace (covers: REQ-7)
- [ ] Output lines and order exactly per [[ux-behavior#Output lines (findings state)]], no ANSI escapes, no stdin read (covers: REQ-2, REQ-28, REQ-29)
- [ ] No `writeFile`, `appendFile`, network module or `fetch` in `bin/` or `src/` (covers: REQ-25, REQ-30)
