---
type: task
feature: todo-cli
id: TASK-001
title: "Scaffold bin/todo.js entry point and argv dispatcher"
lens: standard
package: cli
status: done
priority: 1
depends_on: []
unlocks: [TASK-002]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
entities: []
repositories: []
linked_docs: ["[[_index]]", "[[ux-behavior#Command-Flow]]"]
estimated_hours: 1
tags: [chore, cli]
completed_at: 2026-08-16
---

# TASK-001: Scaffold bin/todo.js entry point and argv dispatcher

## Context
Create the project scaffold per [[_index#Solution-Elements]] and the project profile's
`entry_point: bin/todo.js`: a `package.json` (name `todo-cli`, `bin: { "todo": "./bin/todo.js" }`,
no dependencies — Node built-ins only) and `bin/todo.js` with a shebang (`#!/usr/bin/env node`)
that dispatches `process.argv[2]` to one of four not-yet-implemented command handlers
(`add`/`list`/`done`/`rm`), matching the flow in [[ux-behavior#Command-Flow]]. Command handler
bodies are stubs in this task — TASK-003 through TASK-006 fill them in.

## Acceptance Criteria

### ✅ Baseline (always required)
- [x] `package.json` exists at repo root with `"bin": { "todo": "./bin/todo.js" }`
- [x] `bin/todo.js` exists, starts with `#!/usr/bin/env node`, and is executable (`chmod +x`)
- [x] `node bin/todo.js` with no subcommand prints a usage line to stderr and exits 1
- [x] `node bin/todo.js frobnicate` (unknown command) prints `Error: unknown command "frobnicate"...`
      to stderr and exits 1 (per [[ux-behavior#Error-Catalog]] `E_UNKNOWN_COMMAND`)
- [x] `node bin/todo.js add`, `node bin/todo.js list`, `node bin/todo.js done`, `node bin/todo.js rm`
      each reach a distinct (stub) branch without throwing — verified by a temporary
      `console.error('TODO: <cmd>')` + non-zero exit that later tasks replace

## Implementation Notes
- Dispatch on `process.argv[2]` only; do not add a CLI-parsing library — Node built-ins only
  (keeps "zero-config" true and avoids an npm-install step before first run).
- Structure the dispatcher so each command's logic can live in its own function/module,
  since TASK-003–006 replace the stub bodies without touching the dispatch skeleton.

## Non-Go (not in this task)
- Store read/write logic → TASK-002
- Real `add`/`list`/`done`/`rm` behavior → TASK-003, TASK-004, TASK-005, TASK-006
- Integration test → TASK-007


## Execution Log — 2026-08-15 (todo-cli/foundation-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `package.json` exists at repo root with `"bin": { "todo": "./bin/todo.js" }`: pass (package.json created with bin.todo = ./bin/todo.js)
- `bin/todo.js` exists, starts with `#!/usr/bin/env node`, and is executable (`chmod +x`): pass (chmod +x bin/todo.js; ls -la shows -rwxr-xr-x; first line is #!/usr/bin/env node)
- `node bin/todo.js` with no subcommand prints a usage line to stderr and exits 1: pass (HOME=$(mktemp -d) node bin/todo.js -> stderr 'Usage: todo <add|list|done|rm> ...', exit=1)
- `node bin/todo.js frobnicate` (unknown command) prints `Error: unknown command "frobnicate"...`: pass (HOME=$(mktemp -d) node bin/todo.js frobnicate -> stderr 'Error: unknown command "frobnicate". Usage: todo <add|list|done|rm> ...', exit=1)
- `node bin/todo.js add`, `node bin/todo.js list`, `node bin/todo.js done`, `node bin/todo.js rm`: pass (each dispatches to a distinct stub function (cmdAdd/cmdList/cmdDone/cmdRm) printing 'TODO: <cmd>' to stderr and exiting 1, no throw)


## Execution Log — 2026-08-16 (todo-cli/foundation-r1-a1)
- executor: task-executor via ingest-result
- status: done
- `package.json` exists at repo root with `"bin": { "todo": "./bin/todo.js" }`: pass (node -e "console.log(JSON.parse(fs.readFileSync('package.json')).bin)" -> { todo: './bin/todo.js' })
- `bin/todo.js` exists, starts with `#!/usr/bin/env node`, and is executable (`chmod +x`): pass (chmod +x bin/todo.js; ls -la -> -rwxr-xr-x; first line is #!/usr/bin/env node; also asserted in test/bin-scaffold.test.js)
- `node bin/todo.js` with no subcommand prints a usage line to stderr and exits 1: pass (HOME=$(mktemp -d) node bin/todo.js -> stderr 'Usage: todo <add|list|done|rm> ...', exit=1; test/bin-scaffold.test.js passes)
- `node bin/todo.js frobnicate` (unknown command) prints `Error: unknown command "frobnicate"...`: pass (HOME=$(mktemp -d) node bin/todo.js frobnicate -> stderr 'Error: unknown command "frobnicate". Usage: todo <add|list|done|rm> ...', exit=1)
- `node bin/todo.js add`, `node bin/todo.js list`, `node bin/todo.js done`, `node bin/todo.js rm`: pass (each dispatches to a distinct stub function (cmdAdd/cmdList/cmdDone/cmdRm) printing 'TODO: <cmd>' to stderr and exiting 1, no throw; node --test test/bin-scaffold.test.js -> 6/6 relevant tests pass)


## Execution Log — 2026-08-16 (todo-cli/foundation-r2-a1)
- executor: task-executor via ingest-result
- status: done
- `package.json` exists at repo root with `"bin": { "todo": "./bin/todo.js" }`: pass (package.json contains "bin": { "todo": "./bin/todo.js" } (pre-existing, unchanged))
- `bin/todo.js` exists, starts with `#!/usr/bin/env node`, and is executable (`chmod +x`): pass (node --test test/bin-scaffold.test.js -> 'bin/todo.js has a #!/usr/bin/env node shebang and is executable' passed)
- `node bin/todo.js` with no subcommand prints a usage line to stderr and exits 1: pass (node --test test/bin-scaffold.test.js -> 'node bin/todo.js with no subcommand prints usage to stderr and exits 1' passed)
- `node bin/todo.js frobnicate` (unknown command) prints `Error: unknown command "frobnicate"...`: pass (node --test test/bin-scaffold.test.js -> 'node bin/todo.js frobnicate (unknown command) prints error and exits 1' passed)
- `node bin/todo.js add`, `node bin/todo.js list`, `node bin/todo.js done`, `node bin/todo.js rm`: pass (node --test test/bin-scaffold.test.js -> all four dispatch tests pass (14/14 total); 'list' now exits 0 with 'No todos yet.' per the TASK-004 implementation that superseded its TASK-001 stub, test updated in place to match)
