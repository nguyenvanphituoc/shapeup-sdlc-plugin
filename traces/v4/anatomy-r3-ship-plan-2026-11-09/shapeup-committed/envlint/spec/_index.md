---
type: index
feature: envlint
lens: lite
appetite: "~1 week (small batch, a single build round)"
status: draft
---

# envlint — spec index

## Pitch digest

A zero-dependency command-line validator for `.env` files: `envlint --schema <schema.json> <envfile>` reads both
files named on the command line, reports what is wrong key by key and line by line, and exits non-zero so CI fails
on it. It never crashes on malformed input. Three pieces: a pure parser, a pure rules checker, and the CLI that
composes them. Source: `pitch.gate.md`; registry: [[../requirements]].

**Boundaries (No-gos).** Never writes a `.env` file; never interpolates `${VAR}`; no dotenv-compatible loading;
no colors, TUI or interactive prompts; no network access; `url` validates string shape only; no implicit lookup
of the developer's own `.env`.

## Document map

| Document | What it holds |
|---|---|
| [[domain-model]] | the value objects (EnvPair, ParseProblem, Schema, Finding) and the two pure services |
| [[ux-behavior]] | the CLI's output and exit-code contract (the deliverable's only "screen") |
| [[usecases/UC-ParseEnvText]] | parse `.env` text into pairs and problems |
| [[usecases/UC-CheckRules]] | check pairs against a schema |
| [[usecases/UC-LintEnvFile]] | the developer runs the CLI against two files |

## Use cases

| Id | Actor | Action | Oracle |
|---|---|---|---|
| UC-ParseEnvText | System | parse env text | test |
| UC-CheckRules | System | check pairs against schema | test |
| UC-LintEnvFile | Developer / CI | lint an env file against a schema | process |

## Planner decisions (the pitch left these open)

Recorded here so the judge grades against a stated contract rather than a guess. Each is the smallest choice
consistent with the pitch; the PO may overturn any at Board Review.

1. Schema file shape: a JSON object keyed by env key; each value an object with optional `required` (boolean),
   `type` (`"string" | "int" | "bool" | "url"`) and `enum` (array of strings).
2. Exit codes: `0` no findings · `1` one or more findings (parse problems or rule violations) · `2` usage or I/O
   error (missing/unreadable env file, missing/unreadable/invalid schema, bad arguments).
3. Output: one finding per line on stdout, plain text (format in [[ux-behavior]]); errors on stderr as
   `envlint: error: <message>`, never a stack trace.
4. `int` = optional `-` then digits; `bool` = `true` or `false`; `url` = parseable by the WHATWG `URL` parser
   (shape only, no network).
5. Duplicate keys: every occurrence is a pair; rules check the last occurrence.
6. A key present in the env file but absent from the schema is not a finding.
