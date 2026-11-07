# Code surface — envlint

Codebase is greenfield. Tracked source: none. Present: `package.json` (`type: module`, `test: node --test`), `shapeup/envlint/project-profile.md` (entry_point `bin/envlint.mjs`, build_probe `node --test`), `pitch.md` (unrelated to envlint, not used as spec). No `bin/`, `src/`, tests, or `shapeup/knowledge-base/`. Runtime: Node v24.15.0 (probed).

| Pitch element | Location | Status | Seam |
|---|---|---|---|
| CLI: `envlint --schema <schema.json> <envfile>`, exit codes, printing | `bin/envlint.mjs` (named by project-profile.md) | NEW | Sole importer of parser and rules; root of import walk |
| Parsing: text -> `{pairs, problems}` with 1-based line numbers | NEW, suggest `src/parse.mjs` | NEW | Pure; imports nothing from rules |
| Rules: pairs + schema -> findings (required, type string/int/bool/url, enum) | NEW, suggest `src/rules.mjs` | NEW | Pure; imports nothing from parser |
| Missing file / unreadable schema / no-assignment file handling | `bin/envlint.mjs` (I/O is CLI-only) | NEW | Error paths live at the CLI seam |
| Tests / fixtures | NEW `test/*.test.mjs` picked up by `node --test` | NEW | Build probe |

Uncertainties: parser/rules filenames are suggestions (profile fixes only the entry point); exit-code values and finding output format are unspecified; schema JSON shape is unspecified; `package.json` name is "site" (stale, harmless).

Totals: 5 elements mapped; 5 NEW / 0 EXISTING.
