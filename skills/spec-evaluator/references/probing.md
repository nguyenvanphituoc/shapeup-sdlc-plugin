# Probing (Phase A)

How to collect evidence by criterion `probe` type and by task variant. Default to the
running app over reading source.

## Browser mode: prefer CLI over MCP
For `[ui]` criteria, drive the browser via the Playwright **CLI**, not the MCP server, by
default. The CLI saves accessibility snapshots as files on disk and the agent reads them
on demand; MCP streams the full accessibility tree into context every step. The CLI path
uses roughly 4x fewer tokens for the same work, and the Playwright team recommends it for
coding agents specifically. Use `--browser mcp` only in a sandboxed environment where the
CLI's filesystem access isn't available.

Both paths read the browser's **accessibility tree**, not screenshots — structured
role/label/state per element, no vision model needed. That is what makes the verdict
localizable: a missing or dead element shows up as a tree node, then read the source to
pin file:line.

```
Setup (once): npx playwright install chromium
The probe loop per [ui] criterion:
  1. navigate to the screen under test
  2. snapshot the accessibility tree → save to evaluation/.evidence/<task>-<crit>.txt
  3. perform the action the criterion describes (click/type/submit)
  4. snapshot again; diff state; capture any console error
  5. record: element observed, state before/after, console output, and — if broken —
     the source file:line where the handler/wiring fails
```

## Oracle dispatch (evaluation contract — Stage G)

Each criterion / Test-Surface row carries an `oracle` tag — the dispatch key that declares *how*
this criterion is verified. **Dispatch on it to choose the probe mechanism; default to `ui` when
the tag is absent** (web pitches are unchanged). The single-judge invariant is untouched — one
verdict per criterion, evidence-or-FAIL — the oracle changes only *how* evidence is gathered, never
*who* decides.

For every non-`ui` oracle you gather evidence by **running the deliverable yourself** (the Bash
tool) and grading its *observed* output against the criterion's `expect`. Treat each criterion as a
small declarative `{ id, desc, probe, expect }` row and grade it directly; never grep source in
place of running it. A probe that throws, cannot spawn, or cannot reach the deliverable is a
**FAIL** (absence of evidence), never a silent pass.

| `oracle` | Deliverable | Probe procedure — run it, cite the observed output | Evidence to record |
|---|---|---|---|
| `ui` *(default)* | running web app | Playwright CLI loop (above) | a11y-tree node, state before/after, console |
| `process` | CLI / script | spawn the binary with the criterion's `argv` in a **throwaway temp dir** (never the real cwd), seeded with any required store/fixture via env; read exit + stdout/stderr | exit code + stdout/stderr + crash check |
| `test` | library / module | run the project's own test command; parse the summary line | suite exit + executed-test count + failing-test names |
| `snapshot` | generator / pure refactor | run the deliverable, capture stdout, diff it against the agreed golden output | unified diff (empty = PASS) |
| `http` | service / API | start the server on a free port, wait until it answers, send the request, assert; tear it down | status code + response body/JSON |

**Per-oracle `probe`/`expect` shape (author it inline, one row per criterion):**
- `process` — `probe: { argv, store }`, `expect: { exit, stdout, no_crash }`. Sandbox in a temp
  dir + controlled env + a timeout so corrupted-input / missing-file probes cannot touch user data.
- `test` — `probe: { cmd }`, `expect: { exit, min_tests, no_failures }`. **A suite that runs zero
  tests is a FAIL** (matches TDD-1 below): a suite that runs nothing is not green.
- `snapshot` — `probe: { argv }` + an agreed `golden` (normalize trailing whitespace + the final
  newline so a benign EOL diff is not a false FAIL).
- `http` — `server: { cmd, ready_path }` + `probe: { method, path, json }`, `expect: { status,
  body, json }`. An unreachable server FAILs **every** criterion (a service you cannot reach does
  not pass).

**Shared `expect` grammar:** `exit`/`status` accept a number or a comparison string (`==0`, `!=0`,
`>=200`, `<500`, or `*` = any); `stdout`/`stderr`/`body` accept `/regex/flags` matched against the
observed output; `no_crash: true` requires no stack-trace/panic signature; `json` is a subset match
on the parsed response body.

The `ba` Test Surface emits the `oracle` per row; for a non-UI deliverable the rows are already
tagged `process`/`test`/`snapshot`/`http`, so do not fall back to driving a browser that does not
exist.

## By probe type
- `cmd` — run the command the AC implies (`pnpm --filter <pkg> test`, `pnpm typecheck`,
  `curl` against a running endpoint, `migration up && migration down`). Capture stdout,
  stderr, exit code. Non-zero exit or failing assertion = evidence of FAIL. (Backs the `test`,
  `snapshot`, and `http` oracles.)
- `ui` — Playwright CLI loop above. (Backs the `ui` oracle.)
- `data` — query the DB / inspect storage after the action; capture the actual row/state
  and compare to what the criterion expects.
- `static` — read the diff / changed files (for `SC-NONGO`, `SC-LAYER`, secret scans,
  TDD companion-file checks, integration test setup inspection). Use sparingly; never
  substitute a code read for exercising behavior an AC describes.

## TDD probing (for `tdd-surface` dimension)

**TDD-1 (suite green):** Run `pnpm --filter <pkg> test` and capture the full output.
Most Jest/Vitest runs emit something like `Tests: 4 passed, 0 failed` on the last line.
Non-zero exit = FAIL. Zero tests executed = FAIL (a suite that runs nothing is not a green
suite). Save the raw output to `evaluation/.evidence/<task>-TDD-1.txt`.

**TDD-2 (companion files):** List files added by this task:
```bash
git diff --name-only --diff-filter=A HEAD~1  # files added; adjust base ref as needed
```
Filter to source files (`.ts`, `.tsx`) excluding `*.test.ts`, `*.spec.ts`, `*.d.ts`, and
index/barrel-only files. For each remaining file, check whether a companion test file
exists either co-located or in the package's `__tests__/` or `test/` directory:
```bash
# example check for a specific module
find <pkg>/src -name 'BoardService.test.ts' -o -name 'BoardService.spec.ts'
```
Record the missing companions as evidence for TDD-2 FAILs.

**TDD-3 (AC-scenario alignment, advisory):** Read the test file for the main new module.
Look for test cases that match the AC scenario descriptions. Tests that only call
`expect(result).toBeDefined()` or only exercise the constructor do not count.
This is a static read; no running required. Record whether each key AC has a matching test.

## Integration probing (for `integration` dimension)

**Finding integration test files:** Check for files matching `*.integration.spec.ts`,
`*.e2e-spec.ts`, or a top-level `test/` directory in the package. Also inspect
`package.json` scripts for `test:e2e`, `test:int`, or `test:integration` targets.

**INT-1 (no mocks):** After locating integration test files for the task's feature:
```bash
grep -rn "jest\.mock\|vi\.mock" <integration-test-file>
```
Mocking HTTP clients, email senders, or third-party APIs is acceptable. Mocking
`PrismaClient`, a repository class, or the database connection defeats integration testing.
Then run the integration suite: `pnpm --filter <pkg> test:e2e` (or equivalent). Capture
exit code and test count.

**INT-2 (auth boundary):** Locate the test case exercising the unauthorized path. Inspect
its setup: it should create a different user's JWT (or use no auth) and assert a 403 or
empty-set response. Capture the test body and the run output as evidence.

**INT-3 (RLS-JWT pattern + pooler port):**
```bash
# Check for set_config call in test setup or helper
grep -rn "set_config\|request\.jwt\.claims" <test-setup-files>

# Check connection string in test env
grep "DATABASE_URL" .env.test apps/api/.env.test
```
The `DATABASE_URL` must end with `:6543/...` (transaction-mode pooler). If no `.env.test`
exists, check `jest.config.ts` or `globalSetup` for a `DATABASE_URL` override. A missing
`set_config` call means queries run without RLS — false-positive auth passing silently.

## By task variant
- `.be` — no browser (`--browser none`). Start the API; send contract-shaped requests;
  assert Response + Error tables; run the package test suite. Evidence = request/response
  transcripts + test output.
- `.shared` — usually `cmd` only: typecheck + unit tests on the shared package; verify
  contract types compile and match the tables.
- `.web` — Playwright CLI against the running web app for `SC-AC` and `SC-DONE-WHEN`.
- `.mobile` — Playwright does not drive a native RN app. Options: probe via the platform's
  e2e tool (Detox / Maestro) if present; otherwise mark the `[ui]` criteria `[manual]` at
  GATE V1 and require an explicit user check (or `--strict` to FAIL them). Do not fake UI
  evidence for native screens.
- `.e2e` — run the existing end-to-end suite; green suite is the evidence for `SC-AC`.

## App must be reachable before grading
If the run command does not produce a reachable app, that is not "untestable" — it is a
**FAIL** of every `[ui]`/`[data]` criterion under `NO EVIDENCE`, plus a critical bug:
"app does not start with the stated run command." A build you cannot run does not pass.

## Evidence storage
Write raw evidence under `.shapeup-sdlc/<slug>/evaluation/.evidence/` and reference it by path in the report.
Keep the report itself readable; the evidence files are the audit trail the generator and
the user can open.
