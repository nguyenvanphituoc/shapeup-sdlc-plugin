# Discovered-task seed — personal-site

These are raw tasks for ba, grouped by suspected scope. They carry no ids, order or dependencies.

## Suspected scope: build CLI (input → validate → write)

**Imagined**
- Create `build.mjs` as the single entry point, using `node:` builtins only, with no network.
- Resolve the input path from `$CONTENT_FILE` (default `content.json`) and the output dir from `$OUT_DIR` (default `dist`).
- Error path: if the file is missing or unparseable, or `name` is absent, exit 1 with one stderr line naming the problem and write nothing.
- Write `index.html` into the output dir, creating the dir when absent.
- Never write to the content file path.
- Ship a sample `content.json` so the default `node build.mjs` succeeds. Without one, the default invocation exits 1 by the pitch's own rule.

**Discovered**
- Validate fully before any `mkdir`/write, so the error path cannot leave a partial `dist/`. The default `dist/` is absent on a fresh checkout because it is ignored (`.gitignore:12`), so directory creation sits on the success path only.
- The project is ESM (`package.json:1`, `"type":"module"`), so `build.mjs` can use `import`/top-level await. No `dependencies` key exists, so keep it that way (`package.json:1`).

## Suspected scope: page rendering

**Imagined**
- `<title>` = name, exactly one `<h1>` = name, tagline below it.
- Sections in order: About, Projects (one card per project), Contact (a `mailto:` link).
- Inline `<style>` and no `<script>` anywhere.
- Project without `url`: plain-text title, no `href="#"` or empty `href`.
- Empty `projects`: the sentence "Projects are coming soon." and no empty `<ul>`/list.
- HTML-escape every content string (`&`, `<`, `>`, `"`, `'`), in text and in attribute values.
- Deterministic output: no timestamps, stable ordering, fixed trailing newline.

**Discovered**
- (none with a real code location. This scope is entirely greenfield. See `code-surface.md` rows E6–E10, all NEW.)

## Suspected scope: verification suite

**Imagined**
- Test file driving `node build.mjs` through `child_process` over temp dirs (`fs.mkdtempSync`), with `CONTENT_FILE`/`OUT_DIR` env set, asserting on the HTML text.
- One test per edge behaviour: no url, empty projects, escaping, missing file, bad JSON, missing name (exit 1, a single stderr line, no output file), byte-identical double run, content file unchanged after the run.

**Discovered**
- The test file must be named so bare `node --test` finds it (`*.test.mjs` in a non-dot dir). With zero tests, `node --test` exits 0, so the build probe `project-profile.md:5` is vacuously green today (spike-build-probe.md, finding 2).
- Do not put helper `.mjs` modules under `test/`, because every `.mjs` there is executed as a test (spike-build-probe.md, finding 3). Fixtures should be `.json` or generated inline.
- The gate (or T0) should assert `# tests` > 0, or the run command should name the test file explicitly (spike-build-probe.md; `project-profile.md:5`).
- Vendored test files under `.claude/` and `.plugin-under-test/` are not discovered (spike-build-probe.md, finding 1). No exclusion config is needed.
