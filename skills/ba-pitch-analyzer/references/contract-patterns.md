# Contract Patterns — Repository Boundary Contracts

Reference for Phase 2b. Read before writing any `.contract.md` file.

---

## Why Contracts Exist

Repository interfaces in `domain-model.md` define *what* a repository does.
Contract files define *exactly what shape* goes in and comes out.

A developer must be able to read a contract and answer:
- What exact fields do I send?
- What fields come back, and what are their types and invariants?
- What errors can occur, and how do I handle each one?

If any of those questions require opening another document, the contract is incomplete.

---

## Determining Source Type

Read the pitch and domain model. For each repository interface, ask:

```
Is the data store internal to the monorepo?
├── YES and it's a database/file/local cache → offline-storage
└── YES and it's another service in the system → be-service

Is the data store an external vendor?
└── YES → third-party-api
```

Use the corresponding template from `assets/templates/contracts/`.

---

## Source Type: `be-service`

Use when: repository calls an internal HTTP service (same org, different service/package).

**Key contract fields:**
- HTTP method + path (exact, including path params)
- Auth header type — never leave this implicit
- Request body table with `Source` column tracing each field to a UC input or env var
- Response table per HTTP status code (200, 201, etc.)
- Error table with HTTP status, error code, UX action

**Contract is `status: confirmed` immediately** — Dev can verify from service code.

**Source column values:**
```
UC-[Name].input.[fieldName]     ← from a use case input interface
env.[ENV_VAR_NAME]              ← from environment config
session.[claim]                 ← from JWT/auth context (e.g. session.userId)
domain.[Aggregate].[field]      ← derived from domain model state
computed:[formula]              ← calculated by application layer before calling repo
```

---

## Source Type: `third-party-api`

Use when: repository calls an external vendor API or SDK (Framer, Stripe, Twilio, etc.).

**Key contract fields:**
- Same as be-service PLUS:
- `feasibility_ref: API-NN` — links to api-feasibility.md investigation block
- `spike_task` — links to the SPIKE task that will confirm this contract
- `status: speculative` — MUST remain speculative until SPIKE is done
- `⚠️ SPECULATIVE CONTRACT` header — visible warning to all readers

**⏳ TBD annotation format:**
```markdown
| pageId | string | ⏳ TBD — field name unverified | publishPage() |
```
Every `⏳ TBD` field must reference what needs to be confirmed.

**Transition to confirmed:**
When SPIKE task is complete, Dev:
1. Replaces all `⏳ TBD` entries with confirmed values + source URL
2. Changes `status: speculative` → `status: confirmed`
3. Removes `⚠️ SPECULATIVE CONTRACT` header
4. Fills `Post-SPIKE Update Log` table
5. Implementation tasks blocking annotation can now be removed

---

## Source Type: `offline-storage`

Use when: repository reads/writes to local device storage (SQLite, AsyncStorage, MMKV,
file system, or in-memory cache).

**Key contract fields:**
- Engine name (SQLite via Drizzle, AsyncStorage, MMKV, etc.)
- Table/key schema with column types, constraints, and migration version
- Migration version must match `domain-model.md` schema version — they stay in sync
- Conflict strategy — what happens on concurrent writes
- Null behavior for read methods — must be explicit (null vs empty array vs throw)

**Contract is `status: confirmed` immediately** — schema is defined in the spec.

**Null behavior rule:**
```
findById → returns null (never throws) when not found
findAll  → returns [] (never null) when empty
write    → throws StorageError (never returns null) on failure
```
These invariants must appear in the contract Error Cases table.

---

## Contract Registry (`contracts/_index.md`)

Every contracts folder must have an `_index.md` registry:

```markdown
# Contract Registry — [feature-slug]

| Repository | Source Type | Service / Engine | Status | SPIKE Task |
|-----------|------------|-----------------|--------|------------|
| [[FramerPageRepository]] | third-party-api | Framer REST API | ⚠️ speculative | [[TASK-001]] |
| [[PageCacheRepository]] | offline-storage | SQLite/Drizzle | ✅ confirmed | — |
| [[UserSessionRepository]] | be-service | apps/api /auth | ✅ confirmed | — |
```

This registry is the entry point for Phase 7a audit check L2-21.

---

## Contract → Task Traceability

Every implementation task that uses a repository MUST:

1. Reference the contract in the Context section:
   ```markdown
   ## Context
   Implement FramerPageRepository per [[contracts/framer-page.contract.md]].
   ```

2. Include these three AC lines under Baseline:
   ```markdown
   - [ ] Request shape matches [[contracts/framer-page.contract.md#Request]] table
   - [ ] Response mapping matches [[contracts/framer-page.contract.md#Response]] table
   - [ ] All error codes in contract Error Cases table are handled
   ```

3. If contract is still `speculative` at task-generation time:
   ```markdown
   > ⏳ BLOCKED by [[TASK-001-spike-framer-feasibility]]
   > Unblock condition: [[contracts/framer-page.contract.md]] has no remaining ⏳ TBD fields
   ```
