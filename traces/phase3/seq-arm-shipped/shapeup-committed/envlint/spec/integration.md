---
schema_version: 1
doc_type: integration
feature: envlint
lens: standard
---

# Integration — envlint

## Cross-system data flows

There is exactly one integration boundary: the local file system, read twice per invocation
(env file, schema file). No network, no database, no message queue (no-gos). The "systems"
integrated are the three in-process modules:

```
bin/envlint.mjs (CLI)
   ├── reads: fs (env file path from argv)
   ├── reads: fs (schema file path from --schema)
   ├── calls: lib/parse.mjs::parseEnv(text)      [UC-01]
   └── calls: lib/rules.mjs::checkRules(parsed, schema) [UC-02]
```

## Events

None. Single-shot process; no pub/sub, no webhooks, no async callbacks.

## Silent-failure risks

- **Swallowed parse exceptions** — `lib/parse.mjs` must never throw (UC-01 contract); if a future
  change introduces a throw for an edge case (e.g. pathological regex backtracking on a very long
  malformed line), the CLI would need a top-level try/catch to avoid a bare stack trace reaching
  stderr (no-go). Risk: low (spike found no backtracking risk in the chosen regexes), but the
  CLI's top-level error handling (UC-03 Steps 2-4) is the only safety net — it must wrap the
  UC-01/UC-02 calls too, not just the two file reads, or an unexpected throw from either engine
  becomes a stack trace instead of `Error: ...`.
- **`url` type check `new URL()` throw vs. protocol check both required** — an implementation
  that only try/catches (and treats "didn't throw" as valid) silently passes `ftp://a.com`.
  Spiked and documented in `spike-parsing-type-rules.md`; guarded by TS-UC02-03.
- **`checked` count drifting between human and `--json` output** — if the two render paths
  compute `checked` differently (e.g. one counts schema keys, the other counts pairs present),
  the two modes silently disagree on an unspecified pitch detail. Resolved in
  `domain-model.md` (`checked` = schema-key count, single computation reused by both renderers)
  and guarded by TS-UC02-09.

## No cross-context concerns

`envlint` is a single bounded context with no other services to integrate against — this section
exists per the standard-lens template; there is nothing further to report.
