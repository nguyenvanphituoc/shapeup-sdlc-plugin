---
type: integration
feature: envlint
affected_services: []
domain_events_consumed: []
domain_events_produced: []
tags: [integration, cli]
depends_on: ["[[domain-model]]", "[[usecases/_index]]"]
status: ready
---

# Integration Map: envlint

## Impact Summary

| System | Severity | Direction | Summary |
|--------|----------|-----------|---------|
| CI pipeline | 🟢 Isolated | → produces | Consumes the process exit code only; no API, no shared state. |
| Local filesystem | 🟢 Isolated | ← consumes | Reads two files given by path; never writes. |
| Network | — | none | Explicit no-go — zero network calls, even for the `url` type check (shape-only). |

---

## Command-Line Interface (CI)

**Severity:** 🟢 Isolated
**Direction:** → produces

### What Changes
A CI pipeline step invokes `envlint --schema <schema.json> <envfile>` (or `npm test`, which
exercises the same binary via `node --test`) and branches on the process exit code: 0 = pass,
1 = env file has findings (fail the build), 2 = the tool itself couldn't run (fail the build,
distinguishable from "findings" if the pipeline inspects stderr).

### Data Flow
```
[CI step] ──spawn──► [bin/envlint.mjs --schema schema.json .env]
                          │
                    stdout: findings / ok / json      stderr: tool-error message
                          │                                    │
                          ▼                                    ▼
                    [CI captures exit code] ────────────────────
```

### Risk
If a future change makes the binary print to stdout on the exit-2 (tool-error) path, or omit a
trailing newline in a way that corrupts a CI log parser, a pipeline that greps stdout for pass/
fail markers could silently misclassify a tool error as "clean". This is why INV-05 (exit-2
messages go to stderr only) and INV-03 (exit code is always exactly 0/1/2) are Test Surface rows,
not just prose.

### Mitigation
CI integration is exit-code-only by contract (no stdout scraping required) — Rules/Parsing
findings never need to be machine-parsed unless `--json` is used, and even then the JSON shape
is pinned (E5). No additional coordination needed.

### Related Use Cases
- [[usecases/UC-01]] — the UC whose tasks implement this integration point (see the
  LOCAL board for which tasks; not linked here per tier-direction rule)

---

## Local Filesystem

**Severity:** 🟢 Isolated
**Direction:** ← consumes

### What Changes
`bin/envlint.mjs` reads exactly two files, both given by explicit path argument (no implicit
`.env` lookup — this is what makes the tool fixture-testable, per idea.md): the schema JSON file
and the env file. Neither is ever written to (explicit no-go: no `.env` writing).

### Data Flow
```
[--schema <path>] ──fs.readFileSync──► [schema JSON text] ──JSON.parse──► [SchemaMap]
[<envfile>]        ──fs.readFileSync──► [env file text]    ──parseEnv──►  [{pairs, problems}]
```

### Risk
A relative path resolved against the wrong CWD would make a CI-authored fixture path silently
miss, surfacing as a false E1 rather than a real "file missing" bug. Mitigated by never
resolving paths beyond what `node:fs` does with the string as given (no implicit lookup, no
path rewriting) — this is exactly what idea.md calls out as required for testability.

### Mitigation
No implicit path resolution beyond Node's own relative-to-CWD `fs` semantics; both paths are
opaque strings the caller controls.

### Related Use Cases
- [[usecases/UC-01]]

---

## Event Coordination

| Event | Producer | Consumers | Deploy Order |
|-------|----------|-----------|-------------|
| — | none | none | N/A — no domain events, single-process synchronous CLI |

---

## Environment Variables Required

| Variable | Service | Purpose |
|----------|---------|---------|
| — | none | envlint validates a `.env` file passed by path; it does not read its own configuration from environment variables, and does not load the target file into `process.env` (explicit no-go: no dotenv-compatible loading). |
