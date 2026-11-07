# Code surface — envlint (greenfield)

Scan result: `bin/`, `src/`, `test/` exist but are empty directories; no prior art, no dependencies
(`package.json:1` — ESM, `"bin": bin/envlint.mjs`, `"test": node --test`). Entry point and build
probe are fixed by `shapeup/envlint/project-profile.md:5-6` (`node --check bin/envlint.mjs`).
Runtime: Node v24.15.0 (zero deps; `node:util` parseArgs, `URL`, `node:fs` available).
No breadboard: the pitch has no Places or U/N IDs; elements below come from the prose.

| # | Pitch element | Lands in | Seam it extends | New/Existing |
|---|---------------|----------|-----------------|--------------|
| 1 | Parsing: `KEY=value`, `#` comments, blanks, `export`, single/double quotes, 1-based line numbers of unparseable lines; `{pairs, problems}` | `src/` (suggest `src/parse.mjs`), no existing home | none; pure function | NEW |
| 2 | Rules: `required`, `type` string/int/bool/url, `enum`; data in, findings out | `src/` (suggest `src/rules.mjs`), no existing home | none; pure function, must not import parse | NEW |
| 3 | CLI: `envlint --schema <schema.json> <envfile>`, read both files, print findings, exit codes | `bin/envlint.mjs` (profile `entry_point`, `project-profile.md:5`) | composition root importing parse + rules | NEW |
| 4 | Edge cases: missing env file, unreadable/invalid schema, file with no assignments | CLI (file IO) + parse (empty result) | fs errors; JSON.parse errors | NEW |
| 5 | Tests / fixtures driving the binary | `test/` (node --test) | spawn `bin/envlint.mjs` with fixture files tests write | NEW |

Summary: 5 elements mapped; 5 NEW / 0 EXISTING seams.

Notes / uncertainty (feeds triage):
- Unspecified: exit-code numbering (0 clean, non-zero on findings; distinct code for usage/IO errors?), findings output format, and how parse `problems` surface in CLI output. Pitch says only "non-zero".
- Unspecified: duplicate keys, empty value vs missing for `required`, accepted bool spellings, whether keys absent from the schema are errors, int syntax (negatives, leading zeros), escapes inside double quotes, inline `# comment` after a value.
- Disjointness: parse and rules share no file; only `bin/envlint.mjs` imports both. The shared contract is the `pairs` shape (parse out, rules in); neither imports the other, so the spec must fix it.
