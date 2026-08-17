---
type: scope-board
feature: envlint
generated_at: 2026-08-17
scopes: [env-parsing, schema-rules, cli-pipeline]
---

# Scope Board: `envlint` CLI

## Scopes

| scope_id | topology | tasks | substrate_size | lint |
|---|---|---|---|---|
| env-parsing | ICEBERG | TASK-001 | 2 | green |
| schema-rules | ICEBERG | TASK-002 | 2 | green |
| cli-pipeline | LAYER_CAKE | TASK-003, TASK-004 | 4 | green |

## Riskiest-first build sequence

1. **`env-parsing`** (TASK-001) and **`schema-rules`** (TASK-002) — highest risk, build in
   parallel: `scope-summary.md`'s dependency graph shows no `depends_on` between them, and each
   carries a footgun-dense edge-case surface (`env-parsing`: quote-stripping, duplicate-key
   last-wins, malformed-line detection with never-throw; `schema-rules`: four type
   validators including `new URL()` which can throw and must be caught, plus the `checked`-count
   invariant). Both must hold before `cli-pipeline` can compose them.
2. **`cli-pipeline`** (TASK-003 + TASK-004) — last: depends on both `env-parsing` and
   `schema-rules` existing (`scope-summary.md`: TASK-001/TASK-002 → TASK-003 → TASK-004). Owns
   the only file that imports both engines, the top-level try/catch around the whole chain
   (integration.md's silent-failure risk), and the full real-binary integration test against
   fixtures (E1–E5 plus clean/findings × human/`--json`).

## Shared substrate

None. `lib/parse.mjs` (env-parsing) and `lib/rules.mjs` (schema-rules) share no file and import
nothing from each other (`domain-model.md`, `scope-summary.md`'s core constraint). `bin/envlint.mjs`
is the only file that imports both, and it belongs exclusively to `cli-pipeline` — no scope
declares it as `shared_substrate` because no other scope writes to it. `package.json` is
pre-existing and frozen (read-only) for every scope; it appears in no `allowed_file_substrate`.
