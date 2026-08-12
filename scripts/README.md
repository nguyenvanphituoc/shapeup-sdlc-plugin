# `scripts/` — dev / CI / install-time tooling only

**Ownership rule (encoded by structural test #12):** runtime scripts live *inside* the owning
skill (`skills/<name>/scripts/`, shipped beside `SKILL.md`). The repo-root `scripts/` tree is for
tooling that runs at **development, CI, or install/upgrade time only** — never anything a skill
invokes or cites at runtime, because the npm tarball ships only the `files` allowlist in
`package.json` (no repo-root `scripts/`), so such a path would dangle in an npm install.

What lives here, and why it stays:

| Path | Role | Why it is *not* a skill script |
|---|---|---|
| `shapeup-sdlc/oracles/` | evaluation-contract oracle runners + registry | CI evidence layer — proves the `probing.md` grammar discriminates; not shipped |
| `shapeup-sdlc/trigger-eval.mjs` | Tier-1 trigger-eval harness | CI measurement; runs `claude -p`, never invoked by a skill |
| `shapeup-sdlc/migrations/`, `shapeup-sdlc/lib/` | install/upgrade-time migration runner + shell libs | run by `install-harness.sh` / `migrate.sh`, not by any skill |
| `install-harness.sh`, `migrate.sh` | stable public entrypoints (fresh install / update) | install-time |
| `shapeup-sdlc/distribute.js` | release-time channel distribution | release tooling |

**Do not "helpfully" move a skill's runtime script here, and do not move these into a skill.**
The one script that *was* stranded here — `verdict-ledger.mjs`, spec-evaluator's executable
reference impl — now lives at `skills/spec-evaluator/scripts/verdict-ledger.mjs` where it belongs
(and ships with the skill on every channel). Test #12 enforces the boundary in both directions.
