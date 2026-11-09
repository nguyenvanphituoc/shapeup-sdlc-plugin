---
type: pitch
feature: envlint
appetite: "small batch — a single build round"
status: draft
bounded_context: EnvValidation
entities: [EnvPair, ParseProblem, KeyRule, Finding]
tags: [cli, node, zero-deps]
lens: lite
---

# Pitch: envlint — a `.env` validator

## Problem
A `.env` file is the one config file nobody validates, so a typo in it becomes a production incident.

## Appetite
**Small batch, one build round** (source: `pitch.gate.md` § Appetite). If scope grows, cut — do not extend.

## Boundaries

### In Scope
- `envlint --schema <schema.json> <envfile>` — both paths are arguments; no implicit `.env` lookup.
- Parsing: `KEY=value`, `#` comments, blank lines, `export KEY=value`, single/double quotes, 1-based line numbers for unparseable lines.
- Rules: `required`, `type` (`string` / `int` / `bool` / `url`), `enum`.
- CLI: argument handling, reading both files, plain-text findings, exit codes; sane behaviour on a missing file, an unreadable schema and a file with no assignments.

### Non-Go (pitch Boundaries)
- NOGO-01 never writes a `.env` file.
- NOGO-02 never interpolates `${VAR}` references.
- NOGO-03 no dotenv-compatible loading (it never populates `process.env`).
- NOGO-04 no colors, no TUI, no interactive prompts.
- NOGO-05 no network access, ever; `url` validates string shape only.

## Solution Elements

### Breadboarding
No separate breadboard; the deliverable is a CLI with no screens, so there are no Places to place.
```
argv ──► bin/envlint.mjs ──read──► env text ──► parseEnv ──pairs──► checkRules(schema) ──findings──► stdout + exit code
                         └─read──► schema JSON ──► checkSchema ─(invalid)─► stderr + exit 2
```

### Key Interactions
1. Developer or CI runs `envlint --schema s.json .env.production`.
2. Clean → exit 0, nothing on stdout. Findings → one line each on stdout, exit 1. Usage / IO / schema error → one line on stderr, exit 2.

## Spec decisions (the pitch leaves these open — PO to confirm at Board Review)
Taken from the Scout's spike recommendations; each is stated once here and enforced in the use cases.
- SD-1 Pair shape: `pairs` is an array of `{key, value, line}` (1-based); a duplicate key keeps both pairs and Rules reads the last.
- SD-2 Empty value (`KEY=`) satisfies `required`, and is checked by `type`/`enum` like any other value.
- SD-3 Grammars: `int` = `/^-?[0-9]+$/`; `bool` = exactly `true` or `false`; `url` = parses with the WHATWG `URL` constructor and its protocol is `http:` or `https:`.
- SD-4 Exit codes: 0 clean · 1 at least one parse problem or rule finding · 2 usage, unreadable file, invalid JSON or invalid schema shape.
- SD-5 A file with zero assignments prints one notice line to stderr and the rules still run (so a `required` key is still reported).
- SD-6 Env keys not named in the schema are ignored.
- SD-7 Quoting: a quoted value runs to the matching closing quote with no escape processing; after it only whitespace or a `#` comment may follow. An unquoted value ends at the first ` #` (whitespace then `#`) and is trimmed. An unterminated quote is a parse problem.

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Parsing and Rules built concurrently against different pair shapes | med | SD-1 fixes the shape in both use cases' Input/Output |
| Inventing a dotenv dialect (escapes, multiline) | med | SD-7 minimal grammar; everything else is a parse problem |
| `url` drifting into network checks | low | NOGO-05 + SD-3 shape-only |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ✅ draft |
| [[ux-behavior]] | CLI behaviour | ✅ draft |
| [[usecases/_index]] | Use Cases | ✅ draft |
