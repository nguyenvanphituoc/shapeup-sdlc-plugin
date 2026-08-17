---
schema_version: 1
doc_type: synthesis
feature: envlint
lens: standard
---

# Synthesis — envlint

## Traceability matrix

See `scope-summary.md` for the UC → task → file matrix. Every Test Surface row across UC-01,
UC-02, UC-03 cites a D1 (invariant), D2 (error case), D3 (contract), or D4 (no-go) source — no
row was invented; see each use case's `## Test Surface` section.

## Risk register

| Risk | Source | Severity | Mitigation |
|---|---|---|---|
| `url` type check accepting a wrong-protocol URL via try/catch alone | spike | de-risked | TS-UC02-03, `spike-parsing-type-rules.md` — protocol allow-list check required in addition to try/catch |
| Regex-based line parsing on pathological input (backtracking) | integration.md | low, unspiked | `lib/parse.mjs` regex has no nested quantifiers that risk catastrophic backtracking; not spiked further since spike found no architectural surprise |
| Unexpected throw inside `lib/parse.mjs`/`lib/rules.mjs` reaching stderr as a stack trace | integration.md | medium | TASK-003 AC requires the CLI's top-level try/catch to wrap the UC-01/UC-02 calls, not just file reads |
| **E4 truncation semantics unspecified** (char vs. byte, ellipsis or not) | `discovered-seed.md` item 1 | open — spec gap, not resolved by invention | No Test Surface row asserts a specific truncation algorithm beyond "≤30 chars of the line text" per EXPECTED.md's literal wording; PO/TL should pin this before TASK-003 build if exact fixture bytes matter |
| `checked` count could silently diverge between human/`--json` renderers | `discovered-seed.md` item 3 | resolved | pinned to schema-key count in `domain-model.md`, single computation, guarded by TS-UC02-09 |

## Hammer-gate facts (not resolved here)

- Total estimated hours: 12h (see `scope-summary.md`) against a "small batch" appetite — no
  numeric appetite-hours budget was given in this order's payload, so no overflow flag is
  computed; report as-is for the caller.
- One residual open spec question (E4 truncation) — not a rank-2+ technical risk (orient's
  `hill-signal.md` already classified all `discovered-seed.md` items as spec-clarification, not
  feasibility risk), so it does not block Map Scopes, but it should be resolved before TASK-003
  is graded on exact truncated-string bytes.
