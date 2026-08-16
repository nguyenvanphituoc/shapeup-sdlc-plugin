---
schema_version: 1
archetype: web-service
entry_point: bin/todo.js
note: "Node CLI, not an HTTP service. bin/todo.js is the argv dispatcher and composition root -- it routes process.argv[2] to command handlers (add/list/done/rm), the same shape as a web-service routing a request path to a handler module. The archetype enum has no native 'cli' value; web-service is the closest structural fit for reachability tracing (entry_point -> import graph -> engines)."
---

# Project Profile -- todo-cli

A zero-config Node CLI (`todo`) storing items in a local JSON file. There is no server and no
network listener; `bin/todo.js` is invoked directly by the shell per command and exits.
