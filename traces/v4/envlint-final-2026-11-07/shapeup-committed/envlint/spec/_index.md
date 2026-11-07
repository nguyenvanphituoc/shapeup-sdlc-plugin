---
type: pitch
feature: envlint
appetite: "1 week"
status: ready
bounded_context: env-validation
lens: standard
entities: [EnvFile, Assignment, Schema, Finding]
tags: [cli, node, validation]
---

# Pitch: envlint — a validator for `.env` files

## Problem
A `.env` file is the one config file nobody validates, so a typo in it becomes a production
incident. `envlint` checks a `.env` file against a small JSON schema, reports exactly what is wrong
key by key and line by line, and exits non-zero so CI can fail on it.

## Appetite
**Small batch (~1 week, a single build round)** — the pitch carries no frontmatter appetite; it says
"Small batch — a single build round". If scope grows, cut, do not extend.

## Boundaries

### In Scope
- Parsing `.env` text: `KEY=value`, `#` comments, blank lines, `export KEY=value`, single- and
  double-quoted values, 1-based line numbers for anything unparseable.
- Rules over parsed pairs and a schema: `required`, `type` (`string` / `int` / `bool` / `url`), `enum`.
- CLI: `envlint --schema <schema.json> <envfile>`, both files passed explicitly, findings printed,
  exit codes; sane behaviour on a missing file, an unreadable schema, a file with no assignments.

### Non-Go
- No `.env` writing.
- No interpolation of `${VAR}` references.
- No dotenv-compatible loading (nothing is put into `process.env`).
- No implicit lookup of the developer's own `.env`.

## Solution Elements

### Breadboarding
No breadboard was supplied; the deliverable is a terminal command, so there is one "screen": the
terminal output of a single invocation.

```
[shell] ──envlint --schema s.json app.env──► [read both files] ──► parse ──► rules ──► [stdout findings + exit code]
                                                   │
                                     missing / unreadable / invalid ──► [stderr error, exit 2]
```

### Key Interactions
1. Developer (or CI) runs the command on a file and schema; gets one line per problem and exit 0/1.
2. A bad invocation or unreadable input gets one plain error line and exit 2 — never a stack trace.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Parser and rules disagree on the pairs shape, CLI integrates late | med | Contract pinned in [[contracts/parse.contract]] before build |
| `url` check too permissive (`new URL` accepts any scheme) | med | Shape-only check, scheme must be `http:` or `https:` ([[contracts/rules.contract]]) |
| Quote edge cases (unterminated, trailing text) balloon the parser | med | Fixed rule set in [[usecases/UC-ParseEnvText]]; anything else is a problem line, not a crash |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ready |
| [[ux-behavior]] | UX Spec | ready |
| [[usecases/_index]] | Use Cases | ready |
| [[contracts/parse.contract]] | Module contract | ready |
| [[contracts/rules.contract]] | Module contract | ready |
| [[contracts/cli.contract]] | Command contract | ready |
