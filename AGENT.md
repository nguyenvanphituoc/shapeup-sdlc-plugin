# AGENT

## What this repo is

This is a **Claude Code plugin** (no application code — it is content for the agent). It packages a Shape Up SDLC harness: a set of skills, one command, hook config, and manifests. The repo is **both the plugin and its own marketplace** (`.claude-plugin/marketplace.json` has `source: "."`), so it is installed directly from GitHub.

There is no build step, no runtime, and no test framework. "Development" means editing markdown skills/manifests and validating them with the Claude Code CLI.

## Commands

```bash
# Validate plugin + marketplace manifests (same check CI runs — must pass before commit)
claude plugin validate . --strict
claude plugin validate ./.claude-plugin/marketplace.json --strict

# Load this working copy into a live session without installing it (for testing skills)
claude --plugin-dir .

# Lint JSON the way CI does (every *.json must parse)
find . -path ./.git -prune -o -name '*.json' -print | while read -r f; do python3 -c "import json; json.load(open('$f'))"; done
```

CI (`.github/workflows/ci.yml`) runs the two `validate --strict` calls + JSON lint on every push/PR. Release (`.github/workflows/release.yml`) fires on `v*` tags and **hard-fails if the tag doesn't match `version` in `.claude-plugin/plugin.json`**.

### Releasing
1. Bump `version` in `.claude-plugin/plugin.json`.
2. Update `CHANGELOG.md`.
3. `git tag vX.Y.Z && git push origin vX.Y.Z` — tag must equal the manifest version exactly.

## The harness — the core architecture

The skills are not independent tools; they form a **planner → generator → judge** pipeline that walks a raw idea to shipped code. Understanding the role boundaries is the key to working here. Steps 1–11 map to Shape Up phases (full annotated pipeline: `docs/mechanism-roadmap.md`).

| Step | Skill | Role | Writes production code? |
|------|-------|------|------|
| 1–4 Shaping | `shapeup` | Frame / breadboard / spike / write pitch | no |
| GATE L0 Intake | `translator` | Normalize non-English intake to English (harness is English-only downstream, HARD-FAILs otherwise) | no |
| 7 Orient | `orient` | Scout: read code, spike riskiest area, emit code-surface map + discovered-task seed | **no** |
| 8 Map Scopes | `ba-pitch-analyzer` | **Planner**: pitch → linked DDD doc tree (domain-model → usecases → tasks) with Test Surface | no |
| 9 Build | `task-executor` | **Generator**: implement one `TASK-NNN.md` spec | **yes** |
| GATE L3 Evaluate | `spec-evaluator` | **Judge**: grade build vs spec on the running app | no (files bugs only) |
| post-PASS QA | `qa-edge-hunter` | Hunter: exploratory edge hunt outside what the judge probed | no |
| Orchestrator | `tech-lead` | Sequences the above; owns the run ledger | no (delegates) |

### Architecture invariants — do not violate when editing skills

These are the reason the harness stays predictable. Each is enforced by skill prose; preserve them in any edit:

- **One judge only.** The verdict belongs to `spec-evaluator`. QA has no verdict and no score; orient/tech-lead don't grade.
- **EVAL runs exactly once per build round** — never per task. QA runs after the first PASS, *outside* the loop.
- **The ledger (`discovery/ledger.md`) is the single source of truth** for discovered tasks. `orient`, `task-executor`, and `qa-edge-hunter` all append to it; QA findings always default to `~` (untriaged).
- **`harness-run.md` has a single writer: `tech-lead`.** Workers never write run-state; tech-lead passes them what they need as args.
- **Role separation is absolute** — evaluator grades, task-executor fixes, QA discovers, ba plans. No skill does another's job.
- **`tech-lead` stays thin** — it delegates and sequences; it never reimplements a sub-skill.

## Skill anatomy

Each skill is a directory under `skills/<name>/` with:

- **`SKILL.md`** — frontmatter (`name` + a long, trigger-phrase-rich `description` that controls when the skill auto-activates) followed by the body. The `description` is load-bearing: it lists explicit English **and Vietnamese** trigger phrases. When changing what a skill does, update its triggers too.
- **`references/`** — detailed protocol files the body loads on demand (e.g. `spec-evaluator/references/anti-leniency.md`, `dimensions/*.md`). The body links them with `> reference → path` lines and instructs when to read them. This keeps `SKILL.md` short and lazy-loads depth.
- **`assets/templates/`** (planner) / **`resources/`** (shapeup) — output templates the skill fills in.

When editing a skill, keep `SKILL.md` lean and push detail into `references/`, matching the existing pattern.

## Spec-tree artifacts (what the harness produces at runtime)

The harness generates a linked markdown doc tree per feature (not committed here — produced in target projects). Shared frontmatter taxonomy lives in `skills/ba-pitch-analyzer/references/doc-schemas.md`: every doc carries `type`, `feature`, `lens` (`lite | standard | cross-context`), `bounded_context`, `status`, and `[[wikilink]]` cross-refs. The **lens** decides which docs are authoritative and which are skipped — `lite` centers on `ux-behavior.md`, `standard` on `contracts/`, `cross-context` on `_cross-context/`.

**Two-root workspace (where runtime artifacts land in target projects), both keyed off the feature `<slug>`:**
- **Shared** `docs/shapeup-sdlc/<slug>/` (committed, team-contributed): `shaping/` (frame · shaping · spike · breadboard · pitch · kickoff, from `shapeup`) + `spec/` (the DDD doc tree above, from `ba-pitch-analyzer`). The append-only harvest feed `docs/shapeup-sdlc/metrics.jsonl` (one row per ship, written by `tech-lead`) is the one committed report surface.
- **Local** `.shapeup-sdlc/<slug>/` (hidden, gitignorable — one line `.shapeup-sdlc/`): per-run trace — `harness-run.md` (tech-lead's run ledger), `run-state.md`, `digest.md`, `orient/`, `evaluation/`, `qa/`, `discovery/ledger.md`, `spikes/`. `tech-lead` sets both roots at GATE L0 and threads them to workers. Full design: `skills/shapeup/resources/context-compaction.md`.

## Conventions

- The repo is bilingual: skill descriptions and `commands/ship.md` mix English and Vietnamese. Preserve both when editing — they are intentional triggers, not noise.
- Skill versions are tracked in prose (e.g. "v2.9") inside `description` and `docs/mechanism-roadmap.md`, not in a manifest. Keep them in sync when bumping a skill.
- `agents/` and `commands/` ship with the plugin; anything under `.claude/` (e.g. a project-local `/gap-scan`) is for *this repo's own* use and is **not** distributed. `.claude/settings.local.json` and `example/` are gitignored.
