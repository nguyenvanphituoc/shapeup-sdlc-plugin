---
type: task
feature: personal-site
id: TASK-001
title: "Create build.mjs input, validation and output pipeline"
lens: lite
package: root
status: done
priority: 1
depends_on: []
unlocks: [TASK-002, TASK-003]
use_case_refs: [UC-BuildPage]
entities: [SiteContent]
repositories: [ContentSource, PageSink]
linked_docs: ["[[usecases/UC-BuildPage]]", "[[domain-model#Value Objects]]"]
estimated_hours: 2
tags: [cli]
completed_at: 2026-11-07
---

# TASK-001: Create build.mjs input, validation and output pipeline

## Context
The composition root of the feature: resolve paths from the environment, load and validate the
content file, and write the page only after validation. Steps 1–3, 5 and 6 of
[[usecases/UC-BuildPage#Steps]]; the error table is [[usecases/UC-BuildPage#Error Cases]].

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `build.mjs` exists at the project root and imports only `node:` builtins (`grep -E "from ['\"][^n]" build.mjs` prints nothing) (covers: REQ-11)
- [x] `node build.mjs` reads `content.json` from the working directory and writes `dist/index.html`, exit 0 (covers: REQ-1)
- [x] the output is one file, `index.html`, inside the output directory, which is created when absent (covers: REQ-2)
- [x] with `CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out`, the script reads `<tmp>/c.json` and writes `<tmp>/out/index.html` and nothing else (covers: REQ-14)
- [x] `package.json` declares no `dependencies` and the script makes no network call (no `node:http`, `node:https`, `node:net`, `fetch` in `build.mjs`) (covers: REQ-11)
- [x] the content file's bytes are identical before and after a run (covers: REQ-13)

### 🔁 Inverse Conditions
- [x] `CONTENT_FILE` naming a missing file → exit 1, exactly one stderr line naming the path, no `index.html` written (covers: REQ-18)
- [x] a content file holding `{not json` → exit 1, exactly one stderr line, no `index.html` written (covers: REQ-18)
- [x] content with no `name`, `name: 42` or `name: ""` → exit 1, exactly one stderr line naming `name`, no `index.html` written (covers: REQ-19)
- [x] on every error path the output directory is not created when it did not exist (covers: REQ-18)

## Implementation Notes
- Validate fully before any `mkdirSync`/`writeFileSync`, so the error path cannot leave a partial output.
- Print `error: <message>` once with `console.error`, then `process.exit(1)`; never print a stack trace.
- Render is TASK-002's; this task may call a placeholder `render(content)` that TASK-002 replaces.

## Non-Go (not in this task)
- The HTML itself (TASK-002); the test suite (TASK-003).
- A sample `content.json` — the pitch does not ask for one; the freelancer provides it.


## Execution Log — 2026-11-07 (personal-site/site-build-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `build.mjs` exists at the project root and imports only `node:` builtins (`grep -E "from ['\"][^n]" build.mjs` prints nothing) (covers: REQ-11): pass (grep -E "from ['"][^n]" build.mjs prints nothing; imports are node:fs and node:path only)
- `node build.mjs` reads `content.json` from the working directory and writes `dist/index.html`, exit 0 (covers: REQ-1): pass (spawned node build.mjs in a fresh mkdtemp dir with only content.json and no env overrides -> exit 0, empty stderr, dist/ created holding index.html)
- the output is one file, `index.html`, inside the output directory, which is created when absent (covers: REQ-2): pass (TS-INV-05 asserts readdirSync(OUT_DIR) == ["index.html"]; OUT_DIR absent before each run and created by the build; node --test test/build.test.mjs -> 13/13 pass)
- with `CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out`, the script reads `<tmp>/c.json` and writes `<tmp>/out/index.html` and nothing else (covers: REQ-14): pass (every test sets CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out; TS-INV-05 asserts out holds only index.html; node --test test/build.test.mjs -> 13/13 pass)
- `package.json` declares no `dependencies` and the script makes no network call (no `node:http`, `node:https`, `node:net`, `fetch` in `build.mjs`) (covers: REQ-11): pass (package.json has no dependencies key; grep -nE "node:(http|https|net)|fetch" build.mjs prints nothing (also asserted in TS-NOGO-02); node --test test/build.test.mjs -> 13/13 pass)
- the content file's bytes are identical before and after a run (covers: REQ-13): pass (TS-INV-02 sha256 of content file equal before/after run; node --test test/build.test.mjs -> 13/13 pass)
- `CONTENT_FILE` naming a missing file → exit 1, exactly one stderr line naming the path, no `index.html` written (covers: REQ-18): pass (TS-ERR-CONTENT_MISSING: exit 1, one stderr line containing the missing path, no index.html, no OUT_DIR; node --test test/build.test.mjs -> 13/13 pass)
- a content file holding `{not json` → exit 1, exactly one stderr line, no `index.html` written (covers: REQ-18): pass (TS-ERR-CONTENT_UNPARSEABLE: exit 1, one stderr line, no index.html, no OUT_DIR; node --test test/build.test.mjs -> 13/13 pass)
- content with no `name`, `name: 42` or `name: ""` → exit 1, exactly one stderr line naming `name`, no `index.html` written (covers: REQ-19): pass (TS-REQ-name-missing and TS-REQ-name-type (42 and ""): exit 1, one stderr line containing name, no index.html; node --test test/build.test.mjs -> 13/13 pass)
- on every error path the output directory is not created when it did not exist (covers: REQ-18): pass (assertError() in every error test asserts existsSync(OUT_DIR) === false; node --test test/build.test.mjs -> 13/13 pass)
