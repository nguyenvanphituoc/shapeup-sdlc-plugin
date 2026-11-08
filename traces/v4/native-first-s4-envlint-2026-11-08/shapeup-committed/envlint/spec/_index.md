---
type: index
feature: envlint
lens: lite
appetite: small batch — a single build round (~1 week)
pitch: pitch.gate.md
---

# envlint — spec index

**Pitch digest.** A zero-dependency CLI, `envlint --schema <schema.json> <envfile>`, validates a `.env`
file against a small JSON schema (`required`, `type` string/int/bool/url, `enum`), prints what is wrong
key by key and line by line, and exits non-zero so CI can fail. Three pieces: a pure parser, a pure rules
engine that shares nothing with it, and the CLI that composes both. Boundaries: never writes a `.env`,
no `${VAR}` interpolation, no dotenv loading, no colors/TUI/prompts, no network.

## Document map

| Doc | What it holds |
|---|---|
| [[domain-model]] | modules, and the binding data contracts C1 (ParseResult), C2 (Schema), C3 (Finding) |
| [[ux-behavior]] | the terminal surface: invocation, state table, output lines, exit codes |
| [[usecases/UC-01-parse-env-text]] | Parsing — `src/parse.mjs` |
| [[usecases/UC-02-check-pairs-against-schema]] | Rules — `src/rules.mjs` |
| [[usecases/UC-03-lint-env-file]] | CLI — `bin/envlint.mjs` |
| `../requirements.md` | the REQ registry every acceptance criterion's `covers:` points into |

## Planning decisions

The pitch leaves these open; the Scout flagged each. This run is unattended, so the planner took the
simplest reading and records it here for the PO to overturn at the board review or after ship:

1. **Pairs** are an array of `{key, value, line}`; duplicate keys are kept and the last occurrence is checked.
2. **Schema** is a plain JSON object `KEY → {required?, type?, enum?}`; unknown env keys are ignored; an invalid schema is an error (exit 2), not a finding.
3. **Exit codes**: 0 clean, 1 findings or parse problems, 2 usage / IO / schema / internal error.
4. **Strict type predicates**: `int` = `^-?[0-9]+$`; `bool` = exactly `true`/`false`; `url` = parses as a URL with an `http:`/`https:` protocol and a non-empty host.
5. **Quoting**: no escape processing inside quotes and no inline-comment stripping on unquoted values — the pitch names neither.
6. **Clean output** is silent (empty stdout, exit 0).
7. `package.json` gains a `bin` entry for `envlint`; its `name` is left as it is (non-regression).
