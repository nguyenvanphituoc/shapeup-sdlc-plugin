---
type: pitch
feature: envlint
appetite: "1 week"
status: draft
bounded_context: EnvValidation
entities: [EnvFile, Schema, Finding]
tags: [cli, node, zero-deps]
skill_version: "2.5"
audit_rules_version: "2.5"
---

# Pitch: envlint — a validator for `.env` files

## Problem
A `.env` file is the one config file nobody validates, so a typo in it becomes a production incident.
Developers need a command they can point at a `.env` file and a small JSON schema that says exactly what
is wrong, key by key and line by line, and exits non-zero so CI fails on it.

## Appetite
**~1 week (small batch — a single build round)** — if scope grows beyond this, cut features, do not extend timeline.

## Boundaries

### In Scope
- Parsing `.env` text: `KEY=value`, `#` comments, blank lines, `export KEY=value`, single/double-quoted values, 1-based line numbers for unparseable lines.
- Rules: `required`, `type` (`string` / `int` / `bool` / `url`), `enum`.
- CLI: `envlint --schema <schema.json> <envfile>`, plain-text findings, exit codes; sane behaviour on a missing file, an unreadable schema and a file with no assignments.

### Non-Go
- Never writes a `.env` file.
- No `${VAR}` interpolation; no dotenv-compatible loading (nothing is put into `process.env`).
- No colors, no TUI, no interactive prompts.
- No network access, ever — `url` validates the string's shape only.
- No implicit lookup of the developer's own `.env`.

## Solution Elements

### Breadboarding
No breadboard was supplied; the only surface is the terminal.
```
[shell] ──envlint --schema s.json .env──► [CLI: read both files]
                                              │
                         parse(text) ─────────┤──────── validateSchema / evaluate(pairs, schema)
                                              │
                                   [stdout findings · stderr errors · exit 0/1/2]
```

### Key Interactions
1. Developer (or CI) runs `envlint --schema <schema.json> <envfile>`.
2. Findings are printed one per line, ordered by line number; exit code says clean / findings / could-not-run.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Node builtins false-accept `int`/`url` values (`""`, `1e3`, `localhost:3000`) | high | Pinned predicates in [[domain-model#Value Types]], judged on the raw string |
| Parse and Rules build concurrently and disagree on the pair shape | med | The `Pair` shape is fixed in [[domain-model#Value Objects]]; neither module imports the other |
| Quoting grammar sprawl (escapes, multi-line) | med | Only the escapes in [[usecases/UC-ParseEnvText]] are supported; multi-line values are a parse problem |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ✅ ready |
| [[ux-behavior]] | UX Spec | ✅ ready |
| [[usecases/_index]] | Use Cases | ✅ ready |
