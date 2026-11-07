# Code surface — one-page-site

Codebase is greenfield: the only source files are `package.json` (`{"type":"module","scripts":{"test":"node --test"}}`, line 1) and the profile `shapeup/one-page-site/project-profile.md` (archetype cli, entry_point `build.mjs`, build_probe `node --test`). No `build.mjs`, `content.json`, `dist/`, or test file exist. No breadboard (CLI, no UI Places); `.shapeup/one-page-site/intake.md` is the pitch. No knowledge-base file (`shapeup/knowledge-base/orient.md` absent).

| # | Pitch element | Lands in | New/Existing | Seam / note |
|---|---|---|---|---|
| 1 | `node build.mjs` entry | `build.mjs` (repo root) | NEW | profile `entry_point` (project-profile.md:4) |
| 2 | ESM, zero deps | `package.json:1` `"type":"module"` | EXISTING | enables `import` of `node:fs`, `node:path` only |
| 3 | `content.json` input (name, tagline, about, projects[], contact.email) | `content.json` (repo root) | NEW | read via `$CONTENT_FILE` override; must never be overwritten |
| 4 | `dist/index.html` output | `dist/index.html` | NEW | `$OUT_DIR/index.html` override; `dist/` not in any ignore rule (no `.gitignore` checked here, uncertain) |
| 5 | Page layout: h1+tagline, About, Projects cards, Contact mailto, `<title>`=name | render function in `build.mjs` | NEW | inline CSS, no script |
| 6 | Edge: project without url -> plain text | render function | NEW | no `href="#"`/empty href |
| 7 | Edge: zero projects -> "Projects are coming soon." | render function | NEW | no empty `<ul>` |
| 8 | Edge: HTML escaping of content text | `escapeHtml` helper in `build.mjs` | NEW | also applies to attribute values (url, mailto) |
| 9 | Edge: missing/unparsable content or missing `name` -> exit 1, one stderr line, no dist written | load/validate step in `build.mjs` | NEW | validate fully BEFORE any write |
| 10 | Edge: deterministic output | render function | NEW | no timestamps, no Date, stable ordering |
| 11 | Verification via `node --test` | `build.test.mjs` (or `test/*.test.mjs`) | NEW | spawns `node build.mjs` with `CONTENT_FILE`/`OUT_DIR` pointing at temp dirs; `package.json:1` test script already present |

Uncertain: test file location/name (node --test auto-discovers `*.test.mjs` and `test/`); whether `dist/` should be gitignored; what counts as "unparsable" for valid JSON of wrong shape (array, null, projects not an array).

Counts: 11 elements; 1 EXISTING, 10 NEW.
