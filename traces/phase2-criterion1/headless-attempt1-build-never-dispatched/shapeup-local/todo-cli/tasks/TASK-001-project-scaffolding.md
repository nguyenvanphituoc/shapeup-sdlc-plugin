---
type: task
feature: todo-cli
id: TASK-001
title: "Scaffold package.json with a `todo` bin entry"
lens: standard
package: cli
status: ready
priority: 1
depends_on: []
unlocks: [TASK-002, TASK-003]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: []
repositories: []
linked_docs: ["[[_index#Boundaries]]"]
estimated_hours: 1
tags: [chore, scaffolding]
---

# TASK-001: Scaffold package.json with a `todo` bin entry

## Context
Repo is greenfield (no `package.json` exists — confirmed in
`.shapeup/todo-cli/orient/code-surface.md`). Create the package manifest with a `bin` field so
`todo` resolves as an installable CLI command per the pitch's "zero-config CLI" framing
(`[[_index#Boundaries]]`).

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] `package.json` created at repo root with `name`, `version`, `type: "commonjs"` (or `module` —
      pick one and be consistent across all later tasks), and `"bin": { "todo": "./bin/todo.js" }`
- [ ] `bin/todo.js` exists as a placeholder file with a `#!/usr/bin/env node` shebang and is
      executable (`chmod +x bin/todo.js`)
- [ ] `node bin/todo.js` runs without a Node syntax error (no commands implemented yet is fine)
- [ ] No runtime dependencies added — `package.json` has no `dependencies` field (or an empty one),
      per the pitch's "zero-config" / no-gos framing

## Non-Go (not in this task)
- Any command logic (`add`/`list`/`done`/`rm`) → TASK-005..008
- Argument dispatch → TASK-009
- Domain types → TASK-002
