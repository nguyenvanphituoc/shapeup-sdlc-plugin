# Code surface — one-page-site

Greenfield. Present files: `package.json` (type: module, `test` = `node --test`), `pitch.md`, `shapeup/one-page-site/project-profile.md` (archetype cli, entry `build.mjs`, build_probe `node --test`, no launch_probe). No `build.mjs`, `content.json`, tests, or `dist/` exist. Node is the only runtime; zero dependencies allowed.

## Surface to create
- `build.mjs` (entry point): read `$CONTENT_FILE` (default `content.json`), validate, render, write `$OUT_DIR/index.html` (default `dist`).
- `content.json`: sample content (name, tagline, about, projects[], contact.email).
- Test file (`*.test.mjs`) driving `node build.mjs` via child_process with throwaway content/out dirs.

## Seams
Pure `render(content)` returning a string; thin IO shell (read, validate, write, exit code). One escape helper for all interpolated text and attributes.
No knowledge base present (`shapeup/knowledge-base/orient.md` absent).
