---
id: integration
title: "System integration"
enabled: true
weight: 1.0
hard_threshold: no-critical
applies_to:
  lens: [lite, standard]
  package: any
  variant: [be, e2e]
requires_browser: false
---

# System Integration Dimension

**Why this exists.** Unit tests verify isolated logic. `spec-conformance` drives the
running app and confirms AC at the surface. Neither catches the class of bug where each
layer works in isolation but the *seam* is broken: the wrong auth header forwarded, an
authorization policy never invoked because the call bypassed the layer that enforces it, a
schema migration not applied to the test database, or a contract mismatch between the client
and the handler it calls. This dimension fills that seam.

**What "system integration" means here:** the full request path — client → entry point →
application logic → persistence — exercised by tests that use the project's **real**
dependencies, not mocked layers. An integration test that mocks the database client or
replaces the repository with an in-memory stub is a unit test wearing integration clothing
and does not satisfy this dimension.

**Read the project's stack from the artifacts, not from this file.** The commands, file
patterns, and enforcement mechanisms differ per project: resolve them from
`project-profile.md` (`archetype`, `entry_point`), the scope contract's
`e2e_verification_fixtures`, and the spec's `contracts/`. This file states the invariant;
the "Probing notes" section carries worked examples of what it looks like in common stacks.
A project whose stack matches none of them still owes the invariant.

**`.e2e` variant:** the e2e suite inherently exercises the full stack. INT-1 (integration
test existence) maps to the e2e test file(s) added by the task. INT-2 and INT-3 apply if
the e2e task introduces any access-controlled operation.

---

## Criteria

```yaml
- id: INT-1
  statement: "At least one integration/e2e test exercises the feature's main flow end-to-end against the project's real dependencies — no mocked data layer."
  probe: static + cmd
  evidence_required: true
  pass_rule: >
    Locate the integration test files for this task's package — resolve the pattern and the
    runner command from the scope contract's `e2e_verification_fixtures`, else the project's
    test scripts (a target named for integration/e2e rather than unit). Grep for test cases
    that touch the happy-path scenario the task implements. Verify the test does NOT mock the
    data layer: search the file for the project's mocking primitive and inspect what it
    replaces. Mocking outbound third-party calls (HTTP clients, email, payment sandboxes) is
    acceptable and often required; mocking the database client, the repository, or the
    persistence connection defeats the dimension. Then run the integration suite and capture
    exit code + test count. Zero integration test files → FAIL at `critical`. Any integration
    test that mocks the data layer → FAIL at `critical` (evidence: the mock call and the
    module path it replaces).
  source: code

- id: INT-2
  statement: "An unauthorized-access scenario is covered: a request from an unentitled caller is rejected with the documented outcome, exercised by an integration test."
  probe: cmd + data
  evidence_required: true
  pass_rule: >
    FIRST establish whether the feature has an access boundary at all: does the spec
    (`usecases/` Error Cases, `contracts/`, the Non-Go list) document any caller who must NOT
    reach this operation — a different tenant/user/org, a lower-privilege role, an
    unauthenticated caller? If the spec documents none and the operation is genuinely public,
    record INT-2 as N/A with that citation and exclude it from the denominator; do not invent
    an authorization requirement the spec does not state. Otherwise, find the integration test
    exercising the unauthorized path and assert it checks the outcome the spec documents
    (a rejection status, an empty result set, a filtered response). If the spec also
    distinguishes read from write for a role, verify the read-only role cannot mutate.
    Evidence = the test case text + the run output showing it passes. A documented boundary
    with no such test → FAIL at `critical` — this is the gap that lets real authorization
    bugs slip through conformance testing.
  source: usecases

- id: INT-3
  statement: "Integration tests exercise the same enforcement path production uses — the test setup does not bypass or elevate past the mechanism that enforces the boundary."
  probe: static
  evidence_required: true
  pass_rule: >
    Applies only when INT-2 is in scope AND the project enforces the boundary in a layer a
    test could bypass (database row-level policies, a middleware/guard chain, a tenant-scoped
    client, a signed-context requirement). Identify that mechanism from the project profile,
    the contracts, or the production wiring — then inspect the integration test setup
    (suite-level hooks, test helpers, test env config) and confirm it goes through the same
    path: the same credential/claim injection, the same connection or client mode, the same
    guard chain. A setup that connects as an administrative or unscoped principal, disables
    the guard layer, or seeds state through a back door calls the system with privileges the
    real caller never has, and every access assertion above it is a false positive → FAIL at
    `major`. If the project enforces the boundary only in code the test already traverses
    (no bypassable layer exists), record INT-3 as N/A with that reasoning. Report each
    distinct bypass as its own finding.
  source: code
```

---

## Threshold

`no-critical` — INT-1 and INT-2 are `critical`: a task that cannot prove end-to-end
correctness, and cannot prove a documented authorization boundary, is not integration-tested
and is not done. INT-3 (enforcement-path integrity) is `major`: a bypassed enforcement layer
produces false-positive passes — the test appears to work while the boundary is never
exercised — which is confidence-undermining, but it is one step removed from observable
breakage and is reported as major rather than critical.

A criterion recorded N/A under its own rule (INT-2 with no documented boundary, INT-3 with
no bypassable layer) leaves the denominator, exactly like `tdd-surface`'s TDD-2 on `.e2e`.
N/A requires the citation that justifies it; "no auth here, probably" is not a citation.

---

## Bug template

```
severity: [critical|major]
criterion: [INT-1|INT-2|INT-3]
location: <test file path | test setup/helper | test env config | file:line>
repro: <the command or search that shows it — e.g. the integration suite command, or the grep that finds the mock>
expected: <e.g. "integration test covering <flow> against the real database" | "test setup injects the caller's own credentials">
actual: <e.g. "no integration test found for <flow>" | "repository module is mocked in the suite" | "setup connects as the admin principal">
fix_hint: <e.g. "add <flow> integration test using the real test database; route setup through the same guard chain production uses">
```

## Probing notes

- **Find the suite before judging it.** Integration targets are usually separate from unit
  tests (`test:e2e`, `test:int`, `test:integration`, a tagged subset, a separate config).
  Check every script the project defines, not just the default `test` — "no integration
  tests" is a FAIL, but "I only ran the unit target" is a probing error, not a finding.
- **Mock detection is about the target, not the call.** Find the project's mocking primitive
  (`jest.mock`/`vi.mock`, a DI container override, a fake registered in a test module,
  a stubbed client factory) and inspect *what it replaces*. Outbound third parties: fine.
  The data layer: fatal to the dimension.
- **Worked example — row-level policies with claim injection.** Where the database enforces
  access (e.g. Postgres RLS), the enforcement is a per-connection claim set inside a
  transaction; a test that queries outside that transaction runs as the application role and
  silently returns rows the real caller could never see. INT-3 there means checking the setup
  performs the claim injection, and that the connection mode preserves it — a session-mode
  connection can leak transaction-scoped settings across pooled connections where a
  transaction-mode one does not. Both are INT-3 findings, reported separately.
- **Worked example — guard/middleware chains.** Where a framework enforces access in a guard,
  interceptor, or middleware, the bypass is a test that constructs the handler directly, or
  registers a test module with the guard omitted. INT-3 means the test goes through the
  composed application, not around it.
- **Worked example — tenant-scoped clients.** Where scoping is a client constructed per
  caller, the bypass is a shared admin/service client in the test setup. INT-3 means the test
  builds its client the way a request does.
- **For `.e2e` tasks**, a test driving the running server over HTTP counts as an integration
  test if it reaches a real database. Verify the *test server's* configuration, not the
  production server's — they routinely differ, and that difference is where INT-3 hides.
- **Do not skip INT-3 because the test "seems to work."** An enforcement layer that is never
  invoked returns the same green as one that passes. Absence of a bypass must be evidenced,
  not assumed.
