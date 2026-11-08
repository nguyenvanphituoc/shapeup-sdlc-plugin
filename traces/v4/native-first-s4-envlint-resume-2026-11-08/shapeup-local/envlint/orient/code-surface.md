# Code surface — envlint

Greenfield. `bin/`, `src/` and `test/` exist and are empty (verified `ls -la`, 2026-11-08).
No breadboard was supplied (`payload.breadboard` absent) and the pitch has no Places or affordance
tables, so there are no P#/U#/N# ids; elements below come from the pitch text (`pitch.gate.md`)
and carry an `E#` label of the Scout's own for cross-reference only (not a planning id).

Runtime: Node v24.15.0 (`node --version`), ESM, `node:` builtins only.

## Existing files the pitch touches

| File:line | What is there | Relevance |
|-----------|---------------|-----------|
| `package.json:1` | `{"name":"site","version":"0.0.0","type":"module","scripts":{"test":"node --test"}}` | ESM is on; `test` = `node --test`. Name is `site` (not `envlint`), **no `bin` field** — the binary is not installable as `envlint` today. |
| `shapeup/envlint/project-profile.md:4` | `entry_point: bin/envlint.mjs` | Fixes the composition root's path. |
| `shapeup/envlint/project-profile.md:5` | `build_probe: node --test` | Round build gate = the repo's own suite. No `launch_probe` (archetype `library`). |
| `.gitignore` | ignores `.shapeup/`, `dist/` | Nothing in `bin/ src/ test/` is ignored; test fixtures written to `os.tmpdir()` never touch the tree. |

## Element map

| E# | Pitch element | Lands in | New / existing | Seam it extends | Certainty |
|----|---------------|----------|----------------|-----------------|-----------|
| E1 | Parsing: `.env` text → `{pairs, problems}` | `src/parse.mjs` (suggested) | NEW — no existing home | Pure function, exported; no fs. | Path is a suggestion; shape of `pairs` is **uncertain** (see C1). |
| E1a | `KEY=value`, `#` comments, blank lines | E1 | NEW | — | Inline `#` after an unquoted value: unspecified. |
| E1b | `export KEY=value` | E1 | NEW | — | `export` with no `=` (`export FOO`): unspecified. |
| E1c | single/double-quoted values | E1 | NEW | — | Escapes inside `"…"`, multiline quotes, unterminated quote: unspecified (unterminated = a parse problem, presumably). |
| E1d | 1-based line number of unparseable lines | E1 `problems[]` | NEW | — | CRLF / BOM handling affects line counting: unspecified. |
| E2 | Rules: `(pairs, schema)` → findings | `src/rules.mjs` (suggested) | NEW — no existing home | Pure function, exported; no fs, no network. | Schema format **undefined** (see C2). |
| E2a | `required` | E2 | NEW | — | Clear. |
| E2b | `type: string \| int \| bool \| url` | E2 | NEW | — | `int`/`bool`/`url` acceptance sets are **not specified** — see hill-signal (probe evidence). |
| E2c | `enum` | E2 | NEW | — | Case sensitivity, enum combined with `type`: unspecified. |
| E3 | CLI: `envlint --schema <schema.json> <envfile>` | `bin/envlint.mjs` (fixed by profile:4) | NEW — no existing home | Composition root: imports E1 and E2, owns all fs reads, stdout/stderr, exit codes. | Path certain; exit-code values and output line format **unspecified** (C3). |
| E3a | Read the two files; missing file / unreadable schema | E3 | NEW | `node:fs` `readFileSync` | Error codes proven by spike (ENOENT, EISDIR, SyntaxError). |
| E3b | Print findings "key by key, line by line" | E3 | NEW | stdout | Needs line numbers from E1 to reach E2's findings (C1). |
| E3c | Exit non-zero on findings | E3 | NEW | `process.exitCode` | Only "non-zero" is required. |
| E3d | File with no assignments | E1 → E2 → E3 | NEW | — | Outcome with a schema that has no `required` keys: unspecified. |
| E4 | Tests driving the binary against throwaway fixtures | `test/*.test.mjs` | NEW | `node:test` + `child_process.spawnSync` + `os.tmpdir()` | Proven by spike. |

## Cross-scope contracts (the only shared surface)

The pitch requires that Parsing and Rules share no file and neither imports the other; only the CLI
depends on both. Therefore the *only* thing the two concurrent pieces share is a **data shape**, and
it must be pinned in the spec, not in a shared `src/` module (a shared module would be written by
both scopes and break the disjointness the pitch is built around).

- **C1 — `pairs` shape (E1 → E2).** For Rules findings to be "line by line", each pair must carry its
  source line. Undecided: array of `{key, value, line}` vs. map `key → {value, line}`; duplicate-key
  semantics (last wins? a problem?).
- **C2 — schema file format (user → E2).** "a small JSON schema describing which keys are required
  and what shape each value must have" names no structure. Not JSON Schema (draft-xx) presumably —
  zero deps. Candidate: `{ "KEY": { "required": true, "type": "int", "enum": [...] } }`. Undecided:
  unknown keys in the env file (ignored or flagged), unknown `type` value in the schema (schema error
  → exit code?).
- **C3 — finding shape (E2 → E3) and output/exit contract (E3 → tests).** Fields of a finding
  (`key`, `line`, `rule`, `message`?), output line format, ordering, stdout vs stderr, and exit code
  values for "findings" vs "usage/IO error" are all unspecified.

## Uncertainty flags (signal for risk triage)

- C1–C3 above: every scope depends on them, none of them is in the pitch.
- Type predicate acceptance sets (E2b) — naive builtin checks are wrong; probe evidence is in
  `hill-signal.md` (Rules area). Not the spike area.
