# Task Generation Rules

Reference for Phase 6. Read before writing any `TASK-NNN` files.

---

## Core Principle

A task is the smallest unit of work that:
1. Can be verified independently (run a command → pass/fail)
2. Touches one package or one concern
3. Can be committed as a standalone change

If a task can't be verified by running `pnpm test` or `pnpm typecheck`, it's too vague.
If a task touches 3 packages, it needs to be split.

---

## Task Types

| Type | Purpose | Output | AC Style |
|------|---------|--------|----------|
| `FEAT` | New capability | Shippable code | Commands + observable outcomes |
| `FIX` | Bug correction | Patched code | Regression test passes |
| `CHORE` | Non-functional work | Config / tooling change | Command exits 0 |
| `MIGRATION` | DB schema change | Migration file | Migration runs + rolls back |
| `DOCS` | Documentation only | Markdown files | File exists + content check |
| `SPIKE` | Feasibility investigation | **Decision document** | All questions answered with citation |

**SPIKE is not a FEAT.** It produces knowledge, not code. Time-boxed, not estimated.

---

## SPIKE Task Rules

A SPIKE task MUST be generated whenever Phase 1b detected unverified third-party capabilities.

```yaml
---
id: TASK-[NNN]
type: SPIKE
slug: spike-[api-name]-feasibility
time_box_hours: 4          # hard cap — if not answerable in 4h, escalate to PO
api_ref: API-[NN]          # references api-feasibility.md investigation block
blocks:                    # REQUIRED — every task that cannot start until SPIKE done
  - TASK-[NNN]
  - TASK-[NNN]
status: todo
priority: 1                # always priority 1 — nothing can proceed without it
package: research          # not a code package — signals non-implementation task
estimated_hours: ~         # leave blank — SPIKE uses time_box_hours instead
linked_docs:
  - "[[api-feasibility#API-NN]]"
---
```

**Definition of Done for every SPIKE:**
```markdown
## Definition of Done
- [ ] All questions in [[api-feasibility#API-NN]] answered with direct source URL citation
- [ ] Contract file [[contracts/[repo].contract.md]] updated — no remaining ⏳ TBD fields
- [ ] If capability confirmed: tasks in `blocks` list updated to remove ⏳ BLOCKED annotation
- [ ] If capability NOT confirmed: PO notified with fallback scope options from api-feasibility.md
```

**Verification method section (mandatory for SPIKE):**
```markdown
## Verification Method
1. Read [Official Docs URL] — section: [specific section name]
2. If not documented: search [Community/GitHub/Discord] for [specific query]
3. If ambiguous: write minimal curl/SDK test against sandbox environment
4. Record finding in api-feasibility.md API-NN block before closing task
```

---

## Contract-First Rule

Before generating any implementation task that touches a repository:

```
Step 1: Verify contracts/[repo].contract.md exists
  → If missing: generate TASK-NNN-[repo]-contract-stub BEFORE the implementation task

Step 2: Check contract source type
  → be-service or offline-storage: proceed normally
  → third-party-api AND contract has ⏳ TBD fields:
       Add ⏳ BLOCKED annotation to implementation task
       Add implementation task ID to SPIKE blocks: list

Step 3: Implementation task Context section MUST include:
  "Implement [RepoName] per [[contracts/[repo].contract.md]]"

Step 4: Implementation task AC MUST include these three lines:
  - [ ] Request shape matches [[contracts/[repo].contract.md#Request]] table
  - [ ] Response mapping matches [[contracts/[repo].contract.md#Response]] table
  - [ ] All error codes in contract Error Cases table are handled
```

---

## Mandatory Ordering Rules

Tasks MUST follow this sequence within a feature. Never invert layers:

```
Layer 1: Shared types & DB schema     (packages/shared, migrations)
Layer 2: Domain model & repository    (packages/shared or apps/api/domain)
Layer 3: Application / use cases      (apps/api/usecases or apps/api/services)
Layer 4: Infrastructure / HTTP        (apps/api/routes, apps/api/controllers)
Layer 5: Frontend integration         (apps/web/features/...)
Layer 6: End-to-end tests             (e2e/, integration tests)
```

Every task at Layer N depends on all relevant tasks at Layer N-1.

---

## Lens-Aware Task Layer Breakdown

The layer structure differs by lens. Read `run-state.md` to determine active lens
before generating tasks.

### LITE — Mobile-first layer breakdown

```
Layer 1: Local schema / types       (packages/shared — entity shapes only, no repo interfaces)
Layer 2: Local state management     (apps/mobile — Zustand/Redux store, offline cache)
Layer 3: API call stubs             (apps/mobile — typed fetch wrappers, no contract defined yet)
Layer 4: UI components              (apps/mobile — screens, navigation, platform variants)
Layer 5: Integration smoke tests    (apps/mobile — happy path only, mocked API responses)
```

`use_case_refs` in LITE tasks maps to: *"User does X in screen Y"* — mobile perspective.
TypeScript Input/Output interfaces in UC files are **optional** in LITE (no API contract).
Tasks do NOT reference `contracts/` — use `[[ux-behavior#ScreenName]]` instead.

### STANDARD — App ↔ API layer breakdown

```
Layer 1: Shared schema / DB types   (packages/shared — full entity + VO types)
Layer 2: Domain model               (packages/shared or apps/api/domain)
Layer 3: Repository contracts       (contracts/ — one per repo interface)
Layer 4: Application / use cases    (apps/api/usecases — API perspective)
Layer 5: HTTP layer                 (apps/api/routes, controllers)
Layer 6: Mobile integration         (apps/mobile — consumes contracts, replaces stubs)
Layer 7: End-to-end tests           (e2e/ — contract + integration verified)
```

`use_case_refs` in STANDARD tasks maps to: *"App calls endpoint X → API does Y"*.
Every task at Layer 4+ MUST reference `[[contracts/[repo].contract.md]]`.

### LITE → STANDARD Reconciliation Pass

When upgrading, use cases with mobile perspective need an **API Contract sub-section added**:

```markdown
## API Contract  ← ADD THIS to existing UC files during reconciliation
> Added during STANDARD upgrade — original mobile steps preserved above.

POST /[resource]
Request  → [[contracts/[repo].contract.md#Request]]
Response → [[contracts/[repo].contract.md#Response]]
Errors   → [[contracts/[repo].contract.md#Error-Cases]]
```

Do NOT overwrite existing Steps section — append API Contract sub-section only.
Flag reconciled files in `run-state.md` under `human_edited_files` with note `reconciled-by-upgrade`.

---

## Task Decomposition Decision Tree

```
Is the work in this task > 8 hours?
├── YES → Split into smaller tasks
└── NO → Continue

Does the task touch more than one package?
├── YES → Split by package
└── NO → Continue

Does the task have two independent concerns?
      (e.g., "create schema AND implement service")
├── YES → Split by concern
└── NO → Task is appropriately scoped
```

---

## Acceptance Criteria Rules

Every criterion must be checkable by a command or observable action:

```markdown
# ✅ Good — verifiable
- [ ] `pnpm --filter shared typecheck` exits 0
- [ ] `pnpm --filter api test src/domain/order.test.ts` passes
- [ ] `GET /api/orders/:id` returns 200 with `{ id, status, totalAmount }`
- [ ] Migration file exists at `packages/shared/drizzle/migrations/XXXXXX_add_orders.sql`
- [ ] Type `Order` is exported from `packages/shared/index.ts`

# ❌ Bad — not verifiable
- [ ] The order aggregate is well-designed
- [ ] Code follows DDD principles
- [ ] Service is implemented correctly
```

---

## AC Trigger Matrix

Phase 6 applies this matrix to determine which AC sub-sections are REQUIRED
for each task. SKILL self-checks during generation — do not skip.

| Trigger Signal | ac_inverse | ac_empty_state | ac_boundary |
|----------------|:----------:|:--------------:|:-----------:|
| `layer: ui` + keyword `show/hide/display/visible/render` | ✓ | | |
| `task.type: FIX` + `layer: ui` — unconditional, no keyword required | ✓ | | |
| `layer: repository` or `layer: api` + keyword `fetch/load/list` | | ✓ | |
| `layer: ui` + description references data prop (`user.X`, `list.length`, `item?.field`) | | ✓ | |
| Any layer + numeric value, `size`, `limit`, `max`, `min` in description | | | ✓ |

**Invariant-backed regression (unconditional):**
A task generated to verify a UC `[INV-NN]` (its Context wikilinks `[[usecases/UC-Name#Invariants]]`)
MUST carry a regression-style `## Acceptance Criteria` whose every item is verifiable by command —
e.g. load a pre-change fixture → assert no throw, assert count preserved, assert no stray data.
A vague AC like "old board still works" FAILS L3-04 and the executor will gate-reject it.
This is the cost of absorbing the invariant into AC at *generation* time so the executor needs
zero awareness of where the invariant lives (Steps vs Invariants) — it just reads the task file.

**Exemptions — AC sub-sections are OPTIONAL (no L3 penalty if absent):**
```
task.type IN [INFRA, CONFIG, MIGRATION, DOCS]
```

**Dependency-blocked AC:**
If a required AC sub-section cannot be written because a dependency task is
not yet implemented (e.g., `ac_empty_state` requires a repository that doesn't
exist yet), annotate as follows instead of leaving the slot empty:
```markdown
- [ ] ⏳ BLOCKED: Empty state test pending [[TASK-NNN]] (repository not yet available)
```
Blocked ACs are captured in `scope-summary.md` as blockers — NOT penalized in L3.

---

## BDD Scenario Rules

`### 🧪 BDD Scenarios` is REQUIRED in `## Acceptance Criteria` when:
- `task.type: FEAT` AND (task has a user-actor OR task crosses a service/API/repository boundary)

**Exemptions:** CHORE · DOCS · MIGRATION · INFRA · SPIKE

**Format:**
```
**Scenario: [Plain-English name]**
Given [precondition — who/what is in what state]
When  [actor performs specific action]
Then  [expected observable outcome]
```

Rules:
- Minimum 1 scenario (happy path). Maximum 3 per task — fewer, more signal-rich.
- Each scenario must map to ≥1 item in `### ✅ Baseline` or `### 🔁 Inverse Conditions`.
- Scenarios describe behavior, not implementation — no class names or method calls.
- Never invent behavior not traceable to UC steps, domain model, or ux-behavior.

---

## Integration Flow Rules

`### 🔗 Integration Flow` is REQUIRED when the task crosses ≥1 service boundary:
- Layer 4+ tasks (HTTP controllers and above in STANDARD)
- Any task referencing an external service or third-party API
- Frontend tasks that call an API endpoint

**Format:**
```
**[Source layer] → [Target layer/service]**
Given [upstream caller/actor is in [state]]
When  [action triggers at [layer — e.g. POST /api/resource or Repository.save()]]
Then  [downstream side effect — DB row, event, response shape]
And   [caller receives — HTTP status + response body shape]
```

Rules:
- Name layers and surfaces explicitly: `POST /api/boards → BoardRepository.save() → DB: boards`
- Cover only the call chain this task owns — not the whole system.
- If a SPIKE is outstanding for this boundary: `⏳ UNVERIFIED — pending [[TASK-NNN-spike]]`
- Omit section (and note as blocked) if the integration design is not yet resolved.

---

## Non-Go Section (Mandatory)

Every task must explicitly state what is NOT in scope:

```markdown
## Non-Go (not in this task)
- Repository implementation → TASK-002
- API endpoints → TASK-004
- Frontend components → TASK-007
- Error handling for edge case X → TASK-009
```

This prevents Claude Code from over-implementing and breaking task boundaries.

---

## Context Section Format

The Context section gives Claude Code the minimum information to implement:

```markdown
## Context
Implement the `Order` aggregate as defined in [[domain-model#Aggregate-Order]].
The aggregate root must enforce the invariant: totalAmount = sum of lineItem subtotals.
See [[usecases/UC-CreateOrder#Input]] for the data shape entering the system.
Existing `User` entity is in `packages/shared/src/domain/user.ts` — reference for style.
```

Rules:
- Always wikilink to the source spec (not re-describe it)
- Point to existing code as style reference
- Mention constraints that aren't in the spec doc

---

## Implementation Notes Format

Optional hints — only include when there's a non-obvious implementation decision:

```markdown
## Implementation Notes
- Use `integer` for all monetary amounts (VND, no decimal). Never `float`.
- Drizzle enum: `pgEnum('order_status', ['draft', 'placed', 'paid', 'failed'])`
- Export both the table schema AND the inferred type:
  `export type Order = typeof orders.$inferSelect`
- Do NOT use Drizzle relations yet — that comes in TASK-003
```

---

## Task Numbering and Naming

```
TASK-001-[slug].md
TASK-002-[slug].md
...
TASK-010-[slug].md   ← zero-pad to 3 digits for sort order
```

Slug rules:
- Verb-noun format: `domain-schema`, `order-repository`, `create-order-usecase`
- No package name in slug (it's in frontmatter)
- Max 4 words

---

## Task Board (`tasks/_index.md`) Format

```markdown
# Task Board: [Feature Name]

| ID | Title | Package | Status | Priority | Depends On | Est. |
|----|-------|---------|--------|----------|------------|------|
| [[TASK-001\|TASK-001]] | Domain schema | shared | ⬜ ready | 1 | — | 4h |
| [[TASK-002\|TASK-002]] | Order repository | api | ⬜ ready | 2 | TASK-001 | 3h |
| [[TASK-003\|TASK-003]] | CreateOrder use case | api | ⬜ ready | 3 | TASK-002 | 4h |
```

Status emoji: ⬜ ready · 🔄 in-progress · 🚫 blocked · ✅ done

---

## Common Task Patterns for Monorepo

### Pattern: New Shared Schema

```
TASK-NNN: [Entity] schema + migration
Package: packages/shared
Acceptance:
- Schema file created
- Migration generated with drizzle-kit
- Types exported from index.ts
- pnpm --filter shared typecheck passes
```

### Pattern: Repository Implementation

```
TASK-NNN: [Entity]Repository implementation
Package: apps/api (or packages/shared if pure domain)
Acceptance — Baseline:
- Class implements interface from domain-model.md
- `pnpm --filter api test [file]` passes
Acceptance — Empty State (REQUIRED — layer=repository):
- findById returns null (not throws) when ID not found
- findAll returns [] (not null) when table is empty
- All methods handle DB connection error → throw RepositoryError, not raw DB error
Depends on: schema task
```

### Pattern: Use Case Implementation

```
TASK-NNN: [UseCaseName] use case
Package: apps/api
Acceptance — Baseline:
- `pnpm --filter api test [file]` passes
- Input validated: missing required field → throws UseCaseError with code E_XXX
- Output shape matches TypeScript interface in [[usecases/UC-Name#Output]]
Acceptance — Inverse:
- Unauthenticated caller → throws AuthError (not proceeds)
- Caller without [ROLE] permission → throws ForbiddenError
Acceptance — Empty State:
- ⏳ BLOCKED: integration test pending [[TASK-NNN]] (repository not yet available)
Depends on: repository task
```

### Pattern: HTTP Endpoint

```
TASK-NNN: [METHOD] /[path] endpoint
Package: apps/api
Acceptance:
- Route registered in router
- Request/response types match use case IO
- 401 when unauthenticated
- Integration test passes
Depends on: use case task
```

### Pattern: Frontend Feature

```
TASK-NNN: [ScreenName] component
Package: apps/web
Acceptance — Baseline:
- `pnpm --filter web typecheck` passes
- Implements all states from [[ux-behavior#ScreenName]]
- All RULE-XX from ux-behavior implemented
- All error codes from error catalog handled
Acceptance — Inverse (REQUIRED — layer=ui):
- [Primary CTA] does NOT render in loading state
- [Primary CTA] does NOT render when user lacks permission [ROLE]
Acceptance — Empty State (REQUIRED — data-driven UI):
- EmptyState renders when API returns []
- No crash when `[primaryDataProp]` is null on first render
Acceptance — Boundary:
- [Input field] rejects input > [N] characters with inline error
```

### Pattern: Integration Test

```
TASK-NNN: Integration test — [use-case or feature name]
Package: apps/api/test | apps/web/e2e | e2e/
Layer: integration
Depends on: all implementation tasks for this feature (HTTP endpoint task minimum)
Estimated: 2–4h

Acceptance — Baseline:
- `pnpm --filter [pkg] test:integration [file]` passes
- [METHOD] /api/[resource] with valid auth → [expected status] + expected body shape
- DB round-trip confirmed: persisted record matches submitted payload
- Unauthenticated request → 401

Acceptance — BDD Scenarios (REQUIRED — FEAT + cross-boundary):

  Scenario: Happy-path round-trip
  Given an authenticated user with [role]
  When  [METHOD] /api/[resource] is called with valid payload
  Then  [expected status] response with {id, [fields]}
  And   DB row exists in [table] matching the submitted payload

  Scenario: Auth rejection
  Given an unauthenticated caller
  When  [METHOD] /api/[resource] is called
  Then  401 Unauthorized with no side effects in DB

Acceptance — Integration Flow (REQUIRED — cross-service):

  POST /api/[resource] → [UseCase].execute() → [Repository].save() → DB: [table]
  Given authenticated request arrives at [Controller]
  When  use case validates + persists via repository
  Then  DB row committed; response body matches [[contracts/[repo].contract.md#Response]]
  And   domain event [EventName] published (if applicable)

Non-Go:
- Performance / load testing → separate task
- UI E2E / Playwright flows → separate TASK-NNN
```

---

## Discovered-Task Reconciliation (`--tasks-only`)

Used by `--tasks-only --from-discovered <ledger>` at a round boundary. This is a pure
reducer: read existing state + the ledger delta, emit new state. The pitch and the
upfront DDD layer are FROZEN — this mode never re-runs Phase 1–5.

**Single anchor, no branch.** Every reconciled task anchors `use_case_refs` to exactly one
trust source: a UC. There is no second coverage trust (no `scope`/`invariant` frontmatter on
tasks). Scope (Basecamp sense) maps onto a UC; an invariant lives *inside* the UC it came from.

**Reconcile loop:**
```
1. Verify the ledger belongs to this spec. A discovered ledger rarely carries a pitch_hash
   (its frontmatter names the raw materials, e.g. source: shaping.md + breadboard.md).
   So match on identity that DOES exist:
     a. ledger.feature == run-state.feature   (REQUIRED — mismatch → STOP)
     b. if ledger carries pitch_hash, it must == run-state.pitch_hash
   Neither resolvable → STOP: "ledger does not match this spec (different feature slug)."
2. READ-ONLY for the frozen zone: domain-model, usecases/ (Steps), ux-behavior, contracts/.
3. Parse ledger scopes → map each to its owning UC (S1→UC-…, S2→UC-…, S3→UC-…).
   A ledger scope with no matching UC, and that introduces a NEW actor/action,
   is NOT a discovered task — it is a shaping miss. STOP and escalate to PO.
   (Spawning a new UC mid-cycle = silent re-shaping = anti-Shape-Up.)
4. Parse discovered items under each scope's "Discovered" section:
     [+] Keep      → new task to generate
     ~  / Cut      → append a row to synthesis "Hammered Out (Cut)" — NO file
     [ ] already has a file → skip
5. For a Keep item that asserts a new invariant on its scope's UC:
     APPEND an [INV-NN] line to that UC's ## Invariants section (append-only,
     never touch Steps/Input/Output). Log the UC path in run-state.human_edited_files.
     Generate the regression task with command-verifiable AC (see AC Trigger Matrix).
6. Number new tasks by reading max id in tasks/_index.md and incrementing.
   NEVER renumber existing tasks — that would break every depends_on wikilink the
   executor has already resolved.
7. Regenerate ONLY the derived files: tasks/_index.md, scope-summary.md, synthesis.md.
8. Run Phase 7b Appetite Guard (below). Update run-state: discovered_rounds += 1.
```

**Appetite Guard (forcing function, not a report):**
```
appetite_hours = parse from pitch frontmatter (e.g. ~3 weeks → hours)
keep_hours     = Σ estimated_hours over tasks with status ≠ cut
IF keep_hours > appetite_hours:
   ⏸ print HAMMER prompt — surface the overflow + candidate cuts (must→nice),
     then WAIT. Never auto-resolve. Options offered:
       cut TASK-NNN | shrink the new task's scope | expand appetite (needs PO re-bet)
```
This is scope hammering at the gate boundary — the overflow is surfaced, never silently absorbed.
