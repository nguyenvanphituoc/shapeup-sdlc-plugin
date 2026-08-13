# `scripts/` — install/upgrade-time tooling only

**Ownership rule:** runtime scripts live *inside* the owning
skill (`skills/<name>/scripts/`, shipped beside `SKILL.md`). The repo-root `scripts/` tree is for
tooling that runs at **install or upgrade time only** — never anything a skill invokes or cites at
runtime, because the npm tarball ships only the `files` allowlist in `package.json` (no repo-root
`scripts/`), so such a path would dangle in an npm install.

What lives here, and why it stays:

| Path | Role | Why it is *not* a skill script |
|---|---|---|
| `install-harness.sh` | Published `curl` entry point — fresh install | install-time |
| `migrate.sh` | Published `curl` entry point — replaces installed skill files | install-time |
| `shapeup-sdlc/lib/lib-harness.sh` | Source resolution, CLI selection, skill replacement | sourced by both entry points |

All three paths are frozen — see [`FROZEN.md`](FROZEN.md). Maintainer-only release and dev tooling
lives in `tools/`; the `oracles/` probing grammar is product and lives at the repo root.

**Do not "helpfully" move a skill's runtime script here, and do not move these into a skill.**
The structural suite enforces one direction of that boundary — a shipped skill file may not cite a
repo-only path, because it would dangle on an npm install. The other direction is unguarded: nothing
fails if a skill's runtime script is moved *into* this directory, so that one is on the reviewer.
