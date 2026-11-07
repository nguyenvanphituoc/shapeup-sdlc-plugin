---
type: pitch
feature: envlint
appetite: "1 week"
status: ready
bounded_context: envlint
entities: [EnvFile, EnvPair, ParseProblem, Schema, Finding]
tags: [cli, dotenv, validation]
---

# envlint — Pitch Digest

## Problem
A `.env` file is the one config file nobody validates, so a typo in it becomes a production
incident. `envlint --schema <schema.json> <envfile>` validates an env file against a small JSON
schema, reports what is wrong key by key and line by line, and exits non-zero so CI can fail on it.

## Appetite
Small batch — a single build round (sized as `1 week`).

## Boundaries
- In: parsing (`KEY=value`, `#` comments, blank lines, `export`, quoted values, 1-based line numbers
  for unparseable lines); rules (`required`, `type` string/int/bool/url, `enum`); CLI (args, reading
  both files, printing findings, exit codes); sane edges (missing file, unreadable schema, no
  assignments).
- Out (no-gos): never writes a `.env` file; no `${VAR}` interpolation; no dotenv-compatible
  loading; no colors, TUI or interactive prompts; no network access ever (`url` is shape only); no
  implicit lookup of the developer's own `.env`.

## Breadboarding
No breadboard. The deliverable is a CLI: its only surface is argv → stdout/stderr → exit code,
specified in [[ux-behavior]].

## Rabbit Holes
- Parsing and Rules share no file and neither imports the other; the one shared thing is the
  data contract in [[domain-model#Value Objects]].
- Undecided details in the pitch are pinned in [[domain-model#Planning decisions]] (unattended
  run, no PO available at planning time).

## Document Map
- [[domain-model]] — entities, value objects, planning decisions
- [[ux-behavior]] — the CLI's output and exit-code contract
- [[usecases/_index]] — use case index
  - [[usecases/UC-ParseEnv]]
  - [[usecases/UC-CheckRules]]
  - [[usecases/UC-LintEnvFile]]
