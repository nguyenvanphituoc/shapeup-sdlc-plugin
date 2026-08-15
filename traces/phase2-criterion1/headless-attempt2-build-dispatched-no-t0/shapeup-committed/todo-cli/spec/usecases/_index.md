---
type: usecase-index
feature: todo-cli
tags: [cli]
---

# Use Case Index: `todo` CLI

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[UC-AddTodo]] | Add a todo item | Developer | draft | — |
| [[UC-ListTodos]] | List todo items | Developer | draft | — |
| [[UC-CompleteTodo]] | Mark a todo item done | Developer | draft | — |
| [[UC-RemoveTodo]] | Remove a todo item | Developer | draft | — |

## Dependency Diagram

```
UC-AddTodo ──► writes ./.todo.json ──┐
                                       ├──► UC-ListTodos (reads)
UC-CompleteTodo ──► writes ./.todo.json ──┤
                                       │
UC-RemoveTodo ──► writes ./.todo.json ──┘
```

All four use cases are independent at the CLI-argument level (no UC calls another UC); they
are coupled only through the shared `./.todo.json` store via `[[contracts/todo-store.contract]]`.
