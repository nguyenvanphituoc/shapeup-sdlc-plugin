---
type: integration
feature: FEATURE_SLUG
affected_services: []
domain_events_consumed: []
domain_events_produced: []
tags: [integration]
depends_on: ["[[domain-model]]", "[[usecases/_index]]"]
status: draft
---

# Integration Map: FEATURE TITLE

## Impact Summary

| System | Severity | Direction | Summary |
|--------|----------|-----------|---------|
| [package/service] | 🔴/🟡/🟢 | →/←/↔ | [one line] |

---

## [Package / Service Name]

**Severity:** 🟢 Isolated
**Direction:** → produces

### What Changes
[1-3 sentences]

### Data Flow
```
[Feature] ──[event / call]──► [Service]
           payload: { field1, field2 }
```

### Risk
[What breaks silently if coordination is missed]

### Mitigation
[How to prevent]

### Related Tasks
- [[tasks/TASK-NNN-slug]]

---

<!-- Repeat section for each affected system -->

---

## Event Coordination

| Event | Producer | Consumers | Deploy Order |
|-------|----------|-----------|-------------|
| `[EventName]` | this feature | [service A, service B] | consumers first |

---

## Environment Variables Required

| Variable | Service | Purpose |
|----------|---------|---------|
| `[VAR_NAME]` | [service] | [what it's for] |
