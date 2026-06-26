---
type: usecase
feature: FEATURE_SLUG
id: UC-[Name]
bounded_context: CONTEXT
actor: Customer | Admin | System
entities: []
repositories: []
domain_events_emitted: []
tags: []
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
related_tasks: []
status: draft
---

# Use Case: [Name]

## Summary
[One sentence: Actor does X which results in Y.]

## Preconditions
- [condition that must be true before this use case can execute]

## Input

```typescript
interface [UseCaseName]Input {
  // fields from [[ux-behavior#ScreenName]] form
}
```

## Steps

```
1. Validate input schema
2. [Load aggregate from repository]
3. [Call domain method — business logic stays in aggregate]
4. [Repository.save()]
5. [Publish domain event]
6. Return output
```

## Output

```typescript
interface [UseCaseName]Output {
  // fields returned to caller
}
```

## System Flow

<!--
  Trace the full path this use case travels from UI trigger to data persistence.
  Include only layers relevant to the current lens. Remove if a SPIKE is unresolved.
-->

```
[UI: ScreenName → CTA/event]
  → [API: METHOD /endpoint]
    → [Use Case: Actor.action()]
      → [Repository.method() → DB: table_name]
        ← [Domain Event: EventName emitted (if any)]
```

## Invariants

<!--
  An invariant must STILL hold after this UC is built.
  Each invariant is a source of regression tasks — that task anchors use_case_refs back to THIS UC
  (do NOT create a new anchor axis; an invariant is a property of the UC, not a UC of its own).
  This section MAY be APPENDED by `--tasks-only` when a build discovers a new constraint
  (append-only — never edit the locked Steps/Input/Output).
  Drop this section if the UC produces no invariants.
-->
- [INV-01] [Short invariant description — e.g. "A board saved before this cycle (old schema) loads without error and without data loss"]

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `[CODE]` | [when] | 400/404/409/422 | [description] |

## Test Surface

<!--
  DERIVED section — generated mechanically from Invariants (D1) + Error Cases (D2) +
  Contract/Input shape (D3) + pitch No-gos touching this UC (D4).
  Rules → references/test-surface.md. Never hand-author rows; never invent behaviors.
  Regenerable via `--surface-only`. Appended-to (TS-INV rows) by `--tasks-only` when
  a new invariant lands. Exploratory/edge tests do NOT live here (qa-edge-hunter owns those).
  If all four sources are empty, replace the table with:
  _No derivable surface — sources empty. Exploratory coverage only (see qa-edge-hunter)._
  Oracle = how the evaluator verifies the row (ui|process|test|snapshot|http); default ui.
  Non-ui when this UC's deliverable has no browser (CLI/library/service). See references/test-surface.md.
-->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | ui | [action that would violate INV-01] | [rejection + state unchanged] | D1: INV-01 |
| TS-ERR-[CODE] | http | [trigger the Condition] | [error code + HTTP status] | D2 |
| TS-REQ-[field]-missing | http | [omit required field] | [400 validation, no side effect] | D3 |
| TS-NOGO-[NN] | ui | [attempt the excluded behavior] | [blocked/absent] | D4 |

## Integration Points
- → [[integration#[service-section]]] — [what flows out]
- ← [[ux-behavior#[ScreenName]]] — triggered by [which CTA/event]
