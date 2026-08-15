---
type: integration
feature: todo-cli
affected_services: [local-filesystem]
domain_events_consumed: []
domain_events_produced: [TodoItemAdded, TodoItemCompleted, TodoItemRemoved]
tags: [integration, cli]
depends_on: ["[[domain-model]]", "[[usecases/_index]]"]
status: draft
---

# Integration Map: `todo` CLI

## Impact Summary

| System | Severity | Direction | Summary |
|--------|----------|-----------|---------|
| Local filesystem (`./.todo.json`) | 🟢 Isolated | ↔ | Single-process CLI reads/writes one JSON file in the cwd; no network, no other service |

There is no cross-context or cross-service integration in this feature (no-gos: no sync, no
server, no accounts) — this document exists per the standard lens but is intentionally thin.

---

## Local Filesystem

**Severity:** 🟢 Isolated
**Direction:** ↔ read + write

### What Changes
`todo` reads and writes a single file, `./.todo.json`, in the process's current working
directory. No other file, environment variable, or external process is touched.

### Data Flow
```
[todo add/done/rm] ──write (temp+rename)──► ./.todo.json
[todo list/add/done/rm] ◄──read────────────  ./.todo.json
```

### Risk
The only silent-failure risk is a corrupted or partially-written store file — de-risked by
`.shapeup/todo-cli/orient/spike-persistence.md` (temp-file + `rename` write pattern, `ENOENT`
vs. `SyntaxError` distinction on read). A residual, accepted risk: two `todo` processes
racing to write concurrently is last-writer-wins (no lock/merge) — out of scope per the pitch
(no server/sync requirement).

### Mitigation
- Write path always goes through `TodoStoreRepository.save()` (temp file + `fs.renameSync`),
  never a direct `fs.writeFileSync` on the real path — see `[[contracts/todo-store.contract]]`.
- Read path always distinguishes `ENOENT` (empty list) from `SyntaxError`/shape mismatch
  (`StoreCorruptedError`) — never conflates the two.

### Related Use Cases
- [[usecases/UC-AddTodo]] — writes
- [[usecases/UC-ListTodos]] — reads
- [[usecases/UC-CompleteTodo]] — reads + writes
- [[usecases/UC-RemoveTodo]] — reads + writes

---

## Event Coordination

| Event | Producer | Consumers | Deploy Order |
|-------|----------|-----------|-------------|
| `TodoItemAdded` | this feature | none — single-process CLI | n/a |
| `TodoItemCompleted` | this feature | none | n/a |
| `TodoItemRemoved` | this feature | none | n/a |

These events are recorded in `[[domain-model]]` for DDD traceability only; there is no event
bus or subscriber in a single-process CLI, so no deploy-order coordination applies.

---

## Environment Variables Required

None. The store path is a fixed, cwd-relative literal (`./.todo.json`) — this is the pinned
decision from the pitch's open question (see `[[_index#Boundaries]]`), chosen specifically to
avoid needing `HOME`/env-var configuration for a "zero-config" tool.
