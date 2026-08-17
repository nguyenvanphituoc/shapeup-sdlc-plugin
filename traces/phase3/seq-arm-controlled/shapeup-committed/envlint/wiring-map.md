---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring Map: envlint

Per project-profile.md, `bin/envlint.mjs` is the argv dispatcher and composition root for this
zero-network Node CLI (archetype recorded as `web-service` for reachability-tracing purposes
only — there is no HTTP server). One use case (UC-01) composes both pure engines behind that
single entry point.

## Entries

### UC-01 — Lint Env File

| Field | Value |
|---|---|
| `engine` | `src/parsing.mjs` (`parseEnv`) and `src/rules.mjs` (`evaluate`) — two pure, mutually-non-importing functional-core modules composed by the CLI shell |
| `wiring_seam` | Direct synchronous function calls from the CLI's argv-dispatch flow: `bin/envlint.mjs` reads argv, calls `node:fs.readFileSync` for the schema and env files, then calls `parseEnv(envText)` from `src/parsing.mjs`, then calls `evaluate(pairs, problems, schema)` from `src/rules.mjs` — no event bus, no DI container, no route registration; a straight-line CLI composition |
| `entry_call_site` | `bin/envlint.mjs` — top-level argv dispatcher: parses `--schema <path>`, optional `--json`, and the single positional `<envfile>`, then invokes the read → parse → evaluate → render chain inline as the script's main body (this **is** the composition root itself, not a route registered into a separate root) |
| `affordance` | Running `envlint --schema <schema.json> [--json] <envfile>` from a shell or CI step prints either `ok: N keys checked` (human) or a single JSON `{"ok","findings","checked"}` document (`--json`), and exits `0`/`1`/`2` — the CLI's entire player-visible surface and CI's branch signal |

## Deviations

None — the single use case has a complete, unambiguous attachment path: both engine modules are
named directly in synthesis.md's task/critical-path table (TASK-001 `src/parsing.mjs`, TASK-002
`src/rules.mjs`, TASK-003 `bin/envlint.mjs`), and the CLI composition root *is* the entry point
declared in project-profile.md, so there is no separate "attach into X" step to design beyond the
inline call chain described above.
