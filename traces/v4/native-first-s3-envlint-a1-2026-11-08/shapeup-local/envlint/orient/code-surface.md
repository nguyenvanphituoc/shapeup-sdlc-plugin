# Code surface — envlint

Greenfield. `bin/`, `src/`, `test/` exist as empty directories (checked); `package.json:1` declares
`"type":"module"`, `bin.envlint = bin/envlint.mjs`, `scripts.test = "node --test"`. Profile
(`shapeup/envlint/project-profile.md`): archetype library, entry point `bin/envlint.mjs`, no build/launch probe.
Runtime: Node v24.15.0, zero dependencies. The pitch has no separate breadboard; no Places/UI.

| Pitch element | Lands in | New/Existing | Seam |
|---|---|---|---|
| Parsing: text to `{pairs, problems}` (KEY=value, comments, blanks, `export`, quotes, 1-based line numbers) | `src/parse.mjs` (NEW, no existing home) | NEW | pure export, imports nothing |
| Rules: `required`, `type` string/int/bool/url, `enum` to findings | `src/rules.mjs` (NEW) | NEW | pure export, imports nothing; must not import parse |
| CLI: `--schema <schema.json> <envfile>`, read files, print, exit codes | `bin/envlint.mjs` (NEW; path fixed by `package.json:1` bin and profile entry_point) | NEW | only module importing both src modules |
| Missing file / unreadable schema / no-assignment file edges | `bin/envlint.mjs` (read errors), `src/parse.mjs` (empty input) | NEW | CLI maps read failures to a clean message + non-zero exit |
| Tests against fixtures | `test/*.test.mjs` (NEW), run by `node --test` (`package.json:1`) | NEW | CLI tests write throwaway fixtures and spawn the binary |

Counts: 5 elements mapped; 5 NEW / 0 EXISTING.

Uncertainties: finding/problem object shape and exit-code values are not specified by the pitch (the
parse/rules/CLI contract is only implied; the CLI is the sole joiner). Output is "key by key, line by line":
rules receive pairs, so a pair must carry its line number for the CLI to report it.
