# Code surface — personal-site (greenfield)

Existing project code: `package.json` (`"type":"module"`, `test` = `node --test`), `pitch.md`. Node v24.15.0.
Absent: `build.mjs`, `content.json`, `dist/`, any test file, a `.gitignore` entry for `dist/`.

| Surface | State | Seam |
|---|---|---|
| `build.mjs` (profile entry point; build_probe `node build.mjs`) | to create | reads `$CONTENT_FILE` (default `content.json`), writes `$OUT_DIR` (default `dist`)/index.html |
| `content.json` | to create (sample content; never overwritten by the build) | name, tagline, about, projects[{title,summary,url}], contact{email} |
| test file (e.g. `build.test.mjs`) | to create | spawns `node build.mjs` with env pointing at throwaway files in a temp dir; asserts on HTML text, exit code, stderr |

Notes: archetype library, no launch probe. The build probe runs against the real `content.json`, so it must exist and be valid or the round build gate goes red.
