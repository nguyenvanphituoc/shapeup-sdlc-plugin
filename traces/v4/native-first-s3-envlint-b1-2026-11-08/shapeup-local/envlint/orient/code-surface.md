# Code surface — envlint

Greenfield. The repo has no source yet: `bin/`, `src/` and `test/` exist and are empty. The only
project files are `package.json` (one line) and `shapeup/envlint/project-profile.md`. No
breadboard was supplied (`payload.breadboard` absent) and the pitch has no Places or affordance
tables, so the rows below are pitch elements (the three pieces plus edge cases), not P/U/N ids.
There is no UI Place to turn into a screen: this is a CLI, and its only "affordance" is the
argv/stdout/exit-code contract.

## Existing anchors

| Anchor | Location | What it fixes |
|--------|----------|----------------|
| ESM module type | `package.json:1` (`"type":"module"`) | `.mjs`/`.js` under `src/` load as ESM; no build step |
| bin mapping | `package.json:1` (`"bin":{"envlint":"bin/envlint.mjs"}`) | the CLI entry point path is already decided |
| test script | `package.json:1` (`"scripts":{"test":"node --test"}`) | the runner is bare `node --test` with default file discovery |
| entry point / build probe | `shapeup/envlint/project-profile.md:4-5` | `entry_point: bin/envlint.mjs`, `build_probe: node --check bin/envlint.mjs` |
| archetype | `shapeup/envlint/project-profile.md:3` | `library`; no `launch_probe` declared |
| runtime | `node --version` = v24.15.0 | `node:util` `parseArgs`, `node:test`, `node:assert/strict` all available, zero deps |

Baseline probes (run this pass): `node --test` at the repo root reports `tests 0`, exits 0.
`node --check bin/envlint.mjs` exits 1 with `MODULE_NOT_FOUND`, which is expected because the file
does not exist yet.

## Pitch element → code

| # | Pitch element | Lands at | Seam | New / existing | Certainty |
|---|---------------|----------|------|----------------|-----------|
| E1 | Parsing: `.env` text → `{pairs, problems}` | NEW, e.g. `src/parse.mjs` (no existing home) | pure function export; text in, no fs | NEW | high on location; quote/escape semantics UNCERTAIN (see hill signal) |
| E1a | `KEY=value`, `#` comments, blank lines | inside E1 | — | NEW | inline `#` after an unquoted value is not specified |
| E1b | `export KEY=value` | inside E1 | — | NEW | high |
| E1c | single-/double-quoted values | inside E1 | — | NEW | escapes in `"..."`, multiline quotes and unterminated quotes are not specified |
| E1d | 1-based line number of unparseable lines | `problems[]` entries in E1 | `{line, ...}` shape | NEW | CRLF line endings and duplicate keys are not specified |
| E2 | Rules: pairs + schema → findings | NEW, e.g. `src/rules.mjs` | pure function export; must not import E1 | NEW | high on location; schema format UNCERTAIN |
| E2a | `required` | inside E2 | — | NEW | is it per key (`{"KEY":{"required":true}}`) or a top-level list? Not specified |
| E2b | `type`: `string` / `int` / `bool` / `url` | inside E2 | — | NEW | accepted `bool` spellings and whether `int` allows sign/leading zeros are not specified; `url` can use the `URL` global (shape only, no network) |
| E2c | `enum` | inside E2 | — | NEW | high |
| E2d | finding shape (key, line, message) | E2 output | the E2→E3 contract | NEW | Rules gets `pairs`; for per-line output it needs the line in each pair. Whether E1 includes `line` in pairs is a cross-piece contract |
| E3 | CLI: `envlint --schema <schema.json> <envfile>` | `bin/envlint.mjs` (path fixed by `package.json:1` and profile) | composition root: imports E1 + E2, `node:util` parseArgs, `node:fs` | NEW file at an already-decided path | high (spiked) |
| E3a | read the two files | E3 | `node:fs` `readFileSync` | NEW | spiked: ENOENT / EISDIR / JSON SyntaxError are all catchable and distinguishable |
| E3b | print findings (no colors, no TUI) | E3 stdout | text format | NEW | output line format is not specified |
| E3c | exit codes (non-zero on findings) | E3 | `process.exit` | NEW | the code numbers are not specified (findings vs usage/IO error) |
| E4 | edge: missing env file | E3 | — | NEW | spiked |
| E4b | edge: unreadable / malformed schema | E3 (+ schema-shape validation, owner unclear: E2 or E3) | — | NEW | JSON parse error spiked; a schema that parses but has the wrong shape has no owner yet |
| E4c | edge: file with no assignments | E1 returns empty pairs; E2 reports `required` | — | NEW | is an empty file with no required keys a pass? Not specified |
| E5 | tests driven by fixtures | NEW `test/*.test.mjs` | `node:test` + `child_process.spawnSync(process.execPath, [bin, ...])` + `fs.mkdtempSync(os.tmpdir())` | NEW | high (spiked) |

## Disjointness (the pitch's concurrency claim)

The pitch says Parsing and Rules share no file. On this layout that holds if each lives in its own
`src/` module with its own test file (`test/parse.test.mjs`, `test/rules.test.mjs`) and only
`bin/envlint.mjs` imports both. The one shared surface is the **data contract** between them: the
pair shape E1 emits is the shape E2 consumes (E2d). If that shape is not pinned in the spec, both
pieces will invent it. `package.json` has no source to edit, so no scope needs to write it.
