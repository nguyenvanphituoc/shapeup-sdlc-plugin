---
type: domain-model
feature: FEATURE_SLUG
bounded_context: CONTEXT
entities: []
value_objects: []
domain_events: []
repositories: []
tags: [ddd]
depends_on: ["[[_index]]"]
status: draft
---

# Domain Model: FEATURE TITLE

## Bounded Context
`CONTEXT` context — owns [describe what this context is responsible for].
[Note any context boundaries: what this context does NOT own]

---

## Aggregate: [Name]

**Aggregate Root:** `[EntityName]`

**Invariants:**
- [invariant 1 — must be enforced by the aggregate root]
- [invariant 2]

```
[EntityName] (Aggregate Root)
├── id: [EntityName]Id (VO)
├── status: [EntityName]Status ([value1] | [value2] | [value3])
├── [field]: [Type]
└── [childEntity]: [ChildEntity][] (Entity, owned by root)
    ├── id: [ChildEntity]Id (VO)
    └── [field]: [Type]
```

**State Transitions:**
```
[state1] ──[method()]──► [state2] ──[method()]──► [state3]
                              └───[method()]────► [state4]
```

---

## Value Objects

| Value Object | Fields | Invariants |
|---|---|---|
| `[Name]Id` | value: string | UUID v4 format |
| `[Name]` | [fields] | [rule] |

---

## Domain Events

| Event | Emitted When | Payload Fields | Consumers |
|---|---|---|---|
| `[EntityName][PastTense]` | [trigger] | id, [fields] | [other contexts] |

---

## Repository Interfaces

```typescript
interface [EntityName]Repository {
  findById(id: [EntityName]Id): Promise<[EntityName] | null>
  save(entity: [EntityName]): Promise<void>
  // [named business queries]
}
```

---

## Related
- [[ux-behavior]] — screen states map to aggregate status values
- [[usecases/_index]] — use cases that operate on this aggregate
