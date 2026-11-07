---
type: pitch
feature: envlint
appetite: "1 week"
lens: standard
status: ready
bounded_context: env-validation
entities: [EnvFile, Schema]
tags: [cli, dotenv, lint]
skill_version: "2.5"
audit_rules_version: "2.5"
---

# Pitch: envlint — a validator for `.env` files

## Problem
A `.env` file is the one config file nobody validates, so a typo in it becomes a production incident.
Developers need a tool that checks a `.env` file against a small JSON schema, says exactly what is wrong
key by key and line by line, and exits non-zero so CI can fail on it. Source: the kicked-off pitch
`pitch.gate.md`.

## Appetite
**1 week** (the pitch: "Small batch — a single build round") — if scope grows beyond this, cut features, do
not extend the timeline.

## Boundaries

### In Scope
- `envlint --schema <schema.json> <envfile>` — both files passed as arguments.
- Parsing: `KEY=value`, `#` comments, blank lines, `export KEY=value`, single- and double-quoted values,
  1-based line numbers for anything unparseable. Pure.
- Rules: `required`, `type` of `string` / `int` / `bool` / `url`, `enum`. Pure.
- CLI: argument handling, reading the two files, printing findings, exit codes; sane behaviour on a missing
  file, an unreadable schema and a file with no assignments.

### Non-Go
- NOGO-01: never writes a `.env` file.
- NOGO-02: never interpolates `${VAR}` references.
- NOGO-03: no dotenv-compatible loading (no implicit lookup of the developer's own `.env`).
- NOGO-04: no colors, no TUI, no interactive prompts.
- NOGO-05: no network access, ever; `url` validates the string's shape only.

## Solution Elements

### Breadboarding
No breadboard was shaped; the deliverable is a CLI with no screens.

```
[shell: envlint --schema s.json .env] ──read──► [Parsing: text → pairs, problems]
                                                     │
                                         [Rules: pairs + schema → findings]
                                                     │
                                       [stdout lines + exit code 0 | 1 | 2]
```

### Key Interactions
1. Developer (or CI) runs `envlint --schema <schema.json> <envfile>`.
2. envlint prints one line per problem or finding and exits 1, or prints nothing and exits 0.
3. Bad invocation, missing env file or unreadable schema prints one `envlint:` error line to stderr and
   exits 2 — never a stack trace.

## Decisions taken at spec time
The pitch leaves these open; each is the simplest choice consistent with it.

| Decision | Choice |
|---|---|
| Exit codes | `0` clean · `1` at least one problem or finding · `2` usage error, unreadable env file or schema |
| Output line | `<envfile>:<line>: <KEY>: <message>`; a missing required key has no line: `<envfile>: <KEY>: <message>`; an unparseable line: `<envfile>:<line>: <message>` |
| Order | parse problems and findings sorted by line; missing-key findings last, in schema order |
| Quotes | a value wrapped in matching `'…'` or `"…"` is taken verbatim between the quotes, no escape processing; an unterminated quote is a parse problem |
| Unquoted value | everything after the first `=`, trimmed; no inline-comment stripping, no `${VAR}` interpolation |
| Key syntax | `[A-Za-z_][A-Za-z0-9_]*`; anything else is a parse problem |
| Duplicate keys | the last assignment wins |
| `int` | `/^-?[0-9]+$/` |
| `bool` | `true` or `false` |
| `url` | the WHATWG `URL` constructor accepts the string and its `host` is non-empty (rejects `foo`, `http://`, `a:b`, `mailto:x@y`) |
| Schema shape | a JSON object: `{ "<KEY>": { "required"?: boolean, "type"?: "string"\|"int"\|"bool"\|"url", "enum"?: string[] } }`; any other shape is an unreadable schema |

## Rabbit Holes (Risks)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| dotenv dialect creep (escapes, multiline, inline comments) | med | the Decisions table fixes the dialect; anything else is a parse problem |
| `new URL` accepts odd schemes | low | require a non-empty host |
| a crash on malformed input | med | parse and rules never throw on data; the CLI catches IO and JSON errors and exits 2 |

## Document Map

| Document | Type | Status |
|----------|------|--------|
| [[domain-model]] | DDD Model | ✅ ready |
| [[ux-behavior]] | UX Spec (CLI output) | ✅ ready |
| [[usecases/_index]] | Use Cases | ✅ ready |
| [[contracts/envlint.contract]] | Module contracts | ✅ ready |
