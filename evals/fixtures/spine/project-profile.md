---
schema_version: 1
archetype: cli
entry_point: src/cli/main.js
---

# Project profile — `todo` CLI

A single-process Node CLI. `src/cli/main.js` is the composition root: it is the file the shell
runs, and a module the running CLI can reach is a module reachable from here through the import
graph. Reachability is resolved against this entry point and no other.
