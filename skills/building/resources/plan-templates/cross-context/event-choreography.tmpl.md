---
type: event-choreography
feature: FEATURE_SLUG
skill_version: "2.5"
contexts: []
events: []
tags: [cross-context, events]
depends_on: ["[[_cross-context/context-map]]"]
status: draft
---

# Event Choreography: FEATURE TITLE

> Sequence of domain events flowing across bounded contexts.
> Includes dead-letter and timeout scenarios.

---

## Happy Path Sequence

```
UC-[Name] triggers:

  [Context A]            [Context B]            [Context C]
       │                      │                      │
       │──EventName1──────────►│                      │
       │                      │──EventName2──────────►│
       │                      │                      │──SideEffect
       │◄─────────────────────│                      │
       │──EventName3           │                      │
       │                      │                      │
```

---

## Event Register

| Event | Emitted By | Consumed By | Payload Fields | Schema Ref |
|-------|-----------|------------|---------------|-----------|
| `EventName1` | [Context A] :: UC-Name | [Context B] | id, field1, field2 | [[domain-model#Events]] |
| `EventName2` | [Context B] | [Context C] | id, field1 | [[context-b/domain-model#Events]] |

---

## Failure Scenarios

| Scenario | Trigger | Impact | Recovery Strategy |
|----------|---------|--------|------------------|
| `EventName2` never arrives | [Context B] crash | [Context C] stuck in pending | Timeout N min → auto-cancel + emit `EventName2Timeout` |
| [Context C] rejects `EventName2` | schema mismatch | silent failure | Dead-letter queue → alert → manual replay |
| Duplicate `EventName1` | retry storm | double-process | Idempotency key on `EventName1.id` |

---

## Timeout Register

| Event | Timeout | Owner Context | Action on Timeout |
|-------|---------|--------------|------------------|
| `EventName1` → `EventName2` | N minutes | [Context A] | emit `CancelRequested` |
| `EventName2` → SideEffect | N minutes | [Context B] | retry × 3 → dead-letter |

---

## Dead-Letter Strategy

```
Dead-letter queue: [queue-name]

On failure:
  1. Log event payload + error + context
  2. Retry: N times with exponential backoff (base: Ns, max: Ns)
  3. After max retries: move to DLQ
  4. Alert: [channel/mechanism]
  5. Manual replay: [command or runbook reference]

User impact: [none / degraded / blocked — describe]
```
