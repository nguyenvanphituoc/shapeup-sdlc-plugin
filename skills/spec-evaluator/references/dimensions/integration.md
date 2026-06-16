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
layer works in isolation but the *seam* is broken: wrong auth header forwarded, RLS policy
not invoked because the transaction is missing, Prisma schema migration not applied in the
test database, or a contract mismatch between web's api-client and the API controller.
This dimension fills that seam.

**What "system integration" means here** (scoped to the IVS ADR-005 stack):
the full request path — web api-client → API controller → service → repository (Prisma +
RLS) → database — exercised by tests that use a real database, not mocked layers.
An integration test that mocks `PrismaClient` or replaces the repository with an in-memory
stub is a unit test wearing integration clothing and does not satisfy this dimension.

**Project context (read AGENTS.md Section 2 rules 3 & 4 before probing):**
- All user-scoped queries must run inside a transaction that injects the JWT claims so RLS
  fires (`SET LOCAL request.jwt.claims`). An integration test that queries without this
  transaction bypasses RLS and produces a false-positive PASS.
- The connection string must point to the **transaction-mode pooler** (port 6543), not the
  session-mode direct connection (port 5432). Session mode allows `SET LOCAL` to leak.
- Never trust a `userId` sent in the request body — derive it from the verified JWT.

**`.e2e` variant:** the e2e suite inherently exercises the full stack. INT-1 (integration
test existence) maps to the e2e test file(s) added by the task. INT-2 and INT-3 apply if
the e2e task introduces any auth-scoped endpoint.

---

## Criteria

```yaml
- id: INT-1
  statement: "At least one integration/e2e test exercises the feature's main flow end-to-end with a real database — no mocked repository or Prisma layer."
  probe: static + cmd
  evidence_required: true
  pass_rule: >
    Locate integration test files for this task's package (typically `*.integration.spec.ts`,
    `*.e2e-spec.ts`, or a `test/` directory at the package root). Grep for test cases that
    touch the happy-path scenario the task implements. Verify the test does NOT mock the
    data layer: `grep -rE 'jest\.mock|vi\.mock' <integration-test-file>` should return no
    hits on repository, Prisma, or database imports. Then run `pnpm --filter <pkg> test:e2e`
    (or the integration-specific script) and capture exit code + test count.
    Zero integration test files → FAIL at `critical`. Any integration test that mocks the
    DB layer → FAIL at `critical` (evidence: the jest.mock / vi.mock import path).
  source: code

- id: INT-2
  statement: "An unauthorized-access scenario is covered: a request from a different user/org is rejected with the correct error (403 or empty set), exercised by an integration test."
  probe: cmd + data
  evidence_required: true
  pass_rule: >
    Find the integration test that exercises the unauthorized path: a user from a different
    org (or an unauthenticated caller) attempts to read/write the resource this task
    introduces. The test asserts the correct rejection: 403 Forbidden, an empty result set,
    or an RLS-filtered response. If the resource is read-only to viewers (role_tag check),
    also verify a `viewer` role cannot mutate it. Evidence = the test case text + the run
    output showing it passes. No such test → FAIL at `critical` — this is the gap that lets
    real authorization bugs slip through conformance testing.
  source: code

- id: INT-3
  statement: "Integration tests inject JWT claims via the RLS transaction pattern (set_config inside a transaction) and target the transaction-mode pooler (port 6543)."
  probe: static
  evidence_required: true
  pass_rule: >
    Inspect the integration test setup (beforeAll / test helper): it must execute
    `SET LOCAL request.jwt.claims` (or the equivalent `$executeRaw\`select set_config(...)\``)
    inside a Prisma `$transaction` block before any user-scoped query. Also check the
    DATABASE_URL used in the test config: it must include port 6543 (transaction pooler),
    not 5432 (session mode). A test that queries without the JWT injection calls the DB as
    the app role without RLS and will PASS rows it should not see → FAIL at `major`.
    A test using port 5432 risks SET LOCAL leaking across pooled connections → FAIL at `major`.
    If both problems are present, report as two separate findings.
  source: code
```

---

## Threshold

`no-critical` — INT-1 and INT-2 are `critical`: a task that cannot prove end-to-end
correctness and cannot prove its authorization boundary is not integration-tested and is
not done. INT-3 (JWT transaction pattern + pooler port) is `major`: incorrect plumbing in
the test setup produces false-positive passes (the test appears to work without RLS firing),
which is a confidence-undermining failure — but it is one step removed from observable
breakage and is reported as major rather than critical.

---

## Bug template

```
severity: [critical|major]
criterion: [INT-1|INT-2|INT-3]
location: <test file path | package/test/setup.ts | .env.test | file:line>
repro: <e.g. "grep -rE 'jest.mock.*repository' test/" | "grep DATABASE_URL .env.test" | "pnpm --filter api test:e2e">
expected: <e.g. "integration test exists targeting BoardRepository with real DB" | "DATABASE_URL ends with :6543/...">
actual: <e.g. "no *.integration.spec.ts in apps/api/src/boards/" | "DATABASE_URL uses port 5432" | "vi.mock('../../infrastructure/BoardRepository')">
fix_hint: <e.g. "add boards/boards.integration.spec.ts; use PrismaService with a real test DB; wrap queries in $transaction with set_config">
```

## Probing notes

- Integration test scripts are often separate from unit tests: `test:e2e` / `test:int` /
  `test:integration` in package.json. Check all scripts, not just `test`.
- For mocking detection: `grep -rn "jest\.mock\|vi\.mock" <test-file>` and inspect what
  is being mocked. Mocking HTTP clients, external APIs, or filesystem utilities is fine;
  mocking the Prisma client or the repository class defeats integration testing.
- For port check: the integration DB URL is typically in `.env.test` or `jest.config.ts`
  (globalSetup). Check `DATABASE_URL` and `DIRECT_URL` separately — some setups split them.
- For `.e2e` tasks: `supertest` or `axios` against the running NestJS server counts as
  an integration test if it hits a real DB. Verify the test server's DB config, not just
  the production server's config.
- Do not skip INT-3 because the test "seems to work." RLS without `set_config` silently
  returns all rows as the app role — the test passes but the auth boundary is untested.
