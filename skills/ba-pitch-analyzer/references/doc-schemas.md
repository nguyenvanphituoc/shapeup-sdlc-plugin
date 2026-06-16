# Document Schemas — Frontmatter Taxonomy

Shared vocabulary used across all document types. Every field listed here uses the same
values so wikilinks and tag queries work consistently across the spec tree.

---

## Shared Taxonomy Fields

```yaml
# TYPE — document classification
type: pitch | domain-model | ux-spec | usecase | integration | task
     | assess-report | run-state | context-map | event-choreography
     | migration-plan | team-handoff | synthesis

# FEATURE — namespace for the entire spec tree (kebab-case)
feature: checkout-vnpay

# LENS — architectural perspective used when generating this document
# Determines which phases ran and which documents are authoritative
lens: lite | standard | cross-context

# BOUNDED CONTEXT — DDD context that owns this feature
bounded_context: ordering | inventory | identity | notification | payment

# STATUS — lifecycle state
status: draft | ready | in-progress | blocked | done

# ENTITIES — domain entities referenced or defined
entities: [Order, LineItem, Payment]

# REPOSITORIES — repository interfaces referenced or defined
repositories: [OrderRepository, PaymentRepository]

# USECASES — use case IDs referenced (e.g. UC-CreateOrder)
usecases: [UC-CreateOrder, UC-InitiatePayment]

# TAGS — free-form, for cross-cutting search
tags: [payment, vnpay, checkout, mobile]

# DEPENDS_ON — wikilinks to docs this doc depends on
depends_on: ["[[_index]]", "[[domain-model]]"]
```

---

## Lens-Aware Document Authority

Each lens has a **central document** — the most detailed and authoritative spec.
Other documents exist but are less exhaustive.

| Lens | Central Document | Secondary | Skipped |
|------|-----------------|-----------|---------|
| `lite` | `ux-behavior.md` | domain-model, usecases, tasks | contracts/, integration.md, synthesis S-02/S-03 |
| `standard` | `contracts/` | domain-model, ux-behavior, usecases, integration, synthesis full | — |
| `cross-context` | `_cross-context/` | all standard docs per context | — |

When upgrading `lite → standard`:
- `ux-behavior.md` stays authoritative for screen specs
- Use cases are **reconciled** (API boundary sub-section added, not overwritten)
- `contracts/` generated from reconciled UC API sub-sections
- Reconciled files flagged in `run-state.md`

---

## Schema Per Document Type

### `_index.md` — Pitch Digest

```yaml
---
type: pitch
feature: [slug]
appetite: "6 weeks"              # Shape Up time box
status: draft | ready
bounded_context: [context]
entities: []
tags: []
---
```

Required sections: Problem, Appetite, Boundaries, Breadboarding, Rabbit Holes, Document Map

---

### `domain-model.md` — DDD Model

```yaml
---
type: domain-model
feature: [slug]
bounded_context: [context]
entities: []
value_objects: []
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: draft | ready
---
```

Required sections: Bounded Context, Aggregates (one subsection each), Value Objects table,
Domain Events table, Repository Interfaces (TypeScript interface blocks)

---

### `ux-behavior.md` — UX Spec

```yaml
---
type: ux-spec
feature: [slug]
entities: []
usecases: []
screens: []                      # list of screen/view names
tags: [ux]
depends_on: ["[[domain-model]]"]
status: draft | ready
---
```

Required sections: Screen Flow (ASCII diagram), one section per Screen with:
- States table, Behavior Rules list, Error States table

---

### `usecases/UC-[Name].md` — Use Case

```yaml
---
type: usecase
feature: [slug]
id: UC-[Name]                    # PascalCase, must be unique in feature
bounded_context: [context]
actor: Customer | Admin | System
entities: []
repositories: []
domain_events_emitted: []
tags: []
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
related_tasks: []                # [[tasks/TASK-NNN-slug]] links
status: draft | ready
---
```

Required sections: Summary (1 sentence), Preconditions, Input (TS interface), Steps
(numbered application layer), Output (TS interface), Error Cases table, Integration Points

---

### `usecases/_index.md` — Use Case Index

```yaml
---
type: usecase-index
feature: [slug]
tags: []
---
```

Required: table of all UCs with columns: ID | Title | Actor | Status | Depends On
Plus: dependency diagram (ASCII or mermaid)

---

### `integration.md` — System Impact Map

```yaml
---
type: integration
feature: [slug]
affected_services: []            # internal services, external APIs
domain_events_consumed: []
domain_events_produced: []
tags: [integration]
depends_on: ["[[domain-model]]", "[[usecases/_index]]"]
status: draft | ready
---
```

Required sections: Impact Summary, one subsection per affected system with:
Data Flow, Trigger, Risk, Mitigation

---

### `tasks/TASK-NNN-slug.md` — Task

```yaml
---
type: task
feature: [slug]
id: TASK-[NNN]                   # zero-padded 3 digits: TASK-001
title: "[imperative verb phrase]"
lens: lite | standard            # inherited from run-state
package: apps/api | apps/web | packages/shared | apps/mobile
status: ready | in-progress | blocked | done
priority: [integer]              # 1 = highest
depends_on: []                   # other TASK IDs: [TASK-001, TASK-002]
unlocks: []                      # tasks that become unblocked when this is done
use_case_refs: []                # UC IDs this task implements: [UC-CreateOrder]
entities: []
repositories: []
linked_docs: []                  # [[usecase]], [[domain-model#section]]
estimated_hours: [number]
tags: []
---
```

Required sections: Context (2-3 sentences with wikilink to spec), Acceptance Criteria
(checkboxes, all verifiable by command), Implementation Notes (optional hints),
Non-go (what is explicitly NOT in scope for this task)

---

### `tasks/_index.md` — Task Board

```yaml
---
type: task-board
feature: [slug]
tags: []
---
```

Required: table with columns: ID | Title | Package | Status | Priority | Depends On | Est.Hours
Sorted by priority ascending. Status uses emoji: ⬜ ready | 🔄 in-progress | 🚫 blocked | ✅ done

---

## Wikilink Conventions

```markdown
[[_index]]                           # pitch digest
[[domain-model]]                     # full domain model doc
[[domain-model#Aggregate-Order]]     # specific section
[[ux-behavior#CheckoutScreen]]       # specific screen
[[usecases/UC-CreateOrder]]          # specific use case
[[usecases/_index]]                  # use case index
[[integration]]                      # integration map
[[tasks/TASK-001-domain-schema]]     # specific task
[[tasks/_index]]                     # task board
```

Always use wikilinks (double brackets), never relative paths like `../domain-model.md`.
