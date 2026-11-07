# Discovered seed

## Imagined (from pitch alone)

### Scope: build-script
- Read content.json (or $CONTENT_FILE), render the page in the pitch's order, write dist/index.html (or $OUT_DIR/index.html).
- Page has a single h1 (name), tagline, About, Projects cards with linked titles, Contact mailto, `<title>` = name, inline CSS, no JS.
- HTML-escape all content text.
- Project without url renders plain title; empty projects renders "Projects are coming soon." with no list.
- Missing/unparseable content or missing name: exit 1, one stderr line, nothing written.
- Byte-identical output on repeat runs.

### Scope: tests
- `node --test` file that spawns `node build.mjs` over temp content files and asserts on HTML text for each edge behaviour.

### Scope: content
- Sample `content.json` for the real site.

## Discovered (code-surface scan)

### Scope: build-script
- Repo is greenfield: `build.mjs` does not exist; create it as the entry point named at `shapeup/personal-site/project-profile.md:4`.
- `package.json:1` already sets `"type":"module"`, so `build.mjs` may use ESM `import` of `node:fs`/`node:path` directly.
- Validate input and fail before any write, so exit-1 paths leave `dist/` untouched (seam: build.mjs error path).
- Decide a url-in-href policy (attribute-escape; consider not emitting javascript: links); the pitch is silent (seam: render function).

### Scope: tests
- `package.json:1` `"test":"node --test"` and profile `build_probe` (`shapeup/personal-site/project-profile.md:5`) expect a `*.test.mjs` file to be auto-discovered at repo root; none exists.
- Tests must use `$CONTENT_FILE`/`$OUT_DIR` temp dirs so the real `content.json` and `dist/` are never touched (seam: env override in build.mjs).
