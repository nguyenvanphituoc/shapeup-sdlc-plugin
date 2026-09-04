# Probing (Phase A)

How to collect evidence by criterion `probe` type and by task variant. Default to the
running app over reading source.

## `[ui]` criteria: run the oracle, do not drive the browser yourself

**You do not perform the browser loop. `ui` is a registered oracle with a runner behind it, and
you dispatch to it exactly as you dispatch `process` or `http`.**

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" verify oracle --contract <contract.json>
```

It starts the app on a free port, drives the **Playwright CLI** in the project under test,
and returns one `{id, pass, evidence}` row per criterion. Three things follow, and they are the
reason the loop is no longer yours to run:

- **The verdict is re-runnable.** It is a command with an exit code, so the same probe can be
  replayed byte-identically by the seesaw regression check and cited by hash the way T0 artifacts
  are. A probe you narrate is evidence only you saw.
- **Affordance-only is enforced, not requested.** The contract grammar has no key for a colour, a
  font, a pixel box or a screenshot comparison, so a styling assertion cannot be written, let
  alone rationalised into one. Assertions address `testid`, `role`+`name`, `state`
  (visible/hidden/enabled/disabled), `data_state`, `text`, `absent`, `url`, `console_clean` —
  nothing else. Ugly-but-correct PASSes; pretty-but-wrong-`data-state` FAILs.
- **It costs no model tokens.** The accessibility tree never enters your context; the evidence
  string does.

Assertions read the browser's **accessibility tree**, not screenshots — structured role/label/
state per element, no vision model needed. That is what keeps the verdict localizable: a missing
or dead element comes back as `getByTestId('x') expected: 0 received: 1`, and you then read the
source to pin file:line for the bug entry.

**Authoring the contract** — one row per criterion, mirroring its Test Surface row:

```json
{ "oracle": "ui",
  "server": { "cmd": "<payload.run_cmd>", "ready_path": "/", "ready_timeout_ms": 6000 },
  "criteria": [
    { "id": "UC-04/TS-INV-01", "desc": "over-limit withdrawal is refused",
      "probe": { "path": "/account", "steps": [ { "fill": "amount", "value": "999999" },
                                                { "click": "withdraw" } ] },
      "expect": { "testid": "error", "text": "/INSUFFICIENT_FUNDS/", "console_clean": true } },
    { "id": "UC-04/TS-NOGO-02", "desc": "no export affordance (pitch no-go)",
      "probe": { "path": "/account" },
      "expect": { "testid": "export", "absent": true } } ] }
```

The server is spawned with `PORT` set to a port the oracle picks, so the app must read
`process.env.PORT` — identical to the `http` oracle, and the same fixture works under both.

**Lazy preflight is the oracle's job, not a step you perform.** Playwright is NOT an install-time
prerequisite of the harness, and a run with no `[ui]` criteria completes on a machine with no
browser. When the CLI or the browser binary is missing, the oracle FAILs every criterion in that
contract with the fix named:

> NO EVIDENCE — the Playwright CLI is not available from <root>; install it in the project under
> test: `npm i -D @playwright/test && npx playwright install chromium`

Carry that verbatim into the criterion's evidence. It never auto-installs (a grading run must not
reach the network) and never silently skips — a `[ui]` AC without a probe is a FAIL with reason
"unverifiable: no browser", never a PASS. `payload.browser` selects the engine
(`chromium` default | `firefox` | `webkit`); there is no MCP mode, and none is needed — the
harness drives the CLI the project already has.

Write the returned rows to `evaluation/.evidence/<task>-<crit>.txt` as for any other oracle; the
oracle also leaves its generated run workspace and Playwright report under the local tier.

## Oracle dispatch (evaluation contract)

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
| `ui` *(default)* | running web app | `ui` oracle — starts the app, drives the Playwright CLI, grades affordances (above) | affordance + assertion observed, console |
| `process` | CLI / script | spawn the binary with the criterion's `argv` in a **throwaway temp dir** (never the real cwd), seeded with any required store/fixture via env; read exit + stdout/stderr | exit code + stdout/stderr + crash check |
| `test` | library / module | run the project's own test command; parse the summary line | suite exit + executed-test count + failing-test names |
| `snapshot` | generator / pure refactor | run the deliverable, capture stdout, diff it against the agreed golden output | unified diff (empty = PASS) |
| `http` | service / API | start the server on a free port, wait until it answers, send the request, assert; tear it down | status code + response body/JSON |

**Per-oracle `probe`/`expect` shape (author it inline, one row per criterion):**
- `ui` — `server: { cmd, ready_path }` + `probe: { path, steps }`, `expect` from the affordance
  grammar above. An app that never becomes reachable FAILs **every** criterion.
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
- `ui` — dispatch the `ui` oracle above; never drive a browser by hand.
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

The commands below are shaped for a JS/TS monorepo because that is the most common case, not
because the dimension assumes one. Resolve the real test pattern and runner from the scope
contract's `e2e_verification_fixtures` and the project's own test scripts; the criteria in
`dimensions/integration.md` state the invariant each probe is collecting evidence for.

**Finding integration test files:** look for a naming convention that separates integration
from unit tests (e.g. `*.integration.spec.ts`, `*.e2e-spec.ts`, a top-level `test/`
directory) and inspect the project's script targets for an integration/e2e entry —
`test:e2e`, `test:int`, `test:integration`, a tagged subset, or a separate runner config.
Check every target the project defines: "I only ran the unit suite" is a probing error, not
a finding.

**INT-1 (no mocked data layer):** after locating the integration tests for the task's
feature, find the project's mocking primitive and inspect **what it replaces**:
```bash
grep -rn "jest\.mock\|vi\.mock" <integration-test-file>   # adjust to the project's primitive
```
Mocking outbound third parties (HTTP clients, email senders, payment sandboxes) is
acceptable. Mocking the database client, a repository class, or the persistence connection
defeats integration testing. Then run the integration target and capture exit code and test
count.

**INT-2 (access boundary):** first confirm from `usecases/` Error Cases, `contracts/`, or the
Non-Go list that the spec documents a caller who must not reach this operation. If it
documents none, record N/A with that citation. Otherwise locate the test case exercising the
unauthorized path and inspect its setup: it should present an unentitled caller (different
tenant/user/org, lower-privilege role, or no credentials) and assert the outcome the spec
documents. Capture the test body and the run output as evidence.

**INT-3 (enforcement-path integrity):** identify the layer that actually enforces the
boundary, then read the test setup — suite-level hooks, shared helpers, test env config — and
confirm it traverses that layer rather than around it. What to grep for depends on the
mechanism:
```bash
# database row-level policies: is the caller's claim set injected, and in the right scope?
grep -rn "set_config\|jwt\.claims\|SET LOCAL" <test-setup-files>

# connection mode: transaction-scoped settings can leak across pooled connections in
# session mode, so the configured port/mode is part of the evidence
grep -rn "DATABASE_URL\|DIRECT_URL" <test env config>

# guard / middleware chains: does the suite build the composed app, or the handler alone?
grep -rn "createTestingModule\|overrideGuard\|overrideProvider" <test-setup-files>
```
A setup that connects as an administrative or unscoped principal, omits the guard layer, or
seeds state through a back door calls the system with privileges the real caller never has —
every access assertion above it is a false positive. Report each distinct bypass separately.

## By task variant
- `.be` — no browser (`--browser none`). Start the API; send contract-shaped requests;
  assert Response + Error tables; run the package test suite. Evidence = request/response
  transcripts + test output.
- `.shared` — usually `cmd` only: typecheck + unit tests on the shared package; verify
  contract types compile and match the tables.
- `.web` — the `ui` oracle against the running web app for `SC-AC` and `SC-DONE-WHEN`.
- `.mobile` — the `ui` oracle does not drive a native RN app. Options: probe via the platform's
  e2e tool (Detox / Maestro) if present; otherwise mark the `[ui]` criteria `[manual]` at
  GATE V1 and require an explicit user check (or `--strict` to FAIL them). Do not fake UI
  evidence for native screens.
- `.e2e` — run the existing end-to-end suite; green suite is the evidence for `SC-AC`.

## App must be reachable before grading
If the run command does not produce a reachable app, that is not "untestable" — it is a
**FAIL** of every `[ui]`/`[data]` criterion under `NO EVIDENCE`, plus a critical bug:
"app does not start with the stated run command." A build you cannot run does not pass.

## Evidence storage
Write raw evidence under `.shapeup/<slug>/evaluation/.evidence/` and reference it by path in the report.
Keep the report itself readable; the evidence files are the audit trail the generator and
the user can open.
