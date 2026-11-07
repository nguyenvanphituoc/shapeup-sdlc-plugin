---
type: pitch
feature: envlint
appetite: "1 week"
status: ready
bounded_context: envlint
entities: [EnvPair, ParseProblem, Schema, Finding]
tags: [cli, dotenv, validation]
---

# envlint — pitch digest

## Problem
A `.env` file is the one config file nobody validates, so a typo in it becomes a production incident.
Source: the committed pitch `pitch.gate.md`.

## Appetite
Small batch — a single build round (sized here as 1 week).

## Boundaries
- In: `envlint --schema <schema.json> <envfile>`; parsing (`KEY=value`, `#` comments, blank lines,
  `export`, single/double quotes, 1-based line problems); rules (`required`, `type`
  string/int/bool/url, `enum`); exit non-zero on any problem.
- Out (no-gos): never writes a `.env` file; no `${VAR}` interpolation; no dotenv-compatible loading;
  no colors, TUI or interactive prompts; no network access, ever (`url` checks string shape only).

## Breadboarding
No breadboard was supplied. The only surface is the terminal: one invocation, plain-text findings on
stdout, an exit code. See [[ux-behavior]].

## Rabbit Holes
- The pitch says only "exits non-zero". This spec pins the minimal reading: `0` clean, `1` findings,
  `2` usage or I/O error (missing env file, unreadable schema). See [[usecases/UC-LintEnvFile]].
- Parsing and Rules must not import each other, so the pair shape they share is a convention — pinned
  in [[contracts/env-pairs.contract]].

## Document Map
- [[domain-model]] — EnvPair, ParseProblem, Schema, Finding
- [[ux-behavior]] — the terminal output
- [[contracts/env-pairs.contract]] — the parse → rules data shape
- [[usecases/_index]] — the three use cases
  - [[usecases/UC-ParseEnvText]]
  - [[usecases/UC-CheckEnvAgainstSchema]]
  - [[usecases/UC-LintEnvFile]]
