---
type: context-map
feature: FEATURE_SLUG
skill_version: "2.5"
contexts: []
relationships: []
tags: [cross-context, ddd]
depends_on: []
status: draft
---

# Context Map: FEATURE TITLE

> Maps relationships between bounded contexts involved in this feature.
> Relationship types follow Evans DDD vocabulary.

---

## Context Diagram

```
[Context A] ──publishes──► EventName ──────────────► [Context B]
                                                            │
[Context C] ──provides──► EntityName ─────────────► [Context A]
                                                            │
[Context D] ◄──subscribes── EventName                      │
       │                                                    │
       └──publishes──► EventName2 ──────────────────► [Context A]
```

---

## Relationship Register

| From Context | To Context | Type | Contract |
|-------------|-----------|------|----------|
| [Context A] | [Context B] | Customer/Supplier | [[contracts/[repo].contract.md]] |
| [Context B] | [Context C] | Conformist | [Context C] sets schema |
| [Context D] | External | Anti-corruption | [[api-feasibility#API-01]] |

**Relationship types:**
- **Customer/Supplier** — downstream depends on upstream; upstream team sets contract
- **Conformist** — downstream conforms to upstream schema with no negotiation
- **Anti-corruption Layer** — downstream wraps upstream behind its own abstraction
- **Shared Kernel** — both contexts share a subset of domain model (use sparingly)
- **Published Language** — upstream publishes a well-defined schema; downstream consumes

---

## Context Responsibilities

| Context | Owns | Does NOT Own |
|---------|------|-------------|
| [Context A] | [entity list] | [boundary note] |
| [Context B] | [entity list] | [boundary note] |

---

## Integration Points

| Event / Data | Producer | Consumer(s) | Coupling Risk |
|-------------|---------|------------|--------------|
| `EventName` | [Context A] | [Context B], [Context C] | 🔴 high — 2 consumers |
| `EntityName` | [Context C] | [Context A] | 🟡 medium |
