---
type: scope-board
feature: envlint
generated_at: 2026-08-17
scopes: [rules-engine, parsing-engine, cli-composition-root, test-surface-suite]
---

# Scope Board: `envlint`

## Scopes

| scope_id | topology | tasks | substrate_size | lint |
|---|---|---|---|---|
| rules-engine | ICEBERG | TASK-002 | 2 | green |
| parsing-engine | ICEBERG | TASK-001 | 2 | green |
| cli-composition-root | LAYER_CAKE | TASK-003 | 2 | green |
| test-surface-suite | CHOWDER | TASK-004 | 1 | green |

## Riskiest-first build sequence

1. **`rules-engine`** (TASK-002) — highest risk: the `url` type's protocol-gate footgun
   (`new URL()`'s WHATWG leniency vs. the pitch's Rabbit Holes table, confirmed by
   `spike-url-type-validation.md`) plus the INV-02 last-wins dedup semantics across repeated
   keys and the INV-06 zero-required-keys "ok" reading. Build first among the two engine scopes
   — every downstream fixture (CLI, test-surface-suite) assumes this holds.
2. **`parsing-engine`** (TASK-001) — next-highest risk: quote-stripping / `export`-prefix /
   whitespace-trim edge cases and 1-based line numbering that every `Finding` traces back to.
   Shares no file and no import with `rules-engine` (TASK-001 and TASK-002 are Wave 1 in
   scope-summary.md), so it can build in parallel with it, not strictly after.
3. **`cli-composition-root`** (TASK-003) — depends on both engine scopes completing first
   (Wave 2): wires `parseEnv` → `evaluate`, renders human/`--json` output, sets the exit code.
   The wiring/rendering risk is real but lower than either engine's internal edge cases, since
   it composes already-verified pure functions rather than inventing new logic.
4. **`test-surface-suite`** (TASK-004) — last (Wave 3): depends on all three scopes above; the
   only scope proving the full Test Surface (all `TS-*` rows, `D1`–`D4`) by driving the built
   binary end to end against throwaway fixtures, not a substitute for any single scope's own
   fixture.

## Shared substrate

None. `parsing-engine`, `rules-engine`, `cli-composition-root`, and `test-surface-suite` each
own a disjoint file set: `src/parsing.mjs`+`test/parsing.test.mjs`,
`src/rules.mjs`+`test/rules.test.mjs`, `bin/envlint.mjs`+`test/cli.test.mjs`, and
`test/test-surface.test.mjs` respectively. `package.json` is frozen (already carries the
`bin.envlint` entry) and out of every scope's `allowed_file_substrate` — no scope needs to write
it, so DISJOINT has nothing else to declare.
