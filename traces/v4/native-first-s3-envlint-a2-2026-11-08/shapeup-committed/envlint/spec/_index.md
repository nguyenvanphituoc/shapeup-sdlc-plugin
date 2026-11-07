---
type: pitch
feature: envlint
appetite: "1 week"
lens: standard
status: ready
bounded_context: env-validation
entities: [EnvFile, Pair, Schema, Finding]
tags: [cli, validation, dotenv]
---

# envlint — Pitch Digest

## Problem
A `.env` file is the one config file nobody validates, so a typo in it becomes a production incident.
`envlint --schema <schema.json> <envfile>` reports what is wrong, key by key and line by line, and exits
non-zero so CI can fail on it. Source: the kicked-off pitch `pitch.gate.md`; clauses in the feature's `requirements.md` registry.

## Appetite
Small batch — a single build round (read as ~1 week; the pitch has no frontmatter appetite).

## Boundaries
- In: parsing `.env` text, rule checking against a JSON schema, a CLI that takes both files as arguments.
- Out (no-gos): never writes a `.env` file; no `${VAR}` interpolation; no dotenv-compatible loading; no
  colors, TUI or interactive prompts; no network access — `url` checks string shape only; no implicit
  lookup of the developer's own `.env`.

## Breadboarding
No breadboard: the pitch has no Places or affordances. The only surface is the command line.

## Rabbit Holes
- `new URL()` accepts `foo:bar` and `localhost:3000`, so a `url` check needs an explicit `scheme://host`
  (orient spike).
- `parseArgs` throws on unknown options and on `--schema` with no value; both must become a usage error.
- Unspecified details (exit-code numbering, output format, bool/int syntax, the pairs shape) are fixed in
  [[contracts/envlint.contract]] as spec decisions taken by the planner; they are open to the PO at
  Board Review.

## Document Map
- [[domain-model]] — Pair, Schema, Finding
- [[ux-behavior]] — the command-line surface
- [[contracts/envlint.contract]] — parse output, schema shape, findings, exit codes, output lines
- [[usecases/_index]] — UC-ParseEnvText, UC-EvaluateRules, UC-LintEnvFile
