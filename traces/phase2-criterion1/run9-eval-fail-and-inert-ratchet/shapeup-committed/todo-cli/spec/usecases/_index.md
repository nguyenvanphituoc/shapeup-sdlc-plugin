---
type: usecase-index
feature: todo-cli
tags: [cli]
---

# Use Case Index: `todo` CLI

| ID | Title | Actor | Status | Depends On |
|----|-------|-------|--------|------------|
| [[UC-AddTodo]] | Add Todo | Developer | draft | [[domain-model]], [[ux-behavior]] |
| [[UC-ListTodos]] | List Todos | Developer | draft | [[domain-model]], [[ux-behavior]] |
| [[UC-CompleteTodo]] | Complete Todo | Developer | draft | [[domain-model]], [[ux-behavior]] |
| [[UC-RemoveTodo]] | Remove Todo | Developer | draft | [[domain-model]], [[ux-behavior]] |

## Dependency Diagram

```
[domain-model] ──► [UC-AddTodo]      ──┐
       │       ──► [UC-ListTodos]    ──┤
       │       ──► [UC-CompleteTodo] ──┼──► all share TodoRepository (load/save)
       │       ──► [UC-RemoveTodo]   ──┘         over the same ~/.todo.json file
       ▼
[ux-behavior] (command states + error catalog, shared by all four)
```

All four use cases are independent at the argv-dispatch level (no UC calls another UC) but share
one aggregate (`TodoStore`) and one repository (`TodoRepository`) — see [[domain-model]].
