---
schema_version: 1
doc_type: index
feature: envlint
lens: standard
---

# envlint — spec index

## Pitch digest

A zero-network CLI, `envlint --schema <schema.json> <envfile>`, that validates a `.env` file
against a JSON schema and prints key-by-key, line-by-line findings, exiting non-zero for CI.
Deliberately split into three independent pieces: **Parsing** (`lib/parse.mjs`, pure text →
`{pairs, problems}`), **Rules** (`lib/rules.mjs`, pure data → findings), and **the CLI**
(`bin/envlint.mjs`, the only piece depending on both). Both the env file and the schema file are
always explicit arguments — no implicit lookup — so every edge case is fixture-testable.
Appetite: small batch, single build round. No-gos: no `.env` writing, no `${VAR}` interpolation,
no dotenv loading, no colors/TUI/prompts, no network ever.

## Document map

- [[domain-model|Domain model]] — aggregates `EnvDocument`/`RuleSchema`/`LintReport`, three engines.
- [[ux-behavior|UX behavior]] — CLI state table, error messages, ASCII flow.
- Use cases:
  - [[usecases/UC-01-parse-env-file|UC-01 — Parse env file]] (Parsing engine)
  - [[usecases/UC-02-validate-against-schema|UC-02 — Validate against schema]] (Rules engine)
  - [[usecases/UC-03-run-cli-lint|UC-03 — Run envlint from the CLI]] (CLI engine, composes UC-01+UC-02)
- Contracts:
  - [[contracts/parse-contract|parse-contract]]
  - [[contracts/rules-contract|rules-contract]]
- [[integration|Integration]] — file-system boundary, silent-failure risks.
- Tasks (LOCAL, regenerable): TASK-001 (`lib/parse.mjs`), TASK-002 (`lib/rules.mjs`),
  TASK-003 (`bin/envlint.mjs`, depends on 001+002), TASK-004 (integration test, depends on 003).
- [[scope-summary|Scope summary]] · [[synthesis|Synthesis]] — traceability + risk register.

## Open questions carried from orient (`discovered-seed.md`)

3 of 4 pinned in this spec pass; 1 remains genuinely open (see `synthesis.md` risk register —
not resolved by invention, since EXPECTED.md itself is silent):
1. **E4 truncation semantics — still open.** EXPECTED.md says "line text truncated to 30 chars"
   with no byte-vs-character or ellipsis specification; no D1–D4 source pins it further, so no
   Test Surface row asserts a specific truncation algorithm beyond "≤30 chars of the line text" —
   flagged in `synthesis.md`, not guessed at here.
2. `--json` finding field names — pinned to `{key, line, message}` in `domain-model.md`'s `Finding` VO.
3. `checked` count definition — pinned to schema-key count in `domain-model.md`.
4. Duplicate-key + type-check interaction — pinned in `rules-contract.md` step 3 (last value only).
