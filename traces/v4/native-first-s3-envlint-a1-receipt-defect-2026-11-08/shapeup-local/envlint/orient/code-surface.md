# Code surface — envlint

Greenfield. Repo root holds only `package.json:1` (`"type":"module"`, `"test":"node --test"`, Node v24.15.0) and an empty `test/` dir. No `bin/`, no `src/`, no prior art for any element. Declared entry point: `bin/envlint.mjs` (`shapeup/envlint/project-profile.md:4`).

| Pitch element | Lands in | Seam | New/Existing |
|---|---|---|---|
| Parsing (KEY=value, comments, blanks, `export`, quotes, 1-based line problems) | NEW — no existing home (suggest `src/parse.mjs`, pure `parse(text)` returning `{pairs, problems}`) | none; imports nothing | NEW |
| Rules (required, type string/int/bool/url, enum) | NEW (suggest `src/rules.mjs`, pure `check(pairs, schema)` returning findings) | none; imports neither parse nor CLI | NEW |
| CLI (`envlint --schema <s> <envfile>`, read files, print, exit codes) | NEW `bin/envlint.mjs` (profile `entry_point`) | sole composition root importing parse + rules | NEW |
| Tests / fixtures | `test/` exists, empty (`node --test` picks up `test/*.test.mjs`) | fixtures written by tests to temp files | EXISTING dir, NEW content |
| Edge: missing file, unreadable schema, no assignments | CLI (I/O errors) + parse (empty text) | CLI maps errors to exit codes | NEW |

Uncertainties (signal): exit-code contract (findings vs usage/IO error) is not pinned by the pitch; "exit non-zero" only. Output format of findings is unspecified beyond "key by key, line by line". Rules need line numbers, so pairs must carry `line` — a parse/rules data-shape contract the pitch leaves open (rules cannot import parse, so the shape is by convention only).

Disjointness: parse and rules share no file; only `bin/envlint.mjs` touches both. Boundaries: no `${VAR}` interpolation, no .env writing, no network, no color.
