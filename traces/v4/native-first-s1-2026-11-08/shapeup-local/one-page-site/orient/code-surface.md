# Code surface - one-page-site (greenfield)

Existing code: none. The repo has `package.json` (type: module, `test` = `node --test`) and no `build.mjs`, `content.json`, `dist/` or test files. No libraries are used.

Surface to create:
- `build.mjs`: sole entry point and composition root. Reads `$CONTENT_FILE` (default `content.json`), validates, renders, writes `$OUT_DIR/index.html` (default `dist`).
- `content.json`: sample content (name, tagline, about, projects[{title,summary,url}], contact{email}).
- a test file (e.g. `build.test.mjs`): spawns `node build.mjs` with temp `CONTENT_FILE`/`OUT_DIR`, asserts on HTML text.

Seams: env vars `CONTENT_FILE` and `OUT_DIR`; process exit code and stderr; the written `index.html`.
