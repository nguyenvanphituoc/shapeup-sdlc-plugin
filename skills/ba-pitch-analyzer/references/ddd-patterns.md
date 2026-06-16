# DDD Patterns — Domain Modeling Guide

Reference for Phase 2 of the BA Pitch Analyzer. Read this before writing `domain-model.md`.

---

## Bounded Context Decision

Ask these questions from the pitch:

1. **Who owns the data lifecycle?** The context that creates AND deletes an entity owns it.
2. **What crosses a context boundary?** Cross-context = domain event or anti-corruption layer, never direct DB join.
3. **Does this pitch create a new context or extend existing?** Extending = add to existing `domain-model.md`. New = create new bounded context folder.

### Common Bounded Contexts (reference for monorepo)

| Context | Owns | Does NOT own |
|---------|------|-------------|
| `ordering` | Order, LineItem, Cart | Product catalog, Stock levels |
| `inventory` | StockItem, Warehouse | Order details |
| `identity` | User, Session, Role | Profile preferences |
| `payment` | Payment, PaymentAttempt | Order totals |
| `notification` | Message, Channel, Template | Business triggers |

---

## Aggregate Design Rules

### Identifying Aggregate Roots

An entity is an Aggregate Root if:
- Other entities can't exist without it (LineItem can't exist without Order)
- It enforces invariants across child entities
- It's the entry point for all external writes

### Invariant Checklist

For every aggregate, document at least one invariant:
- `Order.totalAmount` must equal sum of `LineItem.subtotals`
- `Order` can only transition: `draft → placed → paid | failed`
- `PaymentAttempt` count must not exceed 3 per `Payment`

### Aggregate Size Heuristic

- **Too large:** aggregate has more than 3-4 entity types → split
- **Too small:** every operation needs to load 3 aggregates → merge
- **Right size:** one transaction boundary, one invariant set

---

## Value Object Patterns

Value Objects have no identity — equality is by value, not ID.

```typescript
// ✅ Value Object — no ID field
class Money {
  constructor(
    readonly amount: number,   // integer cents/VND — no float
    readonly currency: 'VND' | 'USD'
  ) {
    if (amount < 0) throw new DomainError('Money cannot be negative')
  }
  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency
  }
}

// ✅ Value Object — wraps primitive with validation
class OrderId {
  constructor(readonly value: string) {
    if (!isUUID(value)) throw new DomainError('Invalid OrderId')
  }
}
```

When to use VO vs Entity:
- Has identity that persists across mutations → Entity
- Replaced entirely when changed → Value Object
- Examples of VOs: Money, Address, Email, PhoneNumber, DateRange, Coordinates

---

## Domain Event Patterns

### Naming Convention
`[AggregateRoot][PastTense]` — e.g., `OrderPlaced`, `PaymentConfirmed`, `UserRegistered`

### Event Payload Design
```typescript
// Include: what happened, when, who, minimal context for consumers
interface OrderPlaced {
  eventId: string          // UUID
  occurredAt: Date
  orderId: string
  customerId: string
  totalAmount: number
  lineItemCount: number
  // Do NOT include: full line items, customer PII, computed fields
}
```

### Event → Consumer Mapping Table Format
```
| Event | Emitted By | Consumed By | Purpose |
|-------|------------|-------------|---------|
| OrderPlaced | ordering ctx | inventory ctx | Reserve stock |
| OrderPlaced | ordering ctx | notification ctx | Send confirmation |
| PaymentConfirmed | payment ctx | ordering ctx | Transition order to paid |
```

---

## Repository Interface Rules

1. **Return domain objects, not DTOs** — `findById` returns `Order`, not `OrderRow`
2. **No query logic in interface** — business queries get named methods
3. **Async always** — all methods return `Promise<T>`
4. **Soft-delete pattern** — if entities are soft-deleted, interface reflects it

```typescript
// ✅ Well-designed repository interface
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>
  findByCustomer(customerId: string, limit: number): Promise<Order[]>
  findPendingPayment(): Promise<Order[]>         // named business query
  save(order: Order): Promise<void>              // insert or update
  // NO: findAll(), count(), rawQuery()
}
```

---

## Anti-Patterns to Flag in Pitch Analysis

When reading a pitch, look for these and document them as **Rabbit Holes**:

| Anti-Pattern | Symptom | Better Approach |
|---|---|---|
| Shared DB table | "Both services read the orders table" | Domain events + projection |
| Aggregate too large | "Order contains everything incl. shipping" | Split shipping to own aggregate |
| Anemic domain | "Service layer contains all business logic" | Move invariants into aggregate |
| Primitive obsession | `userId: string` everywhere | Typed `UserId` value object |
| Missing domain event | State change with no downstream consumer | Add event even if no consumer yet |

---

## Template: Aggregate Section in domain-model.md

```markdown
## Aggregate: [Name]

**Aggregate Root:** `[EntityName]`
**Invariants:**
- [invariant 1]
- [invariant 2]

\`\`\`
[EntityName] (Aggregate Root)
├── id: [EntityName]Id (VO)
├── status: [EntityName]Status ([values])
├── [field]: [Type]
└── [childEntity]: [ChildEntity][] (Entity, owned)
    ├── id: [ChildEntity]Id
    └── [field]: [Type]
\`\`\`

**State Transitions:**
\`\`\`
draft ──place()──► placed ──confirm()──► confirmed
                       └───fail()────► failed
\`\`\`
```
