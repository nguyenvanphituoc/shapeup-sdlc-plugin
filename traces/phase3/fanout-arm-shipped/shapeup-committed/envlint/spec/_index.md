---
type: pitch
feature: envlint
appetite: "small batch — single build round"
status: ready
bounded_context: env-linting
entities: []
tags: [cli, validator]
skill_version: "4.0"
audit_rules_version: "4.0"
---

# Pitch: envlint

## Problem
A `.env` file is the one config file nobody validates, so a typo in it becomes a production
incident. Developers need a small, dependency-free CLI that checks a `.env` file against a JSON
schema and fails CI with a clear, line-numbered reason when something's wrong.

## Appetite
**Small batch — a single build round.** If scope grows beyond the interface/edge cases already
pinned in EXPECTED.md, cut features (e.g. defer `enum` or `bool` types), do not extend the round.

## Boundaries

### In Scope
- Parsing `.env` text: `KEY=value`, `# comment`, blank lines, `export KEY=value`, single/double
  quoted values, 1-based line numbers for anything unparseable.
- Rule evaluation: `required`, `type` (`string`/`int`/`bool`/`url`), `enum`.
- CLI: `--schema <path>` (required) + `--json` (optional) + one positional `<envfile>`; exit
  0/1/2; human-readable and `--json` output modes.

### Non-Go
- No `.env` writing, no `${VAR}` interpolation, no dotenv-compatible loading into `process.env`.
- No colors, no TUI, no interactive prompts (output stays assertable).
- No network access, ever — the `url` type check validates string shape only (`new URL()` +
  protocol allow-list), never resolves or fetches.
- No implicit lookup of the caller's own `.env` — both files are always explicit arguments.

## Solution Elements

### Breadboarding
```
[argv: --schema s.json [--json] envfile] ──parse──► [CLI: read s.json, read envfile]
                                                          │
                                          ┌───────────────┴───────────────┐
                                     tool error                     both files read
                                    (E1/E2/no --schema)                   │
                                          │                         [Parsing: parseEnv]
                                          ▼                               │
                                  [stderr, exit 2]                  [Rules: evaluate]
                                                                           │
                                                                    [LintReport]
                                                                           │
                                                          ┌────────────────┴───────────────┐
                                                     findings==0                      findings>=1
                                                          │                                 │
                                                [stdout "ok: N", exit 0]      [stdout findings + count, exit 1]
```

### Key Interactions
1. `envlint --schema schema.json .env` — the everyday CI-fail-fast path.
2. `envlint --schema schema.json --json .env` — machine-readable path for tooling that wants to
   post-process findings rather than parse text lines.
3. Any of the four tool-error triggers (missing `--schema`, unreadable schema/env file, invalid
   schema JSON) — the "worse than no linter" case the pitch explicitly guards against.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `new URL()`'s WHATWG leniency (e.g. `http:/x.com` single-slash) causes over- or under-rejection relative to EXPECTED.md's literal wording | medium | Spiked pre-scoping (`spike-url-type-validation.md`): trust `new URL()` as-is, gate only on protocol — TS-TYPE-url-leniency + TS-TYPE-url-scheme-gate pin both directions. |
| A naive `url` check drops the protocol gate and accepts `ftp://`/`mailto:`/`data:` values that merely parse | medium | Test Surface row TS-TYPE-url-scheme-gate makes this an explicit, graded assertion, not an inferred one. |
| E3 ("zero assignments... must not report ok") is misread as an absolute rule when the schema has zero `required` keys | low | UC-01 INV-06 pins the reading + TS-INV-06 fixture; flagged so the builder doesn't over-guard. |
| `--json` findings ordering isn't pinned by EXPECTED.md | low | Documented as an assumption (ux-behavior.md RULE-06) — same order as human-readable output — rather than silently decided in code. |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ✅ ready |
| [[ux-behavior]] | UX Spec (CLI output modes) | ✅ ready |
| [[usecases/_index]] | Use Cases | ✅ ready |
| [[integration]] | Integration Map | ✅ ready |
| [[scope-summary]] | Scope Summary | ⬜ pending board-derive |
| [[synthesis]] | Health Dashboard + Traceability + Risk + Dependency | ✅ ready |
| [[feedback]] | Post-Sprint Feedback | ⬜ pending |

**Contracts note:** this feature has no repository/service/third-party boundary (zero-network,
zero-dependency CLI), so `contracts/` (the standard lens's normal central document) is
intentionally absent — the typed shapes live in [[usecases/UC-01]]'s
Input/Output/Error Cases instead. See domain-model.md's Repository Interfaces section.

---

## Audit Report

*Generated from harness verify spec output — do not edit manually.*
*skill_version: 4.0 | audit_rules_version: 4.0*

### Score Summary

| Layer | Weight | Raw Score | Weighted |
|-------|--------|-----------|---------|
| L0 Input Quality | 10% | —/100 | — |
| L1 Generation Complete | 20% | —/100 | — |
| L2 Document Quality | 30% | —/100 | — |
| L3 Execution Readiness | 40% | —/100 | — |
| **TOTAL** | | | **—/100** |

### Execution Gate
⬜ *Pending audit*

### Issues Found
⬜ *Pending audit*
