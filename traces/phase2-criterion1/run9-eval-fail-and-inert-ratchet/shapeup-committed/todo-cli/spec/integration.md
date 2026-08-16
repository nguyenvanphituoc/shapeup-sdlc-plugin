---
type: integration
feature: todo-cli
affected_services: [filesystem]
domain_events_consumed: []
domain_events_produced: []
tags: [integration, cli]
depends_on: ["[[domain-model]]", "[[usecases/_index]]"]
status: draft
---

# Integration Map: `todo` CLI

## Impact Summary

| System | Severity | Direction | Summary |
|--------|----------|-----------|---------|
| Filesystem (`~/.todo.json`) | 🟡 single external dependency | ↔ read/write | Every command reads the store; `add`/`done`/`rm` also write it |

There are no other systems: no network calls, no database, no third-party API, no accounts —
all explicitly excluded by the pitch's no-gos. This section exists (standard lens) to make that
absence explicit and auditable, not to describe a rich integration surface.

---

## Filesystem

**Severity:** 🟡 Isolated but load-bearing — the whole feature is unusable if this one
dependency misbehaves, so its error handling is the pitch's stated hard requirement.
**Direction:** ↔ reads on every command, writes on `add`/`done`/`rm`

### What Changes
A new file, `~/.todo.json`, is created on the first successful `add` (or left absent until
then — `list` on a missing file is not an error, per [[ux-behavior#list-command]]). No other
file on disk is touched.

### Data Flow
```
[bin/todo.js] ──fs.readFileSync──► [~/.todo.json]
[bin/todo.js] ──fs.writeFileSync──► [~/.todo.json]   (add / done / rm only)
```
payload: JSON array of `{ text: string, done: boolean }` — see [[contracts/todo-repository.contract]]

### Risk
An unguarded `JSON.parse` on a corrupted file crashes the whole process with a raw stack trace
instead of the plain-English error the pitch requires (spike-confirmed in
`.shapeup/todo-cli/orient/spike-store-parsing.md`). A partial write on a filesystem error could
also silently corrupt a previously-healthy store.

### Mitigation
- `TodoRepository.load()` wraps `JSON.parse` in try/catch and returns a typed
  `StoreCorruptedError`, never lets the exception propagate — see
  [[contracts/todo-repository.contract#Method-load-Read]].
- `TodoRepository.save()` builds the full JSON string in memory before the single
  `writeFileSync` call — no partial write is observable even under a failure mid-write of a
  previous attempt.

### Related Use Cases
- [[usecases/UC-AddTodo]] — the UC whose tasks implement the write path
- [[usecases/UC-ListTodos]] — the UC whose tasks implement the read-only path
- [[usecases/UC-CompleteTodo]] — the UC whose tasks implement the mutate-in-place write path
- [[usecases/UC-RemoveTodo]] — the UC whose tasks implement the mutate-and-shrink write path

---

## Event Coordination

| Event | Producer | Consumers | Deploy Order |
|-------|----------|-----------|-------------|
| — | — | — | No domain events in this feature (single-process CLI, no other context to notify) |

---

## Environment Variables Required

| Variable | Service | Purpose |
|----------|---------|---------|
| — | — | None — the store path (`~/.todo.json`) is fixed, not configurable in this cycle (see [[domain-model#Bounded-Context]] decision) |
