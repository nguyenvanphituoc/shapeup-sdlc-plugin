# Code surface — personal-site

Codebase scan (repo root): greenfield. No `build.mjs`, `content.json`, test file or `dist/` exists. Existing: `package.json:1` (`"type":"module"`, `"test":"node --test"`), `shapeup/personal-site/project-profile.md:3-5` (entry_point `build.mjs`, build_probe `node --test`). Runtime Node v24.15.0 (stdlib only: `node:fs`, `node:path`, `node:test`, `node:child_process`).

| Pitch element | Lands in | Seam | New/Existing |
|---|---|---|---|
| Build script `node build.mjs` | `build.mjs` (repo root) | composition root per `project-profile.md:4` | NEW |
| Input `content.json` (name, tagline, about, projects[{title,summary,url}], contact{email}) | `content.json` (repo root); override `$CONTENT_FILE` | file read + JSON.parse | NEW |
| Output `dist/index.html`, override `$OUT_DIR` | `dist/index.html` | mkdir + writeFile | NEW |
| Page order: h1 name, tagline, About, Projects cards, Contact mailto, `<title>`=name | render function in `build.mjs` | string template, inline `<style>` | NEW |
| Project with no url: plain text title | render function | conditional | NEW |
| Empty projects: "Projects are coming soon." | render function | conditional | NEW |
| HTML escaping | escape helper in `build.mjs` | replace & < > " ' | NEW |
| Missing/unparseable content or missing `name`: exit 1, one stderr line, no write | `build.mjs` error path | validate before any write | NEW |
| Byte-identical reruns | render function | no timestamps/randomness | NEW |
| Never overwrite content.json, no network, no JS in output | `build.mjs` | write only to OUT_DIR | NEW |
| Test `node --test` | test file (e.g. `build.test.mjs`) | spawns `node build.mjs` with temp CONTENT_FILE/OUT_DIR | NEW |

Totals: 11 elements, 11 NEW, 0 EXISTING code seams (2 existing config facts). Uncertainty: test file name/location is unspecified (node --test auto-discovers `*.test.mjs`); `$CONTENT_FILE`/`$OUT_DIR` default resolution (cwd vs script dir) is unspecified by the pitch; href policy for unusual urls (e.g. `javascript:`) is unspecified.
