# Code surface — personal-site

Pitch read: `.shapeup/personal-site/intake.md` (English staged copy; root `pitch.md` is the Vietnamese source).
No separate breadboard was given and the pitch has no Places/affordance tables, so these rows carry no P#/U#/N#
ids. The elements come from the pitch's Solution, Edge behavior and Verification sections.

## Repository state (greenfield)

Tracked files outside `.claude/`: `.gitignore`, `.env.shapeup.example`, `AGENTS.md`, `CLAUDE.md`, `package.json`, `pitch.md`.
There is no `build.mjs`, `content.json`, `dist/` or test file at the project root. Node on this machine is v24.15.0.

| Existing fact | Location | Relevance |
|---|---|---|
| ESM package, `"type":"module"`, `test` script = `node --test` | `package.json:1` | `build.mjs` and `*.test.mjs` work as ESM. Plain `.js` files are ESM too. No `dependencies` key, which fits the zero-dependency rule. |
| `dist/` is gitignored | `.gitignore:12` | Generated output is never committed. A fresh checkout has no `dist/`, so the script has to create it. |
| `.shapeup/` gitignored | `.gitignore:2` | Run trace only. |
| Profile: `archetype: library`, `entry_point: build.mjs`, `build_probe: "node --test"`, no `launch_probe` | `shapeup/personal-site/project-profile.md:3-5` | The round build gate is `node --test` at the root. See the spike: it is green when there are zero tests. |
| Vendored plugin copies with many `*.test.mjs` / `test/**` files | `.claude/shapeup-sdlc-plugin/**`, `.plugin-under-test/**` | Bare `node --test` does **not** discover these (dot-dirs skipped, per the spike). They do not affect the build probe. |

## Pitch element → code

| # | Pitch element | Lands at | Seam | New / Existing |
|---|---|---|---|---|
| E1 | CLI `node build.mjs` (composition root) | `build.mjs` (root) — NEW | profile `entry_point` (`project-profile.md:4`) | NEW |
| E2 | Input resolution: `content.json` default, `$CONTENT_FILE` override | inside `build.mjs` — NEW | `process.env.CONTENT_FILE`; relative to cwd? (uncertain, see hill-signal) | NEW |
| E3 | Output resolution: `dist/index.html` default, `$OUT_DIR` override | inside `build.mjs` — NEW | `process.env.OUT_DIR`; `dist/` ignored at `.gitignore:12`; dir creation needed | NEW |
| E4 | Content model `{name, tagline, about, projects[{title,summary,url}], contact{email}}` | `content.json` (root) — NEW, absent today | JSON.parse + validation; only `name` is named as required | NEW |
| E5 | Validation / error path: missing or unparseable file, missing `name` → exit 1, one stderr line, no write | `build.mjs` — NEW | must validate fully **before** any `mkdir`/`writeFile` | NEW |
| E6 | HTML escaping of all content text | `build.mjs` (pure function) — NEW | text nodes **and** attribute values (`href`, `mailto:`) | NEW |
| E7 | Page render: `<title>`=name, single `<h1>`=name, tagline, About, Projects cards, Contact `mailto:` | `build.mjs` render function — NEW | string template, inline `<style>`, no `<script>` | NEW |
| E8 | Project card: title links to `url`; no `url` → plain text, no `href="#"`/empty href | render function — NEW | per-project branch | NEW |
| E9 | Empty projects → "Projects are coming soon." and no empty list | render function — NEW | branch on `projects.length === 0` (and absent `projects`? uncertain) | NEW |
| E10 | Determinism: two runs byte-identical | render + write — NEW | no timestamps, no Map/Set iteration surprises, fixed newline | NEW |
| E11 | Never overwrites `content.json`; no network; no deps | `build.mjs` — NEW | only `node:fs`, `node:path`, `node:process`; write target only the output file | NEW |
| E12 | Verification: `node --test` drives `node build.mjs` over temp content files | NEW test file, e.g. root `build.test.mjs` or `test/*.test.mjs` | `package.json:1` script; `project-profile.md:5` build_probe; `node:child_process` + `fs.mkdtempSync` with `CONTENT_FILE`/`OUT_DIR` env | NEW |

## Uncertain map points (signal for triage)

- Whether `$CONTENT_FILE` / `$OUT_DIR` resolve relative to cwd or to the script directory. The pitch says neither.
- Whether a missing `$OUT_DIR` should be created (default `dist/` must be, since it is ignored and absent on checkout).
- Which fields besides `name` are required. A missing `projects` or `contact` is undefined behaviour in the pitch.
- Test file placement. Any `.mjs` under a `test/` dir is executed as a test (spike), so helpers there must not be `.mjs` with side effects.
