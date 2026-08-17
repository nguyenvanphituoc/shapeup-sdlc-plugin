---
schema_version: 1
feature: envlint
entry_point: bin/envlint.mjs
---

# Wiring Map — `envlint` CLI

Composition root: `bin/envlint.mjs` — the argv dispatcher. Invoked directly by the shell (or CI)
per invocation; parses argv, reads the two file arguments (env file, JSON schema file), and calls
into `lib/parse.mjs` then `lib/rules.mjs` in sequence, the same shape as a web-service routing a
request path to a handler module (per project profile). There is no subcommand switch — a single
straight-line pipeline is the seam for all three use cases, since `envlint` has exactly one mode
of invocation (`envlint --schema <schema.json> <envfile>`).

## Entries

### UC-01 — Parse env file

| Field | Value |
|---|---|
| `engine` | `lib/parse.mjs` (`parseEnv(text)`) |
| `wiring_seam` | Direct function call — `bin/envlint.mjs` reads the env file's raw text via `fs.readFileSync` behind the `EnvFileReader` seam, then calls `parseEnv(text)` synchronously and holds the returned `{pairs, problems}` in a local variable for the next stage. No event, no registration — a single call in the entry point's straight-line pipeline. |
| `entry_call_site` | `bin/envlint.mjs` — the parse step of the top-level pipeline, immediately after the env-file `fs.readFileSync` (Steps 2 and 5 of UC-03) |
| `affordance` | Not independently player-visible — `parseEnv`'s output only reaches the developer/CI actor once UC-02 and UC-03 render it; malformed lines surface later as `problems`-derived findings in the CLI's stdout/stderr output |

### UC-02 — Validate parsed pairs against schema

| Field | Value |
|---|---|
| `engine` | `lib/rules.mjs` (`checkRules({pairs, problems}, schema)`) |
| `wiring_seam` | Direct function call — `bin/envlint.mjs` reads and `JSON.parse`s the schema file (Steps 3-4 of UC-03) via the `SchemaFileReader` seam, then calls `checkRules(parseEnvResult, schema)` synchronously with UC-01's return value and holds the returned `{findings, checked, ok}` for rendering. |
| `entry_call_site` | `bin/envlint.mjs` — the validate step of the top-level pipeline, immediately after the `parseEnv` call (Step 6 of UC-03) |
| `affordance` | Not independently player-visible — `checkRules`'s output (`findings`/`checked`/`ok`) only becomes visible to the developer/CI actor once UC-03 renders it to stdout/stderr and sets the process exit code |

### UC-03 — Run envlint from the command line

| Field | Value |
|---|---|
| `engine` | `bin/envlint.mjs` (the composition root itself — this UC owns argv parsing, file I/O, rendering, and exit-code selection; it is the entry point, not a module the entry point calls into) |
| `wiring_seam` | Process invocation — the shell (developer terminal or CI job) invokes `envlint --schema <schema.json> <envfile>` as a Node CLI; `bin/envlint.mjs`'s top-level code runs argv parsing, wraps the UC-01/UC-02 calls plus file reads in a top-level try/catch (per `synthesis.md`'s risk register), renders human or `--json` output, and calls `process.exit(code)`. |
| `entry_call_site` | `bin/envlint.mjs` — top level (module entry, executed on process start; no dispatch needed since this is the entry point) |
| `affordance` | Developer or CI runs `envlint --schema <schema.json> <envfile>` in a shell and sees either `ok: N keys checked` (exit 0) or one `<envfile>:<line>: <KEY>: <message>` line per finding plus `N problem(s)` (exit 1), or a single `Error: ...` line on stderr (exit 2) — with `--json` producing one JSON document instead of the human-readable lines |

## Deviations

None — all three use cases have a direct, single-path attachment to the entry point. There is no
background/cron use case in this feature (the pitch is explicitly a single-shot, stateless,
zero-network pipeline per `domain-model.md`'s Domain events section), so no boot-hook seam is
needed.

## Assumptions

- Engine module paths (`lib/parse.mjs`, `lib/rules.mjs`) are taken directly from the `engine`
  frontmatter and System Flow sections of UC-01/UC-02, and from the domain model's Engines table
  — the spec already pins these paths, so no inference was needed for the two library engines.
- `bin/envlint.mjs` is assumed to implement UC-03 as a single straight-line pipeline (parse argv →
  read env file → read+parse schema → `parseEnv` → `checkRules` → render → exit) rather than a
  subcommand dispatch, since the CLI has exactly one invocation shape (`envlint --schema <s>
  <envfile>`), unlike a multi-subcommand CLI (e.g. `todo add`/`todo list`). The build may
  restructure the internal control flow as long as `bin/envlint.mjs` remains the sole caller of
  `lib/parse.mjs` and `lib/rules.mjs` (TS-UC03-12: no direct re-implementation of parsing or rule
  logic in the CLI file).
- The `EnvFileReader`/`SchemaFileReader` "repository" seams named in `domain-model.md` are
  modeled as named helper functions or inline `fs.readFileSync` calls inside `bin/envlint.mjs`
  (not separate files) — the domain model frames them as repositories only for reachability-tracing
  symmetry with the `web-service` archetype, not as a mandate for separate modules; the spec does
  not pin a file path for them, so no engine entry is written for them independently of UC-03's
  entry.
