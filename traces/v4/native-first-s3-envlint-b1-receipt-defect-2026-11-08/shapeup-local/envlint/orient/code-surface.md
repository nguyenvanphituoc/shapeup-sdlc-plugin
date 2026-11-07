# Code surface — envlint

Pitch: `.shapeup/envlint/intake.md` (cited below as `intake.md:<line>`). No separate breadboard was
supplied and the pitch has no Places/affordance tables, so the elements below come from the pitch
prose (E# = pitch element, assigned here for reference only — not task ids).

## Codebase state (greenfield)

| Path | State | Evidence |
|------|-------|----------|
| `src/` | empty directory | `ls -la src` — 0 entries |
| `test/` | empty directory | `ls -la test` — 0 entries |
| `bin/` | empty directory | `ls -la bin` — 0 entries |
| `package.json:1` | exists: `{"name":"site","version":"0.0.0","type":"module","scripts":{"test":"node --test"}}` — ESM on, **no `bin` field**, name is `site` not `envlint` | read |
| `shapeup/envlint/project-profile.md:4` | `entry_point: bin/envlint.mjs` | read |
| `shapeup/envlint/project-profile.md:5` | `build_probe: node --check bin/envlint.mjs && node --check src/parse.mjs && node --check src/rules.mjs` — **fixes the three file names** the round build gate checks | read |
| `shapeup/envlint/project-profile.md:10-12` | composition root = `bin/envlint.mjs`; pure parser `src/parse.mjs`; pure rules `src/rules.mjs`; tests via `node --test` | read |
| runtime | Node `v24.15.0`; `node:test` available; zero dependencies (no `node_modules`) | `node --version`, probe |

There is no prior art for any element: every row below is NEW. The only existing "seams" are
the profile's fixed file names and `package.json`.

## Element map

| E# | Pitch element | Lands in | Seam / contract | New vs existing | Uncertainty |
|----|---------------|----------|-----------------|-----------------|-------------|
| E1 | Parse `.env` text → `{pairs, problems}` (`intake.md:24-26`) | `src/parse.mjs` (NEW, name fixed by `project-profile.md:5`) | exported pure function, text in → `{pairs, problems}` out | NEW | **Shape of `pairs` is not specified** — map vs ordered list; whether each pair carries its line number (needed for "line by line" findings, `intake.md:12`). Duplicate-key behaviour unspecified. |
| E1a | `KEY=value`, `#` comments, blank lines, `export KEY=value` (`intake.md:24-25`) | `src/parse.mjs` | grammar | NEW | Inline `#` after an unquoted value (comment or part of value?) unspecified; key charset unspecified; whitespace around `=` unspecified. |
| E1b | single- and double-quoted values (`intake.md:25`) | `src/parse.mjs` | grammar | NEW | Escapes inside double quotes (`\n`, `\"`), multi-line quoted values, unterminated quote (→ problem with line number?) unspecified. |
| E1c | 1-based line number of anything unparseable (`intake.md:25-26`) | `src/parse.mjs` → `problems[]` | `problems` item shape (`{line, message}`?) | NEW | Item shape unspecified; CLI must format it. |
| E2 | Rules: pairs + schema → findings (`intake.md:27-28`) | `src/rules.mjs` (NEW, name fixed by `project-profile.md:5`) | exported pure function, data in → findings out | NEW | **Input type depends on E1's `pairs` shape** although the two must not import each other (`intake.md:31-32`). Finding item shape unspecified. |
| E2a | `required` (`intake.md:27`) | `src/rules.mjs` | schema key | NEW | Is an empty value (`KEY=`) "present"? |
| E2b | `type`: `string` / `int` / `bool` / `url` (`intake.md:28`) | `src/rules.mjs` | per-type predicate | NEW | **Spiked** — see `spike-rules-value-types.md`: Node builtins accept values a validator must reject. `bool` spellings unspecified. |
| E2c | `enum` (`intake.md:28`) | `src/rules.mjs` | schema key | NEW | Case sensitivity; combination with `type`. |
| E2d | Schema file format ("small JSON schema", `intake.md:10`) | consumed by `src/rules.mjs`, read by `bin/envlint.mjs` | JSON document shape | NEW | **Not specified**: real JSON Schema vs a bespoke `{ "KEY": {required,type,enum} }` map. Unknown `type` value / unknown keys: error or ignore? |
| E3 | CLI `envlint --schema <schema.json> <envfile>` (`intake.md:16-20`, `29`) | `bin/envlint.mjs` (NEW, `project-profile.md:4`) | composition root: imports E1 + E2 | NEW | Argument errors (missing `--schema`, missing envfile, extra args) behaviour unspecified. |
| E3a | Read both files; edge cases: missing file, unreadable schema, no assignments (`intake.md:12-14`) | `bin/envlint.mjs` | `node:fs` | NEW | What "unreadable schema" covers (missing file / bad JSON / bad shape). Whether a file with no assignments is a finding or clean. Must never throw an uncaught error (`intake.md:13-14`). |
| E3b | Print findings key by key, line by line; no colors/TUI/prompts (`intake.md:11-12`, `40-41`) | `bin/envlint.mjs` | stdout/stderr text format | NEW | Exact line format unspecified — tests assert on it, so the spec must pin it. stdout vs stderr unspecified. |
| E3c | Exit non-zero on findings (`intake.md:12`) | `bin/envlint.mjs` | `process.exitCode` | NEW | Whether usage/IO errors use a distinct code (e.g. 1 = findings, 2 = usage/IO) unspecified. |
| E4 | Boundaries: no writes, no `${VAR}` interpolation, no network, `url` is shape-only (`intake.md:40-41`) | all three files | negative invariants | NEW | None — clear; testable as invariants. |
| E5 | Package wiring | `package.json:1` (EXISTING) | `bin` field, `name`, `scripts.test` | EXISTING, needs edit | Who owns `package.json` — must be exactly one scope or the build serializes. `bin` field optional since tests drive `node bin/envlint.mjs` directly. |
| E6 | Tests per piece, "each verifiable alone against its own fixtures" (`intake.md:31-32`) | `test/` (EMPTY) | `node --test` default discovery (`package.json:1`) | NEW | See note below on discovery. |

## Test-discovery facts (probed)

Bare `node --test` at the repo root (`package.json:1`) uses default discovery. Probed with a
throwaway tree (`.hidden/x/a.test.mjs`, `test/helper.mjs`, `b.test.mjs`) inside the orient
output dir, run with `node --test` from that dir on Node v24.15.0, then deleted:

- Directories starting with `.` are **not** descended — so `.plugin-under-test/**` and
  `.claude/shapeup-sdlc-plugin/**` (which contain dozens of `*.test.mjs`) will **not** be picked up
  by the round build gate's test run. No action needed.
- **Every `.mjs`/`.js` file under `test/` is executed as a test file**, not only `*.test.mjs`. A
  fixture helper written as `test/helpers.mjs` would be run as a test; fixture data files should be
  non-JS (`.env`, `.json`) or live under a non-`test` directory name.

## Scope-shaped seams (for ba)

The pitch's split maps to three suspected scopes with disjoint write sets:
`src/parse.mjs` + its tests, `src/rules.mjs` + its tests, `bin/envlint.mjs` + `package.json` + CLI
tests. The one cross-scope contract is the **`pairs` data shape** (E1 out → E2 in, via E3), which
must be fixed in the spec before Parse and Rules build concurrently.
