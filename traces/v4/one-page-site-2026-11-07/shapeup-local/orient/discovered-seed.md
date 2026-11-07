# Discovered-task seed — one-page-site

Raw material for the planner; no IDs, order or dependencies.

## Suspected scope A — build script (`build.mjs`)

### Imagined
- Read `content.json` (or `$CONTENT_FILE`) and write `dist/index.html` (or `$OUT_DIR/index.html`).
- Render h1 name + tagline, About, Projects cards with linked titles, Contact mailto, `<title>` = name, inline CSS, no script.
- Project without `url` renders title as plain text; zero projects renders "Projects are coming soon." with no empty list.
- HTML-escape all content text and attribute values.
- Missing/unparsable content or missing `name`: exit 1, one stderr line, nothing written.
- Two runs produce byte-identical output; never write to `content.json`.

### Discovered
- Validate and render fully before `mkdirSync`/`writeFileSync` so failures leave no file (spike finding 3; seam: `build.mjs` load/validate step, project-profile.md:4).
- Guard valid-JSON-wrong-shape (`null`, array, non-array `projects`) as the same one-line exit 1 (spike finding 2; seam: `JSON.parse` result in `build.mjs`).
- Build the stderr line from a fixed prefix, not raw `err.message`, to guarantee one line (spike finding 1; seam: catch block in `build.mjs`).
- Escape `href` and `mailto:` attribute values, and decide on a `url` scheme allowlist, since "no JavaScript" is violated by `javascript:` links (spike finding 4; seam: link rendering in `build.mjs`).
- `.gitignore` handling for `dist/` is undecided (package.json:1 is the only repo file; no ignore rule located).

## Suspected scope B — tests (`node --test`)

### Imagined
- A test file driving `node build.mjs` against throwaway content files and asserting on HTML text.

### Discovered
- Tests must use `spawnSync(process.execPath, ['build.mjs'], {env:{CONTENT_FILE,OUT_DIR}})` with `mkdtempSync` dirs so the real `content.json` is never touched (seam: `package.json:1` test script `node --test`; override env vars from the pitch).
- A failure-path test must use a fresh `OUT_DIR` and assert `dist/index.html` does not exist plus stderr is exactly one line (spike finding 3).
- A determinism test runs the build twice and compares bytes.

## Suspected scope C — sample content

### Imagined
- A starter `content.json` so `node build.mjs` works out of the box.

### Discovered
- None cited; no existing content file in the repo.
