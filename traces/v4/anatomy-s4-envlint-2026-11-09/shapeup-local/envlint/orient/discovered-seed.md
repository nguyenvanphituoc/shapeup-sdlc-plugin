# Discovered-task seed — envlint

Raw material for the planner. No IDs, order or dependencies. Greenfield: every location is NEW, so most tasks are Imagined; Discovered items cite the seam or source that surfaced them.

## Scope suspect A — Parsing (pure module)
Imagined:
- Parse `KEY=value`, `#` comments, blank lines, `export KEY=value`.
- Single- and double-quoted values.
- Return `{pairs, problems}`; each problem carries a 1-based line number.
- Fixture-driven unit tests for the module alone.

Discovered:
- Fix the `pairs` element shape as `{key, value, line}` so Rules can cite lines (seam: Parsing-to-Rules contract; spike finding 2; "line by line" in `intake.md`).
- Unterminated quote and `=`-less line become problems with line numbers (spike finding 5).
- Decide `#` inside quotes and trailing inline comments (spike finding 5).
- Decide duplicate-key behaviour (spike finding 3).

## Scope suspect B — Rules (pure module)
Imagined:
- `required`, `type` (`string`, `int`, `bool`, `url`), `enum`.
- Findings with key and reason; unit tests for the module alone.

Discovered:
- Define literal grammars for `int`/`bool`/`url` (spike findings 6, 7; `url` shape-only per `intake.md` Boundaries).
- Empty-value semantics for `required` (spike finding 4).
- Unknown `type` or malformed schema entry must yield a defined result, not a throw (spike finding 8).
- Keys present in the env file but absent from the schema: ignored or flagged? Unspecified in `intake.md`.

## Scope suspect C — CLI (composition root, `bin/envlint.mjs`)
Imagined:
- Parse `--schema <path>` plus positional env file; read both; call Parsing then Rules; print; set exit code.

Discovered:
- Missing env file, unreadable schema, invalid-JSON schema and missing arguments each need a message and a non-zero exit (`intake.md` edge paragraph).
- A file with zero assignments is reported explicitly, and `required` still runs.
- Exit-code table is unspecified; propose 0 clean, 1 findings, 2 usage/IO error so CI can tell them apart.
- No implicit `.env` lookup: a missing positional argument is a usage error, never a fallback to `./.env` (`intake.md` constraint).
- Stable, colorless output of the shape `file:line KEY message` so tests can assert it.
- Decide whether parse problems alone cause a non-zero exit.
- Tests spawn `node bin/envlint.mjs` as a child process against tmp fixtures the test writes.
- Never write files, never interpolate `${VAR}`, no network (Boundaries).

## Cross-cutting
- Tests under `test/` so `node --test` discovers them (discovery rule UNVERIFIED by probe).
