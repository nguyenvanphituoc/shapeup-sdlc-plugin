---
type: integration
feature: todo-cli
affected_services: [local-filesystem-store]
domain_events_consumed: []
domain_events_produced: []
tags: [integration, cli]
depends_on: ["[[domain-model]]", "[[usecases/_index]]"]
status: ready
---

# Integration Map: `todo` CLI

## Impact Summary

| System | Severity | Direction | Summary |
|--------|----------|-----------|---------|
| Local filesystem store | 🟢 Isolated | ↔ | Single JSON file, read on every command, written on `add`/`done`/`rm` |

This feature has exactly one external touchpoint. No network, no server, no second process, no
shared database — the Non-Go list rules those out by design.

---

## Local filesystem store

**Severity:** 🟢 Isolated
**Direction:** ↔ read + write

### What Changes
`bin/todo` reads and writes one JSON file whose path is resolved from `$TODO_STORE` (verbatim)
or `~/.todo.json` (default). No other process or system touches this file as part of this
feature.

### Data Flow
```
[bin/todo <cmd>] ──load()──► [store file] ──items[]──► [use case logic]
                                                              │
[bin/todo <cmd>] ◄──save()── [store file] ◄──items[]────────┘
```

### Risk
- A corrupted store (hand-edited, truncated, or from an incompatible future schema) could crash
  every command with an unhandled traceback if the load boundary doesn't catch it.
- A crash mid-`save()` could leave the store half-written, worse than the corruption it started
  with, if the write isn't atomic.

### Mitigation
- All four use cases route `load()` failures through the single `StoreCorruptedError` →
  `error: corrupted store at <path>` → exit 1 path (never a bare traceback) — see
  [[contracts/todo-store.contract.md#Error-Cases]].
- `save()` uses `tempfile.mkstemp` + `os.replace` (atomic on POSIX) — spiked and confirmed in
  Orient; a future edit that regresses this to a plain `open(path, "w")` would silently
  reintroduce the mid-write corruption risk (code-level note, not independently black-box
  testable — see [[contracts/todo-store.contract.md#Method-savepath-items-Write]]).

### Related Use Cases
- [[usecases/UC-AddTodo]] — writes on success
- [[usecases/UC-ListTodos]] — read-only
- [[usecases/UC-CompleteTodo]] — writes on success
- [[usecases/UC-RemoveTodo]] — writes on success

---

## Event Coordination

| Event | Producer | Consumers | Deploy Order |
|-------|----------|-----------|-------------|
| — | none — this feature produces no domain events (see [[domain-model#Domain-Events]]) | — | — |

---

## Environment Variables Required

| Variable | Service | Purpose |
|----------|---------|---------|
| `TODO_STORE` | local filesystem store | Optional. Overrides the default store path (`~/.todo.json`) verbatim when set — the sandboxing seam the pitch requires so tests can point the CLI at a throwaway file. |
