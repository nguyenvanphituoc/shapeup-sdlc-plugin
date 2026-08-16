---
type: usecase-index
feature: todo-cli
tags: [cli]
---

# Use Case Index: `todo` CLI

| ID | Title | Actor | Status | Depends On |
|---|---|---|---|---|
| [[UC-AddTodo]] | Add a todo item | Developer | ready | [[domain-model]], [[ux-behavior]] |
| [[UC-ListTodos]] | List all todo items | Developer | ready | [[domain-model]], [[ux-behavior]] |
| [[UC-CompleteTodo]] | Mark item `<n>` done | Developer | ready | [[domain-model]], [[ux-behavior]] |
| [[UC-RemoveTodo]] | Remove item `<n>` | Developer | ready | [[domain-model]], [[ux-behavior]] |

## Dependency Diagram

```
                 ┌────────────────────────────┐
                 │   TodoStoreRepository       │
                 │  (domain-model.md)          │
                 └──────────────┬─────────────┘
        ┌───────────┬───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼
  UC-AddTodo   UC-ListTodos  UC-CompleteTodo UC-RemoveTodo
```

All four use cases share one repository and one store-path-resolution rule; they have no
dependency on each other — each is independently invocable from `bin/todo`.
