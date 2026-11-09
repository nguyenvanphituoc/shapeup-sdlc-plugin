# Code surface — envlint

Codebase root: project root. Stack: Node 24 ESM (`"type":"module"` in `package.json:1`), zero dependencies, `npm test` = `node --test` (`package.json:1`).

**Finding: greenfield.** No `bin/`, `src/`, `lib/` or test files exist. The only `.mjs` files in the tree are the harness's own tooling under `.claude/shapeup-sdlc-plugin/` and `.plugin-under-test/`; they are NOT part of this feature and must not be touched or imported. Prior art for the feature: none.

Source: the pitch is `.shapeup/envlint/intake.md` (a raw idea carrying appetite and boundaries; no `status: shaped` frontmatter, no separate breadboard, no Place/U#/N# IDs, so rows are keyed to the pitch's named pieces). Profile: `shapeup/envlint/project-profile.md` (entry point `bin/envlint.mjs`, archetype `library`, no build/launch probe).

| # | Pitch element | Lands at | New/Existing | Seam / notes |
|---|---|---|---|---|
| 1 | CLI: `envlint --schema <schema.json> <envfile>`, no implicit `.env` lookup | `bin/envlint.mjs` (NEW; named as entry point in `project-profile.md`) | NEW | Composition root; the only module importing both pure pieces. Invoked as `node bin/envlint.mjs`. |
| 2 | Parsing: text to `{pairs, problems}` | NEW pure module, suggested `src/parse.mjs` | NEW | No existing home. Path is a suggestion; scope-architect owns the cut. Must not import Rules. |
| 3 | Rules: pairs + schema to findings (`required`, `type` string/int/bool/url, `enum`) | NEW pure module, suggested `src/rules.mjs` | NEW | No existing home. Must not import Parsing. |
| 4 | Edges: missing env file, unreadable/invalid schema, file with no assignments | `bin/envlint.mjs` (fs reads, `JSON.parse`) and the empty parse result | NEW | Read errors belong to the CLI; "no assignments" is a parse outcome the CLI must report deliberately. |
| 5 | Non-zero exit on findings | `bin/envlint.mjs` | NEW | Exit-code meanings are NOT specified by the pitch (see hill-signal). |
| 6 | Output: no colors/TUI/prompts, assertable | `bin/envlint.mjs` stdout/stderr | NEW | Format unspecified beyond "key by key, line by line". |
| 7 | Tests / fixtures (each piece verifiable alone; CLI driven by test-written files) | `test/*.test.mjs` (NEW) | NEW | `node --test` default discovery covers `*.test.mjs` and files under `test/` (Node docs, UNVERIFIED by probe). Fixtures written by tests to tmp dirs; CLI spawned as a child process. |
| 8 | Boundaries: no `.env` writes, no `${VAR}` interpolation, no network | whole tree | n/a | Constraints verified by absence: no `node:net`/`http`/`https`, no `writeFile`. `url` is `new URL()` shape only. |

Counts: 8 elements mapped; 8 NEW / 0 EXISTING seams.

## Uncertainty flags
- Module paths in rows 2, 3, 7 are suggestions; the pitch only fixes `bin/envlint.mjs`.
- `package.json:1` has `"name":"site"`, a leftover; harmless.
- The pitch wants findings "line by line", but Rules receives "parsed pairs" and the pitch does not say pairs carry a line. The Parsing-to-Rules data contract is open (see spike).
