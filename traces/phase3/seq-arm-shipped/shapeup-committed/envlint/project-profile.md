---
schema_version: 1
archetype: web-service
entry_point: bin/envlint.mjs
note: "Node CLI (`envlint --schema <schema.json> <envfile>`), not an HTTP service. bin/envlint.mjs is the argv dispatcher and composition root -- it parses argv, reads the two files, and calls into lib/parse.* and lib/rules.* the same shape as a web-service routing a request path to a handler module. The archetype enum has no native 'cli' value; web-service is the closest structural fit for reachability tracing (entry_point -> import graph -> engines)."
---

# Project Profile -- envlint

A zero-network Node CLI (`envlint`) that validates a `.env` file against a JSON schema. There is
no server and no listener; `bin/envlint.mjs` is invoked directly by the shell (or CI) per
invocation, parses + rule-checks the two file arguments, prints findings, and exits.
