# Code surface — envlint

Greenfield: no source exists. Only `package.json` (type=module, `node --test`) and the project profile (entry point `bin/envlint.mjs`, build_probe `node --check bin/envlint.mjs`). Node v24.15.0, zero dependencies, `node:` builtins only.

| Pitch element | Lands in | New/Existing | Seam |
|---|---|---|---|
| Parsing: text -> `{pairs, problems}`, 1-based line numbers | NEW `src/parse.mjs` (suggested) | NEW | pure function, no import of rules |
| Rules: pairs + schema -> findings (`required`, `type` string/int/bool/url, `enum`) | NEW `src/rules.mjs` (suggested) | NEW | pure function, no import of parse |
| CLI: `envlint --schema <schema.json> <envfile>`, read files, print findings, exit codes | NEW `bin/envlint.mjs` (profile entry point) | NEW | composition root; imports parse and rules; node:fs / process only |
| Tests | NEW `test/*.test.mjs` | NEW | `package.json:1` script `node --test` |
| Package | `package.json:1` (name is "site"; type=module present) | EXISTING | optionally add `bin` field |

Uncertainties: module names/locations are suggestions (no convention exists); exit-code values and finding output format unspecified; schema JSON shape unspecified; `url` shape check definition open; accepted `int`/`bool` literals open; duplicate keys and quoted-value escapes open.
Disjointness: parse and rules share no file; only the CLI touches both.
