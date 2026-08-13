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

**The path is frozen; the behaviour behind it is not.** `migrate.sh` used to do two things —
replace skill files, then apply versioned data migrations against the project's own artifacts. The
second half has been removed along with the migrations it ran and their runner. What the freeze
guarantees is that the URL keeps resolving and keeps doing the useful thing, not that its feature
set never shrinks. Retired flags (`--data-only`, `--dry-run`) now **exit non-zero with an
explanation** rather than being accepted and ignored, because a script that swallows a flag it no
longer honours reports success for work it did not do.

## What deliberately does NOT live here

Everything in this directory runs **on a user's machine, against their project**. Tooling that runs
on a maintainer's machine — release and dev scripts — lives in `tools/`, never ships, carries no
external contract, and is free to reorganize. The `oracles/` probing grammar that a user's
`e2e_verification_fixtures` invoke is *product*, so it ships with the plugin and lives at the repo
root beside `skills/` and `hooks/`.
