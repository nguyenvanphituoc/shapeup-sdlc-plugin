---
schema_version: 1
archetype: web-service
entry_point: bin/envlint.mjs
note: "Node CLI, not an HTTP service. bin/envlint.mjs is the argv dispatcher and composition root -- it parses --schema/--json/positional args and routes to the parsing + rules engines, then prints findings and sets the exit code. The archetype enum has no native 'cli' value; web-service is the closest structural fit for reachability tracing (entry_point -> import graph -> engines), matching the todo-cli precedent in this plugin's own trace fixtures."
---

# Project Profile -- envlint

A zero-network Node CLI (`envlint`) that validates a `.env` file against a JSON schema. There is
no server and no listener; `bin/envlint.mjs` is invoked directly by the shell per run and exits
with a status code reflecting findings (0 clean, 1 findings, 2 tool error).
