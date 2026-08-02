# FROZEN — these paths are a published contract

**Nothing in this directory may be renamed, moved, or reorganized.**

Not because the layout is good. Because these paths are baked into commands that are already
published, already in people's shell history, and already in other repositories' onboarding docs:

```bash
curl -fsSL "https://raw.githubusercontent.com/nguyenvanphituoc/shapeup-sdlc-plugin/main/scripts/migrate.sh" | bash -s -- --directory . --yes
```

A `curl | bash` URL is a public API with no deprecation channel. Rename `scripts/migrate.sh` and
every published upgrade command 404s — silently for the reader, permanently for the search result
that sent them here. `docs/upgrading.md` states the same guarantee to users; this file states it to
whoever is tidying the repository.

## What lives here, and why each is frozen

| Path | Why it cannot move |
|---|---|
| `install-harness.sh` | Published `curl` entry point for a fresh install |
| `migrate.sh` | Published `curl` entry point for an upgrade |
| `shapeup-sdlc/lib/lib-harness.sh` | Sourced by both entry points |
| `shapeup-sdlc/lib/lib-migrate.sh` | The migration runner both entry points call |
| `shapeup-sdlc/migrations/NNNN__*.sh` | Applied in order and recorded by ordinal in the target project's `shapeup/.harness-migrations`. Renaming one makes an applied migration look pending. |

## What deliberately does NOT live here

Everything in this directory runs **on a user's machine, against their project**. Two other classes
of script were moved out precisely so this boundary is legible:

- **`tools/`** — release and dev tooling (`distribute.js`, `demo/`, `trigger-eval.mjs`). Runs on a
  maintainer's machine, never ships, no external contract. Free to reorganize.
- **`oracles/`** — the probing grammar a user's `e2e_verification_fixtures` invoke. That makes it
  *product*, so it ships with the plugin and lives at the repo root beside `skills/` and `hooks/`.
  It sat under `scripts/` for historical reasons and was documented in the quickstart while being
  absent from the published package — a user following the docs had no such file.

## Adding a migration

Take the next ordinal, never reuse or renumber:

```
scripts/shapeup-sdlc/migrations/0009__short-slug.sh
```

Define `MIGRATION_DESC` and `migration_up()`, make it idempotent, and never `git add` or commit on
the user's behalf. Structural test #7 asserts the shape.
